using Microsoft.Extensions.Diagnostics.HealthChecks;
using Parallax.Api.Data;

namespace Parallax.Api.Services;

public sealed class DatabaseHealthCheck(ParallaxDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy("Database connection is available.")
                : HealthCheckResult.Unhealthy("Database connection is unavailable.");
        }
        catch (Exception error)
        {
            return HealthCheckResult.Unhealthy("Database health check failed.", error);
        }
    }
}
