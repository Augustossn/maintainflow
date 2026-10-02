using MaintainFlow.Domain;
using Microsoft.EntityFrameworkCore;
namespace MaintainFlow.Infrastructure;
public class MaintenanceDbContext(DbContextOptions<MaintenanceDbContext> options) : DbContext(options)
{
    public DbSet<Equipment> Equipment => Set<Equipment>(); public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Technician> Technicians => Set<Technician>(); public DbSet<MaintenancePlan> Plans => Set<MaintenancePlan>();
    public DbSet<WorkOrder> Orders => Set<WorkOrder>(); public DbSet<Part> Parts => Set<Part>();
    public DbSet<StockMovement> Movements => Set<StockMovement>(); public DbSet<MaintenanceHistory> History => Set<MaintenanceHistory>();
    public DbSet<AgentSuggestion> Suggestions => Set<AgentSuggestion>(); public DbSet<AuditEntry> Audit => Set<AuditEntry>();
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>(); public DbSet<Notification> Notifications => Set<Notification>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Equipment>().HasIndex(x => x.SerialNumber).IsUnique(); b.Entity<Part>().HasIndex(x => x.Sku).IsUnique();
        b.Entity<Notification>().HasIndex(x => x.EventId).IsUnique();
        b.Entity<WorkOrder>().Property(x => x.RowVersion).IsRowVersion(); b.Entity<Part>().Property(x => x.RowVersion).IsRowVersion();
        b.Entity<Equipment>().Property(x => x.RowVersion).IsRowVersion();
        b.Entity<Equipment>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<WorkOrder>().HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<WorkOrder>().HasOne<Technician>().WithMany().HasForeignKey(x => x.TechnicianId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<WorkOrder>().HasOne<MaintenancePlan>().WithMany().HasForeignKey(x => x.MaintenancePlanId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MaintenancePlan>().HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<StockMovement>().HasOne<Part>().WithMany().HasForeignKey(x => x.PartId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<StockMovement>().HasOne<WorkOrder>().WithMany().HasForeignKey(x => x.WorkOrderId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MaintenanceHistory>().HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MaintenanceHistory>().HasOne<WorkOrder>().WithMany().HasForeignKey(x => x.WorkOrderId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<AgentSuggestion>().HasOne<WorkOrder>().WithMany().HasForeignKey(x => x.WorkOrderId).OnDelete(DeleteBehavior.Restrict);
        foreach (var entity in b.Model.GetEntityTypes()) foreach (var property in entity.GetProperties())
        {
            if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?)) property.SetPrecision(18);
            if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?)) property.SetScale(2);
            if (property.ClrType == typeof(string) && !property.Name.EndsWith("Json") && property.Name is not "Payload" and not "Detail") property.SetMaxLength(2000);
        }
        b.Entity<WorkOrder>().Property(x => x.TechnicianConfirmation).HasMaxLength(16000);
        b.Entity<Equipment>().Property(x => x.SerialNumber).HasMaxLength(100);
        b.Entity<Part>().Property(x => x.Sku).HasMaxLength(100);
    }
}
