using System.Net.Http.Json;
using System.Text.Json;
using Parallax.Api.Contracts;

namespace Parallax.Api.Services;

public interface IScienceServiceClient
{
    Task<ScienceAnalysisResponse> AnalyzeAsync(ScienceProcessRequest request, CancellationToken cancellationToken);
    Task<JsonElement> RunValidationAsync(CancellationToken cancellationToken);
}

public sealed class ScienceServiceClient(HttpClient httpClient, ILogger<ScienceServiceClient> logger) : IScienceServiceClient
{
    public async Task<ScienceAnalysisResponse> AnalyzeAsync(ScienceProcessRequest request, CancellationToken cancellationToken)
    {
        using var response = await httpClient.PostAsJsonAsync("process/analyze", request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Science service returned {StatusCode}: {Body}", response.StatusCode, body);
            throw new HttpRequestException($"Science service returned {(int)response.StatusCode}: {body}");
        }

        return System.Text.Json.JsonSerializer.Deserialize<ScienceAnalysisResponse>(body)
            ?? throw new InvalidOperationException("Science service returned an empty analysis response.");
    }

    public async Task<JsonElement> RunValidationAsync(CancellationToken cancellationToken)
    {
        using var response = await httpClient.PostAsync("validate/run", content: null, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Science validation returned {StatusCode}: {Body}", response.StatusCode, body);
            throw new HttpRequestException($"Science validation returned {(int)response.StatusCode}: {body}");
        }

        using var document = JsonDocument.Parse(body);
        return document.RootElement.Clone();
    }
}
