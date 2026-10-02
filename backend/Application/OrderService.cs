using System.Text.Json;

using MaintainFlow.Domain;

namespace MaintainFlow.Application;

public class OrderService(IMaintenanceStore store, IMaintenanceAssistantAgent agent) : IAssistantTools
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } };
    public void Audit(string actor, string action, Guid id, string detail) => store.Add(new AuditEntry() { Actor = actor, Action = action, EntityId = id, Detail = detail });
    public void Event(string type, Guid id) => store.Add(new OutboxMessage() { Type = type, Payload = JsonSerializer.Serialize(new { entityId = id }, Json) });
    public static void Required(string? value, string field) { if (string.IsNullOrWhiteSpace(value) || value.Length > 2000) throw new BusinessException($"{field} obrigatório (máximo 2000 caracteres)."); }
    public static void ValidEnum<T>(T value) where T : struct, Enum { if (!Enum.IsDefined(value)) throw new BusinessException("Valor inválido."); }
    public async Task<WorkOrderDto> Create(CreateOrder input, string actor, CancellationToken ct)
    {
        Required(input.Title, "Título"); Required(input.Description, "Descrição"); ValidEnum(input.Priority);
        if (input.DueAt <= DateTimeOffset.UtcNow) throw new BusinessException("Prazo deve ser futuro.");
        var equipment = await store.Equipment(input.EquipmentId, ct) ?? throw new KeyNotFoundException("Equipamento não encontrado.");
        if (input.TechnicianId.HasValue && !await store.ActiveTechnician(input.TechnicianId.Value, ct)) throw new BusinessException("Técnico inválido.");
        var order = new WorkOrder { EquipmentId = equipment.Id, Title = input.Title, Description = input.Description, Priority = input.Priority, DueAt = input.DueAt, TechnicianId = input.TechnicianId, Status = input.TechnicianId.HasValue ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.OPEN };
        store.Add(order); equipment.Available = false; Event("work-order.created", order.Id); Event("equipment.unavailable", equipment.Id);
        Audit(actor, "work-order.created", order.Id, input.Title); await store.Save(ct); return await Dto(order.Id, ct);
    }
    public async Task<WorkOrderDto> Dto(Guid id, CancellationToken ct) => await store.OrderDto(id, ct) ?? throw new KeyNotFoundException("Ordem não encontrada.");
    public IQueryable<WorkOrderDto> Query() => store.QueryOrders();
    public async Task<WorkOrder> Load(Guid id, string version, CancellationToken ct)
    {
        var order = await store.Order(id, ct) ?? throw new KeyNotFoundException("Ordem não encontrada.");
        if (Convert.ToBase64String(order.RowVersion) != version) throw new ConflictException("Ordem alterada por outro usuário. Atualize a página.");
        return order;
    }
    public async Task<WorkOrderDto> Status(Guid id, StatusChange input, string actor, string role, Guid? technician, CancellationToken ct)
    {
        ValidEnum(input.Status); var order = await Load(id, input.Version, ct);
        if (!Permissions.CanChangeOrder(role, order.TechnicianId, technician)) throw new UnauthorizedAccessException("Sem permissão para esta ordem.");
        var previous = order.Status; order.ChangeStatus(input.Status, input.Confirmation, DateTimeOffset.UtcNow);
        Audit(actor, "work-order.status", id, $"{previous} → {order.Status}");
        if (order.Status is WorkOrderStatus.COMPLETED or WorkOrderStatus.CANCELLED)
        {
            var equipment = await store.Equipment(order.EquipmentId, ct);
            equipment!.Available = !await store.HasOtherOpenOrders(order.EquipmentId, id, ct);
        }
        if (order.Status == WorkOrderStatus.COMPLETED)
        {
            Event("work-order.completed", id);
            store.Add(new MaintenanceHistory() { EquipmentId = order.EquipmentId, WorkOrderId = id, Description = order.Title, Cost = order.Cost });
        }
        await store.Save(ct); return await Dto(id, ct);
    }
    public async Task<WorkOrderDto> Assign(Guid id, Assignment input, string actor, CancellationToken ct)
    {
        var order = await Load(id, input.Version, ct);
        if (order.Status is WorkOrderStatus.COMPLETED or WorkOrderStatus.CANCELLED) throw new BusinessException("Ordem finalizada.");
        if (!await store.ActiveTechnician(input.TechnicianId, ct)) throw new BusinessException("Técnico inválido.");
        order.TechnicianId = input.TechnicianId;
        if (order.Status == WorkOrderStatus.OPEN) order.ChangeStatus(WorkOrderStatus.ASSIGNED, null, DateTimeOffset.UtcNow);
        Audit(actor, "work-order.assigned", id, input.TechnicianId.ToString()); await store.Save(ct); return await Dto(id, ct);
    }
    public async Task<WorkOrderDto> ChangePriority(Guid id, PriorityChange input, string actor, CancellationToken ct)
    {
        ValidEnum(input.Priority); var order = await Load(id, input.Version, ct);
        if (order.Status is WorkOrderStatus.COMPLETED or WorkOrderStatus.CANCELLED) throw new BusinessException("Ordem finalizada.");
        order.Priority = input.Priority; Audit(actor, "work-order.priority", id, input.Priority.ToString());
        await store.Save(ct); return await Dto(id, ct);
    }
    public async Task MoveStock(Guid id, StockInput input, string actor, CancellationToken ct)
    {
        if (input.Quantity is < -100000 or > 100000) throw new BusinessException("Limite de 100 mil unidades por movimentação.");
        var part = await store.Part(id, ct) ?? throw new KeyNotFoundException("Peça não encontrada.");
        if (input.Quantity >= 0 && input.WorkOrderId.HasValue) throw new BusinessException("Entrada não pode gerar custo em ordem.");
        if (input.Quantity < 0 && !input.WorkOrderId.HasValue) throw new BusinessException("Saída exige ordem de serviço.");
        if (input.WorkOrderId.HasValue)
        {
            var order = await store.Order(input.WorkOrderId.Value, ct) ?? throw new KeyNotFoundException("Ordem não encontrada.");
            if (order.Status is not WorkOrderStatus.IN_PROGRESS and not WorkOrderStatus.WAITING_PARTS) throw new BusinessException("Consumo exige ordem em andamento.");
            order.Cost += Math.Abs(input.Quantity) * part.UnitCost;
        }
        part.Move(input.Quantity); store.Add(new StockMovement() { PartId = id, WorkOrderId = input.WorkOrderId, Quantity = input.Quantity, UnitCost = part.UnitCost, Actor = actor });
        if (part.LowStock) Event("part.low-stock", id);
        Audit(actor, "stock.moved", id, input.Quantity.ToString()); await store.Save(ct);
    }
    public async Task<WorkOrderDto> Generate(Guid planId, string actor, CancellationToken ct)
    {
        await using var tx = await store.BeginSerializable(ct);
        var plan = await store.Plan(planId, ct) ?? throw new KeyNotFoundException("Plano não encontrado.");
        var equipment = await store.Equipment(plan.EquipmentId, ct) ?? throw new KeyNotFoundException();
        if (!plan.IsDue(equipment, DateTimeOffset.UtcNow)) throw new BusinessException("Plano ainda não está vencido.");
        if (await store.HasOpenPlanOrder(planId, ct)) throw new BusinessException("Já existe uma ordem aberta para este plano.");
        var order = new WorkOrder { EquipmentId = equipment.Id, MaintenancePlanId = plan.Id, Title = plan.Name, Description = "Manutenção preventiva gerada pelo plano.", Priority = equipment.Criticality, Preventive = true, DueAt = DateTimeOffset.UtcNow.AddDays(2), ChecklistJson = plan.ChecklistJson };
        store.Add(order); equipment.Available = false;
        if (plan.Trigger is PlanTrigger.HOURS or PlanTrigger.MILEAGE) plan.NextMeter += plan.MeterInterval;
        else plan.NextDueAt = DateTimeOffset.UtcNow.AddDays(plan.IntervalDays);
        Event("work-order.created", order.Id); Event("maintenance.overdue", plan.Id); Event("equipment.unavailable", equipment.Id);
        Audit(actor, "preventive.generated", order.Id, plan.Name); await store.Save(ct); await tx.CommitAsync(ct); return await Dto(order.Id, ct);
    }
    public async Task<AgentResponse> Suggest(Guid id, string actor, CancellationToken ct)
    {
        var order = await Dto(id, ct); var equipment = await store.Equipment(order.EquipmentId, ct);
        var context = new AgentContext(id, equipment!.Criticality, order.Description, await GetEquipmentHistory(order.EquipmentId, ct), await GetMaintenancePlan(order.EquipmentId, ct), await GetOpenWorkOrders(order.EquipmentId, ct), []);
        var result = await agent.SuggestAsync(context, ct);
        store.Add(new AgentSuggestion() { Id = result.Id, WorkOrderId = id, PayloadJson = JsonSerializer.Serialize(result, Json) });
        Audit(actor, "agent.suggested", result.Id, "mock"); await store.Save(ct); return result;
    }
    public async Task Decide(Guid id, DecisionInput input, string actor, CancellationToken ct)
    {
        if (input.Decision is not "ACCEPTED" and not "MODIFIED" and not "REJECTED") throw new BusinessException("Decisão inválida.");
        var suggestion = await store.Suggestion(id, ct) ?? throw new KeyNotFoundException();
        if (suggestion.Decision is not null) throw new BusinessException("Sugestão já revisada.");
        suggestion.Decision = input.Decision; suggestion.TechnicianNotes = input.Notes;
        if (input.Decision != "REJECTED")
        {
            var order = await store.Order(suggestion.WorkOrderId, ct);
            if (order!.Status is WorkOrderStatus.COMPLETED or WorkOrderStatus.CANCELLED) throw new BusinessException("Ordem finalizada.");
            var response = JsonSerializer.Deserialize<AgentResponse>(suggestion.PayloadJson, Json)!;
            var list = input.Decision == "MODIFIED" ? input.Checklist : response.RecommendedChecklist.Select(x => x.Text).ToArray();
            if (list is null || list.Length == 0 || list.Length > 50 || list.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 2000)) throw new BusinessException("Checklist inválido.");
            order.ChecklistJson = JsonSerializer.Serialize(list, Json);
        }
        Audit(actor, "agent." + input.Decision.ToLowerInvariant(), id, input.Notes ?? ""); await store.Save(ct);
    }
    public Task<IReadOnlyList<HistoryDto>> GetEquipmentHistory(Guid equipmentId, CancellationToken ct) => store.History(equipmentId, ct);
    public Task<IReadOnlyList<WorkOrderDto>> GetOpenWorkOrders(Guid equipmentId, CancellationToken ct) => store.OpenOrders(equipmentId, ct);
    public Task<IReadOnlyList<string>> GetMaintenancePlan(Guid equipmentId, CancellationToken ct) => store.PlanChecklist(equipmentId, ct);
    public Task<PartDto?> CheckPartAvailability(Guid partId, CancellationToken ct) => store.PartAvailability(partId, ct);
    public async Task<Guid> CreateReviewRequest(Guid workOrderId, string reason, string actor, CancellationToken ct)
    {
        Required(reason, "Motivo"); _ = await Dto(workOrderId, ct); var id = Guid.NewGuid();
        store.Add(new Notification() { EventId = id, Type = "review.requested", Message = $"OS {workOrderId}: {reason}" }); Audit(actor, "review.requested", workOrderId, reason); await store.Save(ct); return id;
    }
}

