using MaintainFlow.Application;
using MaintainFlow.Domain;
using Moq;
using Xunit;
namespace MaintainFlow.Tests;
public class DomainTests
{
    [Theory]
    [InlineData(WorkOrderStatus.OPEN, WorkOrderStatus.COMPLETED, false)]
    [InlineData(WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED, true)]
    [InlineData(WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, true)]
    [InlineData(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.WAITING_PARTS, true)]
    [InlineData(WorkOrderStatus.WAITING_PARTS, WorkOrderStatus.IN_PROGRESS, true)]
    [InlineData(WorkOrderStatus.COMPLETED, WorkOrderStatus.OPEN, false)]
    public void ValidatesTransitions(WorkOrderStatus from, WorkOrderStatus to, bool allowed) => Assert.Equal(allowed, WorkOrder.CanTransition(from, to));
    [Fact] public void CompletionRequiresConfirmation()
    { var order = new WorkOrder { Status = WorkOrderStatus.IN_PROGRESS, TechnicianId = Guid.NewGuid() }; Assert.Throws<BusinessException>(() => order.ChangeStatus(WorkOrderStatus.COMPLETED, null, DateTimeOffset.UtcNow)); Assert.Equal(WorkOrderStatus.IN_PROGRESS, order.Status); }
    [Fact] public void StartRequiresTechnician()
    { var order = new WorkOrder { Status = WorkOrderStatus.ASSIGNED }; Assert.Throws<BusinessException>(() => order.ChangeStatus(WorkOrderStatus.IN_PROGRESS, null, DateTimeOffset.UtcNow)); }
    [Fact] public void NegativeStockIsRejected()
    { var part = new Part { Stock = 2, MinimumStock = 1 }; Assert.Throws<BusinessException>(() => part.Move(-3)); Assert.Equal(2, part.Stock); part.Move(-1); Assert.True(part.LowStock); }
    [Fact] public void StockDoesNotOverflow()
    { var part = new Part { Stock = int.MaxValue }; Assert.Throws<BusinessException>(() => part.Move(1)); Assert.Equal(int.MaxValue, part.Stock); }
    [Fact] public void AssignedTechnicianOnlyCanChangeOrder()
    { var technician = Guid.NewGuid(); Assert.True(Permissions.CanChangeOrder("Technician", technician, technician)); Assert.False(Permissions.CanChangeOrder("Technician", Guid.NewGuid(), technician)); Assert.False(Permissions.CanManage("Technician")); Assert.False(Permissions.CanChangeOrder("Agent", technician, technician)); }
    [Fact] public void MeterPlansUseActualReading()
    { var plan = new MaintenancePlan { Trigger = PlanTrigger.HOURS, NextMeter = 100 }; Assert.False(plan.IsDue(new Equipment { UsageHours = 99 }, DateTimeOffset.UtcNow)); Assert.True(plan.IsDue(new Equipment { UsageHours = 100 }, DateTimeOffset.UtcNow)); }
    [Fact] public async Task AgentPreservesCriticalityAndRequiresApproval()
    { var result = await new MaintenanceAssistantAgent().SuggestAsync(new(Guid.NewGuid(), Severity.CRITICAL, "Ruído", [], ["Inspecionar filtro"], [], []), default); Assert.Equal(Severity.CRITICAL, result.Severity); Assert.True(result.RequiresTechnicianApproval); Assert.Contains(result.RecommendedChecklist, x => x.Source == "plano"); }
    [Fact] public async Task MockedAgentReturnsStructuredSuggestion()
    { var mock = new Mock<IMaintenanceAssistantAgent>(); var context = new AgentContext(Guid.NewGuid(), Severity.HIGH, "Falha", [], [], [], []); mock.Setup(x => x.SuggestAsync(context, It.IsAny<CancellationToken>())).ReturnsAsync(new AgentResponse(Guid.NewGuid(), Severity.HIGH, [], [], [], "2h", true, "mock")); var result = await mock.Object.SuggestAsync(context, default); Assert.True(result.RequiresTechnicianApproval); mock.Verify(x => x.SuggestAsync(context, It.IsAny<CancellationToken>()), Times.Once); }
}
