using System.Diagnostics.Metrics;
using System.Text;
using System.Text.Json;
using MaintainFlow.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
namespace MaintainFlow.Infrastructure;

public class MessagingWorker(IServiceScopeFactory scopes, IConfiguration config, ILogger<MessagingWorker> log) : BackgroundService
{
    public static readonly Meter Meter = new("MaintainFlow");
    private static readonly Counter<long> Published = Meter.CreateCounter<long>("maintainflow.events.published");
    private static readonly Counter<long> Consumed = Meter.CreateCounter<long>("maintainflow.events.consumed");
    public static IConnection Connect(IConfiguration config) => new ConnectionFactory { Uri = new Uri(config["RabbitMQ:Uri"] ?? "amqp://guest:guest@localhost:5672"), AutomaticRecoveryEnabled = true }.CreateConnection();
    public static void Topology(IModel channel)
    {
        channel.ExchangeDeclare("maintainflow.events", ExchangeType.Topic, durable: true);
        channel.ExchangeDeclare("maintainflow.dead", ExchangeType.Fanout, durable: true);
        channel.QueueDeclare("maintainflow.dead", true, false, false); channel.QueueBind("maintainflow.dead", "maintainflow.dead", "");
        channel.QueueDeclare("maintainflow.operations", true, false, false, new Dictionary<string, object> { ["x-dead-letter-exchange"] = "maintainflow.dead" });
        channel.QueueBind("maintainflow.operations", "maintainflow.events", "#");
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var connection = Connect(config); using var channel = connection.CreateModel(); Topology(channel); channel.ConfirmSelect();
                while (!stoppingToken.IsCancellationRequested && connection.IsOpen)
                {
                    using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<MaintenanceDbContext>();
                    var pending = await db.Outbox.Where(x => x.PublishedAt == null).OrderBy(x => x.CreatedAt).Take(30).ToListAsync(stoppingToken);
                    foreach (var item in pending)
                    {
                        var properties = channel.CreateBasicProperties(); properties.Persistent = true; properties.MessageId = item.Id.ToString(); properties.ContentType = "application/json";
                        channel.BasicPublish("maintainflow.events", item.Type, false, properties, Encoding.UTF8.GetBytes(item.Payload));
                        channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5)); item.PublishedAt = DateTimeOffset.UtcNow;
                        await db.SaveChangesAsync(stoppingToken); Published.Add(1, new KeyValuePair<string, object?>("event.type", item.Type));
                    }
                    // Single durable consumer: ack only after effects commit; EventId deduplicates redeliveries.
                    var message = channel.BasicGet("maintainflow.operations", false);
                    if (message is not null)
                    {
                        try
                        {
                            if (!Guid.TryParse(message.BasicProperties.MessageId, out var eventId)) { channel.BasicNack(message.DeliveryTag, false, false); continue; }
                            if (!await db.Notifications.AnyAsync(x => x.EventId == eventId, stoppingToken))
                            {
                                using var payload = JsonDocument.Parse(message.Body);
                                var entityId = payload.RootElement.GetProperty("entityId").GetGuid();
                                db.Notifications.Add(new() { EventId = eventId, Type = message.RoutingKey, Message = $"{message.RoutingKey}: {entityId}" });
                                db.Audit.Add(new() { Actor = "rabbitmq-consumer", Action = message.RoutingKey, EntityId = entityId, Detail = "Evento consumido" });
                                await db.SaveChangesAsync(stoppingToken); Consumed.Add(1, new KeyValuePair<string, object?>("event.type", message.RoutingKey));
                            }
                            channel.BasicAck(message.DeliveryTag, false);
                        }
                        catch (JsonException ex) { log.LogError(ex, "Malformed event"); channel.BasicNack(message.DeliveryTag, false, false); }
                        catch { channel.BasicNack(message.DeliveryTag, false, true); throw; }
                    }
                    await Task.Delay(message is null ? 1500 : 50, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogWarning(ex, "RabbitMQ unavailable; durable outbox will retry"); await Task.Delay(5000, stoppingToken); }
        }
    }
}
