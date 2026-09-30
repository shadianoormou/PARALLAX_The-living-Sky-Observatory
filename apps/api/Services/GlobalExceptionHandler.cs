using Microsoft.AspNetCore.Diagnostics;

namespace Parallax.Api.Services;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled API exception for {Path} with trace {TraceId}", httpContext.Request.Path, httpContext.TraceIdentifier);
        httpContext.Response.StatusCode = exception switch
        {
            ArgumentException => StatusCodes.Status400BadRequest,
            HttpRequestException => StatusCodes.Status502BadGateway,
            _ => StatusCodes.Status500InternalServerError,
        };
        await Results.Problem(title: "PARALLAX API request failed", detail: exception is ArgumentException or HttpRequestException ? exception.Message : "An unexpected error occurred.", statusCode: httpContext.Response.StatusCode).ExecuteAsync(httpContext);
        return true;
    }
}
