using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MaintainFlow.Infrastructure;
using Microsoft.IdentityModel.Tokens;
namespace MaintainFlow.Api;
public static class AuthEndpoints
{
    public record LoginInput(string Email, string Password);
    public static void MapAuth(this WebApplication app) => app.MapPost("/auth/login", (LoginInput input, IConfiguration config) =>
    {
        // Demo identities are explicitly enabled; production must provision identities through an IdP.
        if (!config.GetValue<bool>("Auth:DemoEnabled")) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrWhiteSpace(input.Password)) return Results.Unauthorized();
        var password = config["Auth:DemoPassword"] ?? "";
        if (password.Length < 12 || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(input.Password)), SHA256.HashData(Encoding.UTF8.GetBytes(password)))) return Results.Unauthorized();
        var role = input.Email == "admin@maintainflow.local" ? "Manager" : input.Email == "tecnico@maintainflow.local" ? "Technician" : null;
        if (role is null) return Results.Unauthorized();
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, input.Email), new(ClaimTypes.Name, input.Email), new(ClaimTypes.Role, role) };
        if (role == "Technician") claims.Add(new("technician_id", DemoSeed.TechnicianId.ToString()));
        var expiry = DateTime.UtcNow.AddHours(2);
        var token = new JwtSecurityToken("maintainflow", "maintainflow", claims, expires: expiry, signingCredentials: new(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), role, name = role == "Manager" ? "Marina Oliveira" : "Rafael Costa", expiresAt = expiry });
    }).RequireRateLimiting("login").WithTags("Authentication");
}
