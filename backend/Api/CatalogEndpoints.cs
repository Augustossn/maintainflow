using System.Text.Json;
using MaintainFlow.Application;
using MaintainFlow.Domain;
using MaintainFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;
namespace MaintainFlow.Api;
public static class CatalogEndpoints
{
    public static void MapCatalog(this WebApplication app)
    {

        var customers = app.MapGroup("/customers").RequireAuthorization("Staff").WithTags("Customer");
        customers.MapGet("", async (MaintenanceDbContext db, int? page, int? pageSize, string? search, CancellationToken ct) =>
        {
            var n = Math.Max(1, page ?? 1); var size = Math.Clamp(pageSize ?? 20, 1, 100);
            var q = db.Customers.AsNoTracking().Where(x => search == null || x.Name.Contains(search));
            return new Page<CustomerDto>(await q.OrderBy(x => x.Name).Skip((n - 1) * size).Take(size).Select(x => new CustomerDto(x.Id, x.Name, x.Email)).ToListAsync(ct), await q.CountAsync(ct), n, size);
        });
        customers.MapGet("/{id:guid}", async (Guid id, MaintenanceDbContext db, CancellationToken ct) =>
            await db.Customers.AsNoTracking().Where(x => x.Id == id).Select(x => new CustomerDto(x.Id, x.Name, x.Email)).SingleOrDefaultAsync(ct) is {} dto ? Results.Ok(dto) : Results.NotFound());
        customers.MapPost("", async (CustomerInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.Email, "E-mail"); if (!System.Net.Mail.MailAddress.TryCreate(input.Email, out _)) throw new BusinessException("E-mail inválido.");
            var e = new Customer(); e.Name = input.Name; e.Email = input.Email;
            db.Customers.Add(e); service.Audit(ctx.User.Identity!.Name!, "customers.created", e.Id, e.Name);
            await db.SaveChangesAsync(ct);
            var dto = await db.Customers.Where(x => x.Id == e.Id).Select(x => new CustomerDto(x.Id, x.Name, x.Email)).SingleAsync(ct);
            return Results.Created($"/customers/{e.Id}", dto);
        }).RequireAuthorization("Manager");
        customers.MapPut("/{id:guid}", async (Guid id, CustomerInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.Email, "E-mail"); if (!System.Net.Mail.MailAddress.TryCreate(input.Email, out _)) throw new BusinessException("E-mail inválido.");
            var e = await db.Customers.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            e.Name = input.Name; e.Email = input.Email;
            service.Audit(ctx.User.Identity!.Name!, "customers.updated", id, e.Name); await db.SaveChangesAsync(ct);
            return Results.Ok(await db.Customers.Where(x => x.Id == id).Select(x => new CustomerDto(x.Id, x.Name, x.Email)).SingleAsync(ct));
        }).RequireAuthorization("Manager");
        customers.MapDelete("/{id:guid}", async (Guid id, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            var e = await db.Customers.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            db.Customers.Remove(e); service.Audit(ctx.User.Identity!.Name!, "customers.deleted", id, e.Name); await db.SaveChangesAsync(ct); return Results.NoContent();
        }).RequireAuthorization("Manager");

        var technicians = app.MapGroup("/technicians").RequireAuthorization("Staff").WithTags("Technician");
        technicians.MapGet("", async (MaintenanceDbContext db, int? page, int? pageSize, string? search, CancellationToken ct) =>
        {
            var n = Math.Max(1, page ?? 1); var size = Math.Clamp(pageSize ?? 20, 1, 100);
            var q = db.Technicians.AsNoTracking().Where(x => search == null || x.Name.Contains(search));
            return new Page<TechnicianDto>(await q.OrderBy(x => x.Name).Skip((n - 1) * size).Take(size).Select(x => new TechnicianDto(x.Id, x.Name, x.Specialty, x.Active)).ToListAsync(ct), await q.CountAsync(ct), n, size);
        });
        technicians.MapGet("/{id:guid}", async (Guid id, MaintenanceDbContext db, CancellationToken ct) =>
            await db.Technicians.AsNoTracking().Where(x => x.Id == id).Select(x => new TechnicianDto(x.Id, x.Name, x.Specialty, x.Active)).SingleOrDefaultAsync(ct) is {} dto ? Results.Ok(dto) : Results.NotFound());
        technicians.MapPost("", async (TechnicianInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.Specialty, "Especialidade");
            var e = new Technician(); e.Name = input.Name; e.Specialty = input.Specialty; e.Active = input.Active;
            db.Technicians.Add(e); service.Audit(ctx.User.Identity!.Name!, "technicians.created", e.Id, e.Name);
            await db.SaveChangesAsync(ct);
            var dto = await db.Technicians.Where(x => x.Id == e.Id).Select(x => new TechnicianDto(x.Id, x.Name, x.Specialty, x.Active)).SingleAsync(ct);
            return Results.Created($"/technicians/{e.Id}", dto);
        }).RequireAuthorization("Manager");
        technicians.MapPut("/{id:guid}", async (Guid id, TechnicianInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.Specialty, "Especialidade");
            var e = await db.Technicians.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            e.Name = input.Name; e.Specialty = input.Specialty; e.Active = input.Active;
            service.Audit(ctx.User.Identity!.Name!, "technicians.updated", id, e.Name); await db.SaveChangesAsync(ct);
            return Results.Ok(await db.Technicians.Where(x => x.Id == id).Select(x => new TechnicianDto(x.Id, x.Name, x.Specialty, x.Active)).SingleAsync(ct));
        }).RequireAuthorization("Manager");
        technicians.MapDelete("/{id:guid}", async (Guid id, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            var e = await db.Technicians.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            db.Technicians.Remove(e); service.Audit(ctx.User.Identity!.Name!, "technicians.deleted", id, e.Name); await db.SaveChangesAsync(ct); return Results.NoContent();
        }).RequireAuthorization("Manager");

        var parts = app.MapGroup("/parts").RequireAuthorization("Staff").WithTags("Part");
        parts.MapGet("", async (MaintenanceDbContext db, int? page, int? pageSize, string? search, CancellationToken ct) =>
        {
            var n = Math.Max(1, page ?? 1); var size = Math.Clamp(pageSize ?? 20, 1, 100);
            var q = db.Parts.AsNoTracking().Where(x => search == null || x.Name.Contains(search));
            return new Page<PartDto>(await q.OrderBy(x => x.Name).Skip((n - 1) * size).Take(size).Select(x => new PartDto(x.Id, x.Name, x.Sku, x.Stock, x.MinimumStock, x.UnitCost, x.Stock <= x.MinimumStock)).ToListAsync(ct), await q.CountAsync(ct), n, size);
        });
        parts.MapGet("/{id:guid}", async (Guid id, MaintenanceDbContext db, CancellationToken ct) =>
            await db.Parts.AsNoTracking().Where(x => x.Id == id).Select(x => new PartDto(x.Id, x.Name, x.Sku, x.Stock, x.MinimumStock, x.UnitCost, x.Stock <= x.MinimumStock)).SingleOrDefaultAsync(ct) is {} dto ? Results.Ok(dto) : Results.NotFound());
        parts.MapPost("", async (PartInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.Sku, "SKU"); if (input.Sku.Length > 100) throw new BusinessException("SKU deve ter até 100 caracteres."); if (input.MinimumStock < 0 || input.UnitCost < 0) throw new BusinessException("Valores devem ser não negativos.");
            var e = new Part(); e.Name = input.Name; e.Sku = input.Sku; e.MinimumStock = input.MinimumStock; e.UnitCost = input.UnitCost;
            db.Parts.Add(e); service.Audit(ctx.User.Identity!.Name!, "parts.created", e.Id, e.Name);
            await db.SaveChangesAsync(ct);
            var dto = await db.Parts.Where(x => x.Id == e.Id).Select(x => new PartDto(x.Id, x.Name, x.Sku, x.Stock, x.MinimumStock, x.UnitCost, x.Stock <= x.MinimumStock)).SingleAsync(ct);
            return Results.Created($"/parts/{e.Id}", dto);
        }).RequireAuthorization("Manager");
        parts.MapPut("/{id:guid}", async (Guid id, PartInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.Sku, "SKU"); if (input.Sku.Length > 100) throw new BusinessException("SKU deve ter até 100 caracteres."); if (input.MinimumStock < 0 || input.UnitCost < 0) throw new BusinessException("Valores devem ser não negativos.");
            var e = await db.Parts.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            e.Name = input.Name; e.Sku = input.Sku; e.MinimumStock = input.MinimumStock; e.UnitCost = input.UnitCost;
            service.Audit(ctx.User.Identity!.Name!, "parts.updated", id, e.Name); await db.SaveChangesAsync(ct);
            return Results.Ok(await db.Parts.Where(x => x.Id == id).Select(x => new PartDto(x.Id, x.Name, x.Sku, x.Stock, x.MinimumStock, x.UnitCost, x.Stock <= x.MinimumStock)).SingleAsync(ct));
        }).RequireAuthorization("Manager");
        parts.MapDelete("/{id:guid}", async (Guid id, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            var e = await db.Parts.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            db.Parts.Remove(e); service.Audit(ctx.User.Identity!.Name!, "parts.deleted", id, e.Name); await db.SaveChangesAsync(ct); return Results.NoContent();
        }).RequireAuthorization("Manager");

        var equipment = app.MapGroup("/equipment").RequireAuthorization("Staff").WithTags("Equipment");
        equipment.MapGet("", async (MaintenanceDbContext db, int? page, int? pageSize, string? search, CancellationToken ct) =>
        {
            var n = Math.Max(1, page ?? 1); var size = Math.Clamp(pageSize ?? 20, 1, 100);
            var q = db.Equipment.AsNoTracking().Where(x => search == null || x.Name.Contains(search));
            return new Page<EquipmentDto>(await q.OrderBy(x => x.Name).Skip((n - 1) * size).Take(size).Select(x => new EquipmentDto(x.Id, x.Name, x.SerialNumber, x.CustomerId, db.Customers.Where(c => c.Id == x.CustomerId).Select(c => c.Name).First(), x.Criticality, x.Available, x.Mileage, x.UsageHours)).ToListAsync(ct), await q.CountAsync(ct), n, size);
        });
        equipment.MapGet("/{id:guid}", async (Guid id, MaintenanceDbContext db, CancellationToken ct) =>
            await db.Equipment.AsNoTracking().Where(x => x.Id == id).Select(x => new EquipmentDto(x.Id, x.Name, x.SerialNumber, x.CustomerId, db.Customers.Where(c => c.Id == x.CustomerId).Select(c => c.Name).First(), x.Criticality, x.Available, x.Mileage, x.UsageHours)).SingleOrDefaultAsync(ct) is {} dto ? Results.Ok(dto) : Results.NotFound());
        equipment.MapPost("", async (EquipmentInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.SerialNumber, "Número de série"); if (input.SerialNumber.Length > 100) throw new BusinessException("Número de série deve ter até 100 caracteres."); OrderService.ValidEnum(input.Criticality); if (input.Mileage < 0 || input.UsageHours < 0 || !await db.Customers.AnyAsync(x => x.Id == input.CustomerId, ct)) throw new BusinessException("Cliente ou medidor inválido.");
            var e = new Equipment(); e.Name = input.Name; e.SerialNumber = input.SerialNumber; e.CustomerId = input.CustomerId; e.Criticality = input.Criticality; e.Mileage = input.Mileage; e.UsageHours = input.UsageHours;
            db.Equipment.Add(e); service.Audit(ctx.User.Identity!.Name!, "equipment.created", e.Id, e.Name);
            await db.SaveChangesAsync(ct);
            var dto = await db.Equipment.Where(x => x.Id == e.Id).Select(x => new EquipmentDto(x.Id, x.Name, x.SerialNumber, x.CustomerId, db.Customers.Where(c => c.Id == x.CustomerId).Select(c => c.Name).First(), x.Criticality, x.Available, x.Mileage, x.UsageHours)).SingleAsync(ct);
            return Results.Created($"/equipment/{e.Id}", dto);
        }).RequireAuthorization("Manager");
        equipment.MapPut("/{id:guid}", async (Guid id, EquipmentInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.Required(input.SerialNumber, "Número de série"); if (input.SerialNumber.Length > 100) throw new BusinessException("Número de série deve ter até 100 caracteres."); OrderService.ValidEnum(input.Criticality); if (input.Mileage < 0 || input.UsageHours < 0 || !await db.Customers.AnyAsync(x => x.Id == input.CustomerId, ct)) throw new BusinessException("Cliente ou medidor inválido.");
            var e = await db.Equipment.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            e.Name = input.Name; e.SerialNumber = input.SerialNumber; e.CustomerId = input.CustomerId; e.Criticality = input.Criticality; e.Mileage = input.Mileage; e.UsageHours = input.UsageHours;
            service.Audit(ctx.User.Identity!.Name!, "equipment.updated", id, e.Name); await db.SaveChangesAsync(ct);
            return Results.Ok(await db.Equipment.Where(x => x.Id == id).Select(x => new EquipmentDto(x.Id, x.Name, x.SerialNumber, x.CustomerId, db.Customers.Where(c => c.Id == x.CustomerId).Select(c => c.Name).First(), x.Criticality, x.Available, x.Mileage, x.UsageHours)).SingleAsync(ct));
        }).RequireAuthorization("Manager");
        equipment.MapDelete("/{id:guid}", async (Guid id, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            var e = await db.Equipment.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            db.Equipment.Remove(e); service.Audit(ctx.User.Identity!.Name!, "equipment.deleted", id, e.Name); await db.SaveChangesAsync(ct); return Results.NoContent();
        }).RequireAuthorization("Manager");

        var plans = app.MapGroup("/maintenance-plans").RequireAuthorization("Staff").WithTags("MaintenancePlan");
        plans.MapGet("", async (MaintenanceDbContext db, int? page, int? pageSize, string? search, CancellationToken ct) =>
        {
            var n = Math.Max(1, page ?? 1); var size = Math.Clamp(pageSize ?? 20, 1, 100);
            var q = db.Plans.AsNoTracking().Where(x => search == null || x.Name.Contains(search));
            return new Page<PlanDto>(await q.OrderBy(x => x.Name).Skip((n - 1) * size).Take(size).Select(x => new PlanDto(x.Id, x.EquipmentId, x.Name, x.Trigger, x.NextDueAt, x.NextMeter, x.IntervalDays, x.MeterInterval, JsonSerializer.Deserialize<string[]>(x.ChecklistJson, OrderService.Json)!)).ToListAsync(ct), await q.CountAsync(ct), n, size);
        });
        plans.MapGet("/{id:guid}", async (Guid id, MaintenanceDbContext db, CancellationToken ct) =>
            await db.Plans.AsNoTracking().Where(x => x.Id == id).Select(x => new PlanDto(x.Id, x.EquipmentId, x.Name, x.Trigger, x.NextDueAt, x.NextMeter, x.IntervalDays, x.MeterInterval, JsonSerializer.Deserialize<string[]>(x.ChecklistJson, OrderService.Json)!)).SingleOrDefaultAsync(ct) is {} dto ? Results.Ok(dto) : Results.NotFound());
        plans.MapPost("", async (PlanInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.ValidEnum(input.Trigger); if (input.IntervalDays <= 0 || input.MeterInterval <= 0 || input.Checklist is null || input.Checklist.Length > 50 || input.Checklist.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 2000) || !await db.Equipment.AnyAsync(x => x.Id == input.EquipmentId, ct) || (input.Trigger is PlanTrigger.HOURS or PlanTrigger.MILEAGE && (!input.NextMeter.HasValue || input.NextMeter < 0))) throw new BusinessException("Plano inválido.");
            var e = new MaintenancePlan(); e.EquipmentId = input.EquipmentId; e.Name = input.Name; e.Trigger = input.Trigger; e.NextDueAt = input.NextDueAt; e.NextMeter = input.NextMeter; e.IntervalDays = input.IntervalDays; e.MeterInterval = input.MeterInterval; e.ChecklistJson = JsonSerializer.Serialize(input.Checklist, OrderService.Json);
            db.Plans.Add(e); service.Audit(ctx.User.Identity!.Name!, "maintenance-plans.created", e.Id, e.Name);
            await db.SaveChangesAsync(ct);
            var dto = await db.Plans.Where(x => x.Id == e.Id).Select(x => new PlanDto(x.Id, x.EquipmentId, x.Name, x.Trigger, x.NextDueAt, x.NextMeter, x.IntervalDays, x.MeterInterval, JsonSerializer.Deserialize<string[]>(x.ChecklistJson, OrderService.Json)!)).SingleAsync(ct);
            return Results.Created($"/maintenance-plans/{e.Id}", dto);
        }).RequireAuthorization("Manager");
        plans.MapPut("/{id:guid}", async (Guid id, PlanInput input, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            OrderService.Required(input.Name, "Nome"); OrderService.ValidEnum(input.Trigger); if (input.IntervalDays <= 0 || input.MeterInterval <= 0 || input.Checklist is null || input.Checklist.Length > 50 || input.Checklist.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 2000) || !await db.Equipment.AnyAsync(x => x.Id == input.EquipmentId, ct) || (input.Trigger is PlanTrigger.HOURS or PlanTrigger.MILEAGE && (!input.NextMeter.HasValue || input.NextMeter < 0))) throw new BusinessException("Plano inválido.");
            var e = await db.Plans.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            e.EquipmentId = input.EquipmentId; e.Name = input.Name; e.Trigger = input.Trigger; e.NextDueAt = input.NextDueAt; e.NextMeter = input.NextMeter; e.IntervalDays = input.IntervalDays; e.MeterInterval = input.MeterInterval; e.ChecklistJson = JsonSerializer.Serialize(input.Checklist, OrderService.Json);
            service.Audit(ctx.User.Identity!.Name!, "maintenance-plans.updated", id, e.Name); await db.SaveChangesAsync(ct);
            return Results.Ok(await db.Plans.Where(x => x.Id == id).Select(x => new PlanDto(x.Id, x.EquipmentId, x.Name, x.Trigger, x.NextDueAt, x.NextMeter, x.IntervalDays, x.MeterInterval, JsonSerializer.Deserialize<string[]>(x.ChecklistJson, OrderService.Json)!)).SingleAsync(ct));
        }).RequireAuthorization("Manager");
        plans.MapDelete("/{id:guid}", async (Guid id, MaintenanceDbContext db, OrderService service, HttpContext ctx, CancellationToken ct) =>
        {
            var e = await db.Plans.FindAsync([id], ct) ?? throw new KeyNotFoundException();
            db.Plans.Remove(e); service.Audit(ctx.User.Identity!.Name!, "maintenance-plans.deleted", id, e.Name); await db.SaveChangesAsync(ct); return Results.NoContent();
        }).RequireAuthorization("Manager");
    }
}


