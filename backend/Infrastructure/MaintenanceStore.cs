using System.Text.Json;
using MaintainFlow.Application;
using MaintainFlow.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
namespace MaintainFlow.Infrastructure;
public class MaintenanceStore(MaintenanceDbContext db) : IMaintenanceStore
{
    public async Task<Equipment?> Equipment(Guid id, CancellationToken ct) => await db.Equipment.FindAsync([id], ct);
    public async Task<WorkOrder?> Order(Guid id, CancellationToken ct) => await db.Orders.FindAsync([id], ct);
    public async Task<Part?> Part(Guid id, CancellationToken ct) => await db.Parts.FindAsync([id], ct);
    public async Task<MaintenancePlan?> Plan(Guid id, CancellationToken ct) => await db.Plans.FindAsync([id], ct);
    public async Task<AgentSuggestion?> Suggestion(Guid id, CancellationToken ct) => await db.Suggestions.FindAsync([id], ct);
    public Task<bool> ActiveTechnician(Guid id, CancellationToken ct) => db.Technicians.AnyAsync(x => x.Id == id && x.Active, ct);
    public Task<bool> HasOtherOpenOrders(Guid equipmentId, Guid exceptId, CancellationToken ct) => db.Orders.AnyAsync(x => x.EquipmentId == equipmentId && x.Id != exceptId && x.Status != WorkOrderStatus.COMPLETED && x.Status != WorkOrderStatus.CANCELLED, ct);
    public Task<bool> HasOpenPlanOrder(Guid planId, CancellationToken ct) => db.Orders.AnyAsync(x => x.MaintenancePlanId == planId && x.Status != WorkOrderStatus.COMPLETED && x.Status != WorkOrderStatus.CANCELLED, ct);
    public IQueryable<WorkOrderDto> QueryOrders() => from o in db.Orders.AsNoTracking()
        join e in db.Equipment on o.EquipmentId equals e.Id join c in db.Customers on e.CustomerId equals c.Id
        join t in db.Technicians on o.TechnicianId equals t.Id into ts from t in ts.DefaultIfEmpty()
        select new WorkOrderDto(o.Id, o.Title, o.Description, o.EquipmentId, e.Name, c.Id, c.Name, o.TechnicianId, t == null ? null : t.Name, o.Status, o.Priority, o.Preventive, o.CreatedAt, o.DueAt, o.CompletedAt, o.Cost, JsonSerializer.Deserialize<string[]>(o.ChecklistJson, OrderService.Json)!, Convert.ToBase64String(o.RowVersion), e.Criticality);
    public Task<WorkOrderDto?> OrderDto(Guid id, CancellationToken ct) => QueryOrders().SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<IReadOnlyList<HistoryDto>> History(Guid equipmentId, CancellationToken ct) => await db.History.AsNoTracking().Where(x => x.EquipmentId == equipmentId).OrderByDescending(x => x.CreatedAt).Select(x => new HistoryDto(x.Id, x.WorkOrderId, x.Description, x.Cost, x.CreatedAt)).ToListAsync(ct);
    public async Task<IReadOnlyList<WorkOrderDto>> OpenOrders(Guid equipmentId, CancellationToken ct) => await QueryOrders().Where(x => x.EquipmentId == equipmentId && x.Status != WorkOrderStatus.COMPLETED && x.Status != WorkOrderStatus.CANCELLED).ToListAsync(ct);
    public async Task<IReadOnlyList<string>> PlanChecklist(Guid equipmentId, CancellationToken ct)
    { var json = await db.Plans.AsNoTracking().Where(x => x.EquipmentId == equipmentId).Select(x => x.ChecklistJson).ToListAsync(ct); return json.SelectMany(x => JsonSerializer.Deserialize<string[]>(x, OrderService.Json)!).Distinct().ToList(); }
    public Task<PartDto?> PartAvailability(Guid partId, CancellationToken ct) => db.Parts.AsNoTracking().Where(x => x.Id == partId).Select(x => new PartDto(x.Id, x.Name, x.Sku, x.Stock, x.MinimumStock, x.UnitCost, x.Stock <= x.MinimumStock)).SingleOrDefaultAsync(ct);
    public void Add(Entity entity) => db.Add(entity);
    public async Task Save(CancellationToken ct) => await db.SaveChangesAsync(ct);
    public async Task<IStoreTransaction> BeginSerializable(CancellationToken ct) => new Transaction(await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct));
    private class Transaction(IDbContextTransaction transaction) : IStoreTransaction { public Task CommitAsync(CancellationToken ct) => transaction.CommitAsync(ct); public ValueTask DisposeAsync() => transaction.DisposeAsync(); }
}
