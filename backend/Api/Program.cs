using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using MaintainFlow.Application;
using MaintainFlow.Domain;
using MaintainFlow.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, log) => log.ReadFrom.Configuration(ctx.Configuration).Enrich.FromLogContext().WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is required (at least 32 characters).");
if (jwtKey.Length < 32) throw new InvalidOperationException("JWT key must contain at least 32 characters.");
builder.Services.AddDbContext<MaintenanceDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddScoped<IMaintenanceStore, MaintenanceStore>();
builder.Services.AddScoped<OrderService>(); builder.Services.AddScoped<IAssistantTools>(s => s.GetRequiredService<OrderService>());
builder.Services.AddSingleton<IMaintenanceAssistantAgent, MaintenanceAssistantAgent>();
if (!builder.Configuration.GetValue<bool>("Workers:Disabled")) { builder.Services.AddHostedService<MessagingWorker>(); builder.Services.AddHostedService<PreventiveWorker>(); }
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => o.TokenValidationParameters = new() { ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true, ValidIssuer = "maintainflow", ValidAudience = "maintainflow", IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)), ClockSkew = TimeSpan.FromSeconds(30) });
builder.Services.AddAuthorization(o => { o.AddPolicy("Manager", p => p.RequireRole("Manager")); o.AddPolicy("Staff", p => p.RequireRole("Manager", "Technician")); });
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(builder.Configuration["Frontend:Origin"] ?? "http://localhost:5184", "http://localhost:8080").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.AddPolicy("login", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) })); });
builder.Services.AddEndpointsApiExplorer(); builder.Services.AddSwaggerGen(o => { o.SwaggerDoc("v1", new() { Title = "MaintainFlow", Version = "v1" }); o.AddSecurityDefinition("Bearer", new() { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" }); o.AddSecurityRequirement(new() { [new() { Reference = new() { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = [] }); });
builder.Services.AddOpenTelemetry().ConfigureResource(r => r.AddService("maintainflow-api"))
    .WithTracing(t => t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddOtlpExporter())
    .WithMetrics(m => m.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddMeter("MaintainFlow").AddPrometheusExporter());
var app = builder.Build();
app.UseMiddleware<ErrorMiddleware>(); app.UseSerilogRequestLogging(); app.UseCors(); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapPrometheusScrapingEndpoint();
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy" }));
app.MapGet("/health/ready", async (MaintenanceDbContext db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
app.MapAuth(); app.MapCatalog(); app.MapOrders();
if (builder.Configuration.GetValue<bool>("Database:Initialize"))
{
    using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<MaintenanceDbContext>();
    await db.Database.MigrateAsync(); if (builder.Configuration.GetValue<bool>("Database:Seed")) await DemoSeed.Run(db);
}
app.Run();
public partial class Program;
