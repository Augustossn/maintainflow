using MaintainFlow.Domain;
using Microsoft.EntityFrameworkCore;
namespace MaintainFlow.Infrastructure;
public static class DemoSeed
{
    public static readonly Guid TechnicianId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static async Task Run(MaintenanceDbContext db)
    {
        if (await db.Customers.AnyAsync()) return;
        var customers = new[] { new Customer { Name = "Clínica Horizonte", Email = "contato@horizonte.example" }, new Customer { Name = "Grupo Atlas", Email = "operacoes@atlas.example" }, new Customer { Name = "Locadora Norte", Email = "frota@norte.example" } };
        db.Customers.AddRange(customers);
        var technicians = new[] { new Technician { Id = TechnicianId, Name = "Rafael Costa", Specialty = "Eletromecânica" }, new Technician { Name = "Camila Santos", Specialty = "Equipamentos clínicos" }, new Technician { Name = "Bruno Lima", Specialty = "Refrigeração" } }; db.Technicians.AddRange(technicians);
        string[] names = ["Autoclave Stermax 30L", "Compressor Atlas GA15", "Gerador Honda EU70", "Ar-condicionado central", "Empilhadeira Toyota", "Centrífuga BioSpin", "Bomba hidráulica KSB", "Monitor multiparamétrico"];
        string[] titles = ["Verificar pressão da autoclave", "Troca de filtro e óleo", "Falha na partida do gerador", "Revisão do sistema de refrigeração", "Inspeção do conjunto hidráulico", "Calibração e balanceamento", "Substituir selo mecânico", "Teste de sensores e alarmes"];
        var equipment = names.Select((name, i) => new Equipment { Name = name, SerialNumber = $"EQ-{2401 + i}", CustomerId = customers[i % 3].Id, Criticality = i % 3 == 0 ? Severity.CRITICAL : Severity.MEDIUM, Available = false, UsageHours = 1200 + i * 50 }).ToArray(); db.Equipment.AddRange(equipment);
        for (var i = 0; i < equipment.Length; i++)
        {
            var status = (WorkOrderStatus)(i % 4); var order = new WorkOrder { EquipmentId = equipment[i].Id, Title = titles[i], Description = "Equipamento apresenta variação durante operação. Inspecionar conforme procedimento do fabricante.", Priority = equipment[i].Criticality, Status = status, TechnicianId = status == WorkOrderStatus.OPEN ? null : technicians[i % 3].Id, Preventive = i % 2 == 1, CreatedAt = DateTimeOffset.UtcNow.AddDays(-3 - i), DueAt = DateTimeOffset.UtcNow.AddDays(i - 2), StartedAt = status == WorkOrderStatus.IN_PROGRESS ? DateTimeOffset.UtcNow.AddHours(-4) : null, ChecklistJson = "[\"Verificar conexões\",\"Testar funcionamento\"]" }; db.Orders.Add(order);
            db.Plans.Add(new() { EquipmentId = equipment[i].Id, Name = "Revisão periódica — " + names[i], Trigger = PlanTrigger.PERIODIC, NextDueAt = DateTimeOffset.UtcNow.AddDays(7 + i), IntervalDays = 30, ChecklistJson = "[\"Inspecionar desgaste\",\"Limpar e lubrificar\"]" });
            var oldOrder = new WorkOrder { EquipmentId = equipment[i].Id, Title = "Revisão anterior", Description = "Revisão concluída", Priority = Severity.MEDIUM, TechnicianId = technicians[i % 3].Id, Status = WorkOrderStatus.COMPLETED, CreatedAt = DateTimeOffset.UtcNow.AddDays(-35), StartedAt = DateTimeOffset.UtcNow.AddDays(-32), CompletedAt = DateTimeOffset.UtcNow.AddDays(-32).AddHours(3 + i), DueAt = DateTimeOffset.UtcNow.AddDays(-30), Cost = 180 + i * 85, TechnicianConfirmation = "Demonstração" }; db.Orders.Add(oldOrder);
            db.History.Add(new() { EquipmentId = equipment[i].Id, WorkOrderId = oldOrder.Id, Description = "Revisão anterior: limpeza e teste funcional", Cost = oldOrder.Cost, CreatedAt = oldOrder.CompletedAt.Value });
        }
        db.Parts.AddRange(new Part { Name = "Filtro de óleo", Sku = "FLT-001", Stock = 12, MinimumStock = 5, UnitCost = 85 }, new Part { Name = "Selo mecânico", Sku = "SEL-002", Stock = 2, MinimumStock = 4, UnitCost = 240 }, new Part { Name = "Kit de vedação", Sku = "VED-003", Stock = 8, MinimumStock = 3, UnitCost = 65 });
        await db.SaveChangesAsync();
    }
}
