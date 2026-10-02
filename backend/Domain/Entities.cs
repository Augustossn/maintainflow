namespace MaintainFlow.Domain;

public enum WorkOrderStatus { OPEN, ASSIGNED, IN_PROGRESS, WAITING_PARTS, COMPLETED, CANCELLED }
public enum Severity { LOW, MEDIUM, HIGH, CRITICAL }
public enum PlanTrigger { DATE, MILEAGE, HOURS, PERIODIC }
public abstract class Entity { public Guid Id { get; set; } = Guid.NewGuid(); }
public class Customer : Entity { public string Name { get; set; } = ""; public string Email { get; set; } = ""; }
public class Technician : Entity { public string Name { get; set; } = ""; public string Specialty { get; set; } = ""; public bool Active { get; set; } = true; }
public class Equipment : Entity
{
    public string Name { get; set; } = ""; public string SerialNumber { get; set; } = ""; public Guid CustomerId { get; set; }
    public Severity Criticality { get; set; } public bool Available { get; set; } = true;
    public decimal Mileage { get; set; } public decimal UsageHours { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
public class MaintenancePlan : Entity
{
    public Guid EquipmentId { get; set; } public string Name { get; set; } = "";
    public PlanTrigger Trigger { get; set; } public DateTimeOffset NextDueAt { get; set; }
    public decimal? NextMeter { get; set; } public int IntervalDays { get; set; } = 30; public decimal MeterInterval { get; set; } = 100;
    public string ChecklistJson { get; set; } = "[]";
    public bool IsDue(Equipment equipment, DateTimeOffset now) => Trigger switch
    {
        PlanTrigger.MILEAGE => NextMeter.HasValue && equipment.Mileage >= NextMeter.Value,
        PlanTrigger.HOURS => NextMeter.HasValue && equipment.UsageHours >= NextMeter.Value,
        _ => NextDueAt <= now
    };
}
public class WorkOrder : Entity
{
    public string Title { get; set; } = ""; public string Description { get; set; } = "";
    public Guid EquipmentId { get; set; } public Guid? TechnicianId { get; set; } public Guid? MaintenancePlanId { get; set; }
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.OPEN; public Severity Priority { get; set; }
    public bool Preventive { get; set; } public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset DueAt { get; set; } public DateTimeOffset? StartedAt { get; set; } public DateTimeOffset? CompletedAt { get; set; }
    public decimal Cost { get; set; } public string? TechnicianConfirmation { get; set; }
    public string ChecklistJson { get; set; } = "[]"; public byte[] RowVersion { get; set; } = [];
    public void ChangeStatus(WorkOrderStatus next, string? confirmation, DateTimeOffset now)
    {
        if (!CanTransition(Status, next)) throw new BusinessException("Transição de status inválida.");
        if (next is WorkOrderStatus.ASSIGNED or WorkOrderStatus.IN_PROGRESS && TechnicianId is null)
            throw new BusinessException("Atribua um técnico antes de iniciar.");
        if (next == WorkOrderStatus.COMPLETED && string.IsNullOrWhiteSpace(confirmation))
            throw new BusinessException("A confirmação do técnico é obrigatória.");
        if (confirmation?.Length > 16000) throw new BusinessException("Confirmação muito longa.");
        Status = next;
        if (next == WorkOrderStatus.IN_PROGRESS && StartedAt is null) StartedAt = now;
        if (next == WorkOrderStatus.COMPLETED) { CompletedAt = now; TechnicianConfirmation = confirmation; }
    }
    public static bool CanTransition(WorkOrderStatus from, WorkOrderStatus to) => (from, to) switch
    {
        (WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED or WorkOrderStatus.CANCELLED) => true,
        (WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS or WorkOrderStatus.CANCELLED) => true,
        (WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.WAITING_PARTS or WorkOrderStatus.COMPLETED or WorkOrderStatus.CANCELLED) => true,
        (WorkOrderStatus.WAITING_PARTS, WorkOrderStatus.IN_PROGRESS or WorkOrderStatus.CANCELLED) => true,
        _ => false
    };
}
public class Part : Entity
{
    public string Name { get; set; } = ""; public string Sku { get; set; } = ""; public int Stock { get; set; }
    public int MinimumStock { get; set; } public decimal UnitCost { get; set; } public byte[] RowVersion { get; set; } = [];
    public bool LowStock => Stock <= MinimumStock;
    public void Move(int quantity) { var balance = (long)Stock + quantity; if (quantity == 0 || balance < 0 || balance > int.MaxValue) throw new BusinessException("Movimentação de estoque inválida."); Stock = (int)balance; }
}
public class StockMovement : Entity { public Guid PartId { get; set; } public Guid? WorkOrderId { get; set; } public int Quantity { get; set; } public decimal UnitCost { get; set; } public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; public string Actor { get; set; } = ""; }
public class MaintenanceHistory : Entity { public Guid EquipmentId { get; set; } public Guid WorkOrderId { get; set; } public string Description { get; set; } = ""; public decimal Cost { get; set; } public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public class AgentSuggestion : Entity
{
    public Guid WorkOrderId { get; set; } public string PayloadJson { get; set; } = "";
    public string? Decision { get; set; } public string? TechnicianNotes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class AuditEntry : Entity { public string Actor { get; set; } = ""; public string Action { get; set; } = ""; public Guid EntityId { get; set; } public string Detail { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public class OutboxMessage : Entity { public string Type { get; set; } = ""; public string Payload { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; public DateTimeOffset? PublishedAt { get; set; } }
public class Notification : Entity { public Guid EventId { get; set; } public string Type { get; set; } = ""; public string Message { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public class BusinessException(string message) : Exception(message);
