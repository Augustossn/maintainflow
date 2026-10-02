using MaintainFlow.Domain;
using MaintainFlow.Application;
using Microsoft.EntityFrameworkCore;
namespace MaintainFlow.Api;
public class ErrorMiddleware(RequestDelegate next, ILogger<ErrorMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (Exception ex)
        {
            var (status, title) = ex switch
            {
                BusinessException => (400, ex.Message), KeyNotFoundException => (404, "Registro não encontrado."),
                UnauthorizedAccessException => (403, "Você não tem permissão para esta ação."),
                DbUpdateConcurrencyException => (409, "Registro alterado por outro usuário. Recarregue e tente novamente."),
                ConflictException => (409, ex.Message),
                DbUpdateException => (409, "Registro duplicado ou vinculado a outros registros."),
                BadHttpRequestException => (400, "Dados inválidos."),
                _ => (500, "Erro interno. Consulte o identificador da requisição.")
            };
            if (status == 500) logger.LogError(ex, "Unhandled error {TraceId}", context.TraceIdentifier);
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new { type = "about:blank", title, status, traceId = context.TraceIdentifier }, options: (System.Text.Json.JsonSerializerOptions?)null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
        }
    }
}
