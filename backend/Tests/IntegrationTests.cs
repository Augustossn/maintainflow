using System.Net;
using System.Net.Http.Json;
using MaintainFlow.Application;
using MaintainFlow.Domain;
using MaintainFlow.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RabbitMQ.Client;
using Testcontainers.MsSql;
using Testcontainers.RabbitMq;
using Xunit;
namespace MaintainFlow.Tests;
public class DockerFactAttribute : FactAttribute { public DockerFactAttribute() { if (Environment.GetEnvironmentVariable("RUN_INTEGRATION") != "1") Skip = "Set RUN_INTEGRATION=1 with Docker running."; } }
public class IntegrationTests
{
    private class Factory(string sql, string rabbit) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Development").ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Database"] = sql, ["RabbitMQ:Uri"] = rabbit, ["Jwt:Key"] = "integration-tests-key-at-least-32-characters", ["Auth:DemoEnabled"] = "true", ["Auth:DemoPassword"] = "IntegrationPassword!2026", ["Database:Initialize"] = "true", ["Database:Seed"] = "true", ["Workers:Disabled"] = "false" }));
    }
    [DockerFact]
    public async Task CreatesOrderPublishesEventAuditsAndRejectsStaleVersion()
    {
        await using var sql = new MsSqlBuilder().Build(); await using var rabbit = new RabbitMqBuilder().Build();
        await Task.WhenAll(sql.StartAsync(), rabbit.StartAsync());
        await using var factory = new Factory(sql.GetConnectionString(), rabbit.GetConnectionString());
        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/auth/login", new { email = "admin@maintainflow.local", password = "IntegrationPassword!2026" });
        var token = System.Text.Json.JsonDocument.Parse(await login.Content.ReadAsStringAsync()).RootElement.GetProperty("token").GetString(); client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        using var connection = new ConnectionFactory { Uri = new Uri(rabbit.GetConnectionString()) }.CreateConnection(); using var channel = connection.CreateModel(); MessagingWorker.Topology(channel);
        channel.QueueDeclare("integration.observer", true, false, false); channel.QueueBind("integration.observer", "maintainflow.events", "work-order.created");
        var assets = await client.GetFromJsonAsync<Page<EquipmentDto>>("/equipment", OrderService.Json);
        var created = await client.PostAsJsonAsync("/work-orders", new CreateOrder(assets!.Items[0].Id, "Teste de integração", "Verificar pressão", Severity.HIGH, DateTimeOffset.UtcNow.AddDays(1), DemoSeed.TechnicianId), OrderService.Json);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode); var order = await created.Content.ReadFromJsonAsync<WorkOrderDto>(OrderService.Json); Assert.NotNull(order);
        BasicGetResult? message = null; var deadline = DateTime.UtcNow.AddSeconds(20);
        while (message is null && DateTime.UtcNow < deadline) { message = channel.BasicGet("integration.observer", true); if (message is null) await Task.Delay(300); }
        Assert.NotNull(message); Assert.Equal("work-order.created", message.RoutingKey);
        var status = await client.PatchAsJsonAsync($"/work-orders/{order.Id}/status", new StatusChange(WorkOrderStatus.IN_PROGRESS, order.Version), OrderService.Json); Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        var stale = await client.PatchAsJsonAsync($"/work-orders/{order.Id}/status", new StatusChange(WorkOrderStatus.IN_PROGRESS, order.Version), OrderService.Json); Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<MaintenanceDbContext>();
        Assert.True(await db.Audit.AnyAsync(x => x.EntityId == order.Id && x.Action == "work-order.created"));
        Assert.True(await db.Outbox.AnyAsync(x => x.Type == "work-order.created" && x.PublishedAt != null));
        client.DefaultRequestHeaders.Authorization = null; Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/work-orders")).StatusCode);
    }
}
