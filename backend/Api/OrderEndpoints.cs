using System.Security.Claims;
using MaintainFlow.Application;
using MaintainFlow.Domain;
using MaintainFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;
namespace MaintainFlow.Api;
public static class OrderEndpoints
{
    private static Guid? Technician(HttpContext ctx) => Guid.TryParse(ctx.User.FindFirstValue("technician_id"), out var id) ? id : null;
    private static string Actor(HttpContext ctx) => ctx.User.Identity!.Name!;
    private static string Role(HttpContext ctx) => ctx.User.FindFirstValue(ClaimTypes.Role)!;
    private static async Task Check(Guid id, OrderService service, HttpContext ctx, CancellationToken ct)
    {
        var order = await service.Dto(id, ct);
        if (!Permissions.CanChangeOrder(Role(ctx), order.TechnicianId, Technician(ctx))) throw new UnauthorizedAccessException();
    }
    public static void MapOrders(this WebApplication app)
    {
        var group = app.MapGroup("/work-orders").RequireAuthorization("Staff").WithTags("Work orders");
        group.MapPost("", async (CreateOrder input, OrderService service, HttpContext ctx, CancellationToken ct) => Results.Created("/work-orders", await service.Create(input, Actor(ctx), ct))).RequireAuthorization("Manager");
        group.MapGet("", async (OrderService service, int? page, int? pageSize, string? search, WorkOrderStatus? status, Guid? customerId, Guid? technicianId, Severity? criticality, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct) =>
        {
            var n = Math.Max(1, page ?? 1); var size = Math.Clamp(pageSize ?? 20, 1, 100); var q = service.Query();
            if (search is not null) q = q.Where(x => x.Title.Contains(search) || x.EquipmentName.Contains(search));
            if (status.HasValue) q = q.Where(x => x.Status == status);
            if (customerId.HasValue) q = q.Where(x => x.CustomerId == customerId);
            if (technicianId.HasValue) q = q.Where(x => x.TechnicianId == technicianId);
            if (criticality.HasValue) q = q.Where(x => x.EquipmentCriticality == criticality);
            if (from.HasValue) q = q.Where(x => x.CreatedAt >= from); if (to.HasValue) q = q.Where(x => x.CreatedAt <= to);
            return new Page<WorkOrderDto>(await q.OrderByDescending(x => x.Priority).ThenBy(x => x.DueAt).Skip((n - 1) * size).Take(size).ToListAsync(ct), await q.CountAsync(ct), n, size);
        });
        group.MapGet("/{id:guid}", (Guid id, OrderService service, CancellationToken ct) => service.Dto(id, ct));
        group.MapPatch("/{id:guid}/status", (Guid id, StatusChange input, OrderService service, HttpContext ctx, CancellationToken ct) => service.Status(id, input, Actor(ctx), Role(ctx), Technician(ctx), ct));
        group.MapPost("/{id:guid}/assign", (Guid id, Assignment input, OrderService service, HttpContext ctx, CancellationToken ct) => service.Assign(id, input, Actor(ctx), ct)).RequireAuthorization("Manager");
        group.MapPatch("/{id:guid}/priority", (Guid id, PriorityChange input, OrderService service, HttpContext ctx, CancellationToken ct) => service.ChangePriority(id, input, Actor(ctx), ct)).RequireAuthorization("Manager");
        group.MapPost("/{id:guid}/agent-suggestion", async (Guid id, OrderService service, HttpContext ctx, CancellationToken ct) => { await Check(id, service, ctx, ct); return await service.Suggest(id, Actor(ctx), ct); });
        group.MapPost("/{id:guid}/review-requests", async (Guid id, ReviewInput input, OrderService service, HttpContext ctx, CancellationToken ct) => { await Check(id, service, ctx, ct); return Results.Ok(new { id = await service.CreateReviewRequest(id, input.Reason, Actor(ctx), ct) }); });
        app.MapPost("/agent-suggestions/{id:guid}/decision", async (Guid id, DecisionInput input, OrderService service, MaintenanceDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var suggestion = await db.Suggestions.FindAsync([id], ct) ?? throw new KeyNotFoundException(); await Check(suggestion.WorkOrderId, service, ctx, ct);
            await service.Decide(id, input, Actor(ctx), ct); return Results.NoContent();
        }).RequireAuthorization("Staff");
        app.MapPost("/maintenance-plans/{id:guid}/generate", (Guid id, OrderService service, HttpContext ctx, CancellationToken ct) => service.Generate(id, Actor(ctx), ct)).RequireAuthorization("Manager");
        app.MapPost("/parts/{id:guid}/movements", async (Guid id, StockInput input, OrderService service, HttpContext ctx, CancellationToken ct) => { await service.MoveStock(id, input, Actor(ctx), ct); return Results.NoContent(); }).RequireAuthorization("Manager");
        app.MapGet("/equipment/{id:guid}/history", async (Guid id, OrderService service, MaintenanceDbContext db, CancellationToken ct) =>
        { if (!await db.Equipment.AnyAsync(x => x.Id == id, ct)) throw new KeyNotFoundException(); return await service.GetEquipmentHistory(id, ct); }).RequireAuthorization("Staff");
        app.MapGet("/notifications", async (MaintenanceDbContext db, CancellationToken ct) => await db.Notifications.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(50).Select(x => new { x.Id, x.Type, x.Message, x.CreatedAt }).ToListAsync(ct)).RequireAuthorization("Staff");
        app.MapGet("/audit", async (MaintenanceDbContext db, int? page, CancellationToken ct) => await db.Audit.AsNoTracking().OrderByDescending(x => x.CreatedAt).Skip((Math.Max(1, page ?? 1) - 1) * 50).Take(50).Select(x => new { x.Id, x.Actor, x.Action, x.EntityId, x.Detail, x.CreatedAt }).ToListAsync(ct)).RequireAuthorization("Manager");
        app.MapGet("/dashboard/metrics", async (MaintenanceDbContext db, CancellationToken ct) =>
        {
            var now = DateTimeOffset.UtcNow; var start = now.AddMonths(-5);
            var orders = await db.Orders.AsNoTracking().Select(x => new { x.Status, x.CreatedAt, x.CompletedAt, x.StartedAt, x.Cost, x.Preventive, x.DueAt }).ToListAsync(ct);
            var completed = orders.Where(x => x.Status == WorkOrderStatus.COMPLETED).ToList();
            var repair = completed.Where(x => x.StartedAt.HasValue && x.CompletedAt.HasValue).Select(x => (x.CompletedAt!.Value - x.StartedAt!.Value).TotalHours).ToList();
            var periods = Enumerable.Range(0, 6).Select(i => { var month = start.AddMonths(i); var rows = completed.Where(x => x.CompletedAt!.Value.Year == month.Year && x.CompletedAt.Value.Month == month.Month).ToList(); return new PeriodMetric(month.ToString("yyyy-MM"), rows.Sum(x => x.Cost), rows.Count(x => x.Preventive), rows.Count(x => !x.Preventive)); }).ToList();
            return new DashboardDto(orders.Count(x => x.Status != WorkOrderStatus.COMPLETED && x.Status != WorkOrderStatus.CANCELLED), completed.Count,
                await db.Equipment.CountAsync(x => !x.Available, ct), await db.Equipment.CountAsync(x => x.Criticality == Severity.CRITICAL, ct),
                orders.Count(x => x.DueAt < now && x.Status != WorkOrderStatus.COMPLETED && x.Status != WorkOrderStatus.CANCELLED),
                await db.Parts.CountAsync(x => x.Stock <= x.MinimumStock, ct), completed.Sum(x => x.Cost), repair.Count > 0 ? Math.Round(repair.Average(), 1) : 0, periods);
        }).RequireAuthorization("Staff");
    }
}
