using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;

namespace Parallax.Api.Services;

public sealed class ApiMetrics
{
    private readonly DateTime startedAtUtc = DateTime.UtcNow;
    private long requestCount;
    private long errorCount;
    private long totalDurationMilliseconds;
    private readonly ConcurrentDictionary<int, long> statusCounts = new();

    public long RequestCount => Interlocked.Read(ref requestCount);
    public long ErrorCount => Interlocked.Read(ref errorCount);
    public DateTime StartedAtUtc => startedAtUtc;

    public Stopwatch BeginRequest() => Stopwatch.StartNew();

    public void RecordRequest(int statusCode, Stopwatch timer)
    {
        Interlocked.Increment(ref requestCount);
        if (statusCode >= 500) Interlocked.Increment(ref errorCount);
        Interlocked.Add(ref totalDurationMilliseconds, timer.ElapsedMilliseconds);
        statusCounts.AddOrUpdate(statusCode, 1, (_, current) => current + 1);
    }

    public object Snapshot() => new
    {
        startedAtUtc,
        uptimeSeconds = Math.Max(0, (DateTime.UtcNow - startedAtUtc).TotalSeconds),
        requests = RequestCount,
        errors = ErrorCount,
        averageLatencyMs = RequestCount == 0 ? 0 : (double)Interlocked.Read(ref totalDurationMilliseconds) / RequestCount,
        statusCodes = statusCounts.OrderBy(item => item.Key).ToDictionary(item => item.Key.ToString(CultureInfo.InvariantCulture), item => item.Value),
    };

    public string ToPrometheus()
    {
        var uptime = Math.Max(0, (DateTime.UtcNow - startedAtUtc).TotalSeconds).ToString("F3", CultureInfo.InvariantCulture);
        var average = RequestCount == 0 ? 0 : (double)Interlocked.Read(ref totalDurationMilliseconds) / RequestCount;
        return $"# HELP parallax_api_uptime_seconds Process uptime in seconds\n# TYPE parallax_api_uptime_seconds gauge\nparallax_api_uptime_seconds {uptime}\n# HELP parallax_api_requests_total HTTP requests observed by the API process\n# TYPE parallax_api_requests_total counter\nparallax_api_requests_total {RequestCount}\n# HELP parallax_api_errors_total HTTP 5xx responses observed by the API process\n# TYPE parallax_api_errors_total counter\nparallax_api_errors_total {ErrorCount}\n# HELP parallax_api_average_latency_ms Average request latency in milliseconds\n# TYPE parallax_api_average_latency_ms gauge\nparallax_api_average_latency_ms {average.ToString("F3", CultureInfo.InvariantCulture)}\n";
    }
}
