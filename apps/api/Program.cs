using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parallax.Api;
using Parallax.Api.Data;
using Parallax.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var corsOrigins = builder.Configuration["PARALLAX_CORS_ORIGINS"]?
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? ["http://localhost:3000"];

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));
var databaseProvider = builder.Configuration["PARALLAX_DATABASE_PROVIDER"]?.Trim().ToLowerInvariant() ?? "sqlserver";
builder.Services.AddDbContext<ParallaxDbContext>(options =>
{
    if (databaseProvider == "sqlite")
    {
        options.UseSqlite(builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=data/parallax-dev.db");
    }
    else if (databaseProvider is "postgres" or "postgresql")
    {
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required for PostgreSQL.");
        options.UseNpgsql(NormalizePostgresConnectionString(connectionString));
    }
    else
    {
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required for SQL Server."));
    }
});
builder.Services.AddHttpClient<IScienceServiceClient, ScienceServiceClient>((serviceProvider, client) =>
{
    var baseUrl = serviceProvider.GetRequiredService<IConfiguration>()["ScienceService:BaseUrl"] ?? "http://localhost:8001/";
    client.BaseAddress = new Uri(NormalizeServiceUrl(baseUrl), UriKind.Absolute);
    var timeoutSeconds = serviceProvider.GetRequiredService<IConfiguration>().GetValue("ScienceService:TimeoutSeconds", 300);
    client.Timeout = TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 30, 900));
});
builder.Services.AddScoped<DemoAnalysisService>();
builder.Services.AddScoped<ConsensusService>();
builder.Services.AddScoped<PassportService>();
builder.Services.AddSingleton<ApiMetrics>();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var requireApiKey = builder.Configuration.GetValue<bool?>("PARALLAX_REQUIRE_API_KEY") ?? builder.Environment.IsProduction();
if (requireApiKey && string.IsNullOrWhiteSpace(builder.Configuration["PARALLAX_API_KEY"]))
    throw new InvalidOperationException("PARALLAX_API_KEY must be configured when PARALLAX_REQUIRE_API_KEY=true.");

var app = builder.Build();
app.UseExceptionHandler();
app.UseRateLimiter();
app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();

app.Use(async (context, next) =>
{
    var mutatingApiRequest = context.Request.Path.StartsWithSegments("/api") && context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE";
    if (requireApiKey && mutatingApiRequest && !ApiKeyGuard.IsValid(context.Request, builder.Configuration))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await Results.Problem(title: "API authentication required", detail: "Supply a valid X-API-Key or Bearer token.", statusCode: StatusCodes.Status401Unauthorized).ExecuteAsync(context);
        return;
    }
    await next();
});

app.Use(async (context, next) =>
{
    var metrics = context.RequestServices.GetRequiredService<ApiMetrics>();
    var timer = metrics.BeginRequest();
    try { await next(); }
    finally { metrics.RecordRequest(context.Response.StatusCode, timer); }
});

if (builder.Configuration.GetValue<bool>("PARALLAX_APPLY_MIGRATIONS"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<ParallaxDbContext>();
    if (databaseProvider is "sqlite" or "postgres" or "postgresql") await db.Database.EnsureCreatedAsync();
    else await db.Database.MigrateAsync();
}

app.MapGet("/health", () => Results.Ok(new { service = "parallax-api", status = "ok", phase = "persistence-and-integration" }));
app.MapGet("/api/v1/health", () => Results.Ok(new { service = "parallax-api", status = "ok", phase = "persistence-and-integration" }));
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { status = report.Status.ToString().ToLowerInvariant(), checks = report.Entries.ToDictionary(item => item.Key, item => item.Value.Status.ToString().ToLowerInvariant()) });
    },
});
app.MapGet("/metrics", (ApiMetrics metrics) => Results.Text(metrics.ToPrometheus(), "text/plain; version=0.0.4"));
app.MapGet("/api/ops/metrics", (ApiMetrics metrics) => Results.Ok(metrics.Snapshot()));
app.MapParallaxEndpoints();

app.Run();

static string NormalizeServiceUrl(string value)
{
    var candidate = value.Trim();
    if (!candidate.Contains("://", StringComparison.Ordinal))
    {
        var scheme = candidate.EndsWith(".onrender.com", StringComparison.OrdinalIgnoreCase) ? "https" : "http";
        candidate = $"{scheme}://{candidate}";
    }
    return candidate.EndsWith('/') ? candidate : $"{candidate}/";
}

static string NormalizePostgresConnectionString(string value)
{
    var candidate = value.Trim();
    if (!candidate.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !candidate.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)) return candidate;

    var uri = new Uri(candidate);
    var userInfo = uri.UserInfo.Split(':', 2, StringSplitOptions.None);
    if (userInfo.Length != 2) throw new InvalidOperationException("PostgreSQL URL must include username and password.");

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.IsDefaultPort ? 5432 : uri.Port,
        Database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/')),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = Uri.UnescapeDataString(userInfo[1]),
        SslMode = SslMode.Require,
    };
    return builder.ConnectionString;
}

public partial class Program;
