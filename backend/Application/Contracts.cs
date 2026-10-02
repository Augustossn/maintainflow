using MaintainFlow.Domain;
namespace MaintainFlow.Application;

public record Page<T>(IReadOnlyList<T> Items, int Total, int PageNumber, int PageSize);
public record CustomerDto(Guid Id, string Name, string Email);
public record CustomerInput(string Name, string Email);
public record EquipmentDto(Guid Id, string Name, string SerialNumber, Guid CustomerId, string CustomerName, Severity Criticality, bool Available, decimal Mileage, decimal UsageHours);
public record EquipmentInput(string Name, string SerialNumber, Guid CustomerId, Severity Criticality, decimal Mileage, decimal UsageHours);
public record TechnicianDto(Guid Id, string Name, string Specialty, bool Active);
public record TechnicianInput(string Name, string Specialty, bool Active = true);
public record PartDto(Guid Id, string Name, string Sku, int Stock, int MinimumStock, decimal UnitCost, bool LowStock);
public record PartInput(string Name, string Sku, int MinimumStock, decimal UnitCost);
public record PlanDto(Guid Id, Guid EquipmentId, string Name, PlanTrigger Trigger, DateTimeOffset NextDueAt, decimal? NextMeter, int IntervalDays, decimal MeterInterval, string[] Checklist);
public record PlanInput(Guid EquipmentId, string Name, PlanTrigger Trigger, DateTimeOffset NextDueAt, decimal? NextMeter, int IntervalDays, decimal MeterInterval, string[] Checklist);
[method: System.Text.Json.Serialization.JsonConstructor]
public record WorkOrderDto(Guid Id, string Title, string Description, Guid EquipmentId, string EquipmentName, Guid CustomerId, string CustomerName, Guid? TechnicianId, string? TechnicianName, WorkOrderStatus Status, Severity Priority, bool Preventive, DateTimeOffset CreatedAt, DateTimeOffset DueAt, DateTimeOffset? CompletedAt, decimal Cost, string[] Checklist, string Version, Severity EquipmentCriticality = Severity.LOW)
{
    public WorkOrderDto() : this(default, "", "", default, "", default, "", null, null, default, default, false, default, default, null, 0, [], "") { }
}
public record CreateOrder(Guid EquipmentId, string Title, string Description, Severity Priority, DateTimeOffset DueAt, Guid? TechnicianId = null);
public record StatusChange(WorkOrderStatus Status, string Version, string? Confirmation = null);
public record Assignment(Guid TechnicianId, string Version);
public record PriorityChange(Severity Priority, string Version);
public record StockInput(int Quantity, Guid? WorkOrderId);
public record DecisionInput(string Decision, string? Notes, string[]? Checklist);
public record ReviewInput(string Reason);
public record HistoryDto(Guid Id, Guid WorkOrderId, string Description, decimal Cost, DateTimeOffset CreatedAt);
public record Recommendation(string Text, string Source);
public record SuggestedPart(Guid PartId, string Name, bool Available, string Source);
public record AgentResponse(Guid Id, Severity Severity, IReadOnlyList<Recommendation> ProbableCauses, IReadOnlyList<Recommendation> RecommendedChecklist, IReadOnlyList<SuggestedPart> SuggestedParts, string EstimatedDowntime, bool RequiresTechnicianApproval, string Explanation);
public record DashboardDto(int OpenOrders, int CompletedOrders, int UnavailableEquipment, int CriticalEquipment, int OverdueOrders, int LowStockParts, decimal TotalCost, double MeanRepairHours, IReadOnlyList<PeriodMetric> Periods);
public record PeriodMetric(string Period, decimal Cost, int Preventive, int Corrective);
public record AgentContext(Guid OrderId, Severity Criticality, string Description, IReadOnlyList<HistoryDto> History, IReadOnlyList<string> PlanChecklist, IReadOnlyList<WorkOrderDto> OpenOrders, IReadOnlyList<PartDto> Parts);
public interface IMaintenanceAssistantAgent { Task<AgentResponse> SuggestAsync(AgentContext context, CancellationToken ct); }
public interface IAssistantTools
{
    Task<IReadOnlyList<HistoryDto>> GetEquipmentHistory(Guid equipmentId, CancellationToken ct);
    Task<IReadOnlyList<WorkOrderDto>> GetOpenWorkOrders(Guid equipmentId, CancellationToken ct);
    Task<IReadOnlyList<string>> GetMaintenancePlan(Guid equipmentId, CancellationToken ct);
    Task<PartDto?> CheckPartAvailability(Guid partId, CancellationToken ct);
    Task<Guid> CreateReviewRequest(Guid workOrderId, string reason, string actor, CancellationToken ct);
}
public static class Permissions
{
    public static bool CanManage(string role) => role == "Manager";
    public static bool CanChangeOrder(string role, Guid? assigned, Guid? technician) => role == "Manager" || role == "Technician" && assigned.HasValue && assigned == technician;
}
public class MaintenanceAssistantAgent : IMaintenanceAssistantAgent
{
    public Task<AgentResponse> SuggestAsync(AgentContext context, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var causes = new List<Recommendation> { new("Inspecionar desgaste e conexões antes de substituir componentes.", "regras") };
        if (context.History.Count > 0) causes.Add(new($"Verificar recorrência: {context.History[0].Description}", "histórico"));
        var checklist = context.PlanChecklist.Select(x => new Recommendation(x, "plano")).ToList();
        checklist.Add(new("Isolar energia e aplicar procedimento de segurança do fabricante.", "regras"));
        checklist.Add(new("Registrar diagnóstico e teste funcional após o reparo.", "regras"));
        return Task.FromResult(new AgentResponse(Guid.NewGuid(), context.Criticality, causes, checklist,
            [], context.Criticality >= Severity.HIGH ? "4–8 horas (estimativa por regra)" : "1–4 horas (estimativa por regra)", true,
            "Agente demonstrativo determinístico. Recomendações baseadas em histórico, plano e regras; não realiza diagnóstico nem altera ativos, estoque ou custos."));
    }
}
