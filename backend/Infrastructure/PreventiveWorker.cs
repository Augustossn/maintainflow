using Microsoft.EntityFrameworkCore;
using MaintainFlow.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
namespace MaintainFlow.Infrastructure;
public class PreventiveWorker(IServiceScopeFactory scopes, ILogger<PreventiveWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<MaintenanceDbContext>();
                var service = scope.ServiceProvider.GetRequiredService<OrderService>();
                var plans = await db.Plans.AsNoTracking().ToListAsync(stoppingToken);
                foreach (var plan in plans)
                {
                    var equipment = await db.Equipment.AsNoTracking().SingleAsync(x => x.Id == plan.EquipmentId, stoppingToken);
                    if (!plan.IsDue(equipment, DateTimeOffset.UtcNow)) continue;
                    try { await service.Generate(plan.Id, "preventive-worker", stoppingToken); }
                    catch (MaintainFlow.Domain.BusinessException) { /* An active preventive order already covers this plan. */ }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogWarning(ex, "Preventive generation retry scheduled"); }
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
