using MaintainFlow.Domain;
namespace MaintainFlow.Application;
// Port owned by Application; EF Core and transactions remain in Infrastructure.
public interface IStoreTransaction : IAsyncDisposable { Task CommitAsync(CancellationToken ct); }
public interface IMaintenanceStore
{
    Task<Equipment?> Equipment(Guid id, CancellationToken ct);
    Task<WorkOrder?> Order(Guid id, CancellationToken ct);
    Task<Part?> Part(Guid id, CancellationToken ct);
    Task<MaintenancePlan?> Plan(Guid id, CancellationToken ct);
    Task<AgentSuggestion?> Suggestion(Guid id, CancellationToken ct);
    Task<bool> ActiveTechnician(Guid id, CancellationToken ct);
    Task<bool> HasOtherOpenOrders(Guid equipmentId, Guid exceptId, CancellationToken ct);
    Task<bool> HasOpenPlanOrder(Guid planId, CancellationToken ct);
    IQueryable<WorkOrderDto> QueryOrders();
    Task<WorkOrderDto?> OrderDto(Guid id, CancellationToken ct);
    Task<IReadOnlyList<HistoryDto>> History(Guid equipmentId, CancellationToken ct);
    Task<IReadOnlyList<WorkOrderDto>> OpenOrders(Guid equipmentId, CancellationToken ct);
    Task<IReadOnlyList<string>> PlanChecklist(Guid equipmentId, CancellationToken ct);
    Task<PartDto?> PartAvailability(Guid partId, CancellationToken ct);
    void Add(Entity entity);
    Task Save(CancellationToken ct);
    Task<IStoreTransaction> BeginSerializable(CancellationToken ct);
}
public class ConflictException(string message) : Exception(message);
