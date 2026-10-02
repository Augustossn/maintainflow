using MaintainFlow.Domain;
using MaintainFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MaintainFlow.Tests;

public class OrderQueryTests
{
    [Fact]
    public void OrderProjectionSupportsSqlFilteringAndPagination()
    {
        using var db = new MaintenanceDbContext(new DbContextOptionsBuilder<MaintenanceDbContext>()
            .UseSqlServer("Server=unused;Database=unused").Options);
        var query = new MaintenanceStore(db).QueryOrders();
        var id = Guid.NewGuid();
        Assert.Contains("WHERE", query.Where(x => x.Id == id).ToQueryString());
        Assert.Contains("OFFSET", query.Where(x => x.EquipmentId == id && x.CustomerId == id
            && x.TechnicianId == id && x.Status == WorkOrderStatus.OPEN
            && x.EquipmentCriticality == Severity.HIGH && x.Title.Contains("inspection")
            && x.CreatedAt >= DateTimeOffset.UnixEpoch)
            .OrderByDescending(x => x.Priority).ThenBy(x => x.DueAt).Skip(10).Take(10).ToQueryString());
    }
}
