using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Parallax.Api.Contracts;
using Parallax.Api.Data;
using Parallax.Api.Models;
using Parallax.Api.Services;
using Xunit;

namespace Parallax.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        connection.Open();
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ParallaxDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<ParallaxDbContext>>();
            services.AddDbContext<ParallaxDbContext>(options => options.UseSqlite(connection));
            services.RemoveAll<IScienceServiceClient>();
            services.AddSingleton<IScienceServiceClient, FakeScienceServiceClient>();
            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ParallaxDbContext>();
            db.Database.EnsureCreated();
            Seed(db);
        });
    }

    private static void Seed(ParallaxDbContext db)
    {
        var source = new DatasetSource { Id = Guid.NewGuid(), Name = "Demo source", DatasetType = "synthetic-demo", Label = "DEMONSTRATION DATASET", SourceIdentifier = "seed-source", CreatedAtUtc = DateTime.UtcNow };
        var run = new ProcessingRun { Id = Guid.NewGuid(), DatasetSource = source, AlgorithmVersion = "test", Status = "completed", StartedAtUtc = DateTime.UtcNow, CompletedAtUtc = DateTime.UtcNow, ParametersJson = "{}", ResultJson = "{\"epochs\":{\"a\":{\"epoch\":\"A\"},\"b\":{\"epoch\":\"B\"}}}" };
        var candidate = new Candidate { Id = Guid.NewGuid(), ProcessingRun = run, CandidateKey = "motion-001", Classification = "apparent_motion", Interpretation = "possible apparent motion; requires additional verification", Status = "candidate", CreatedAtUtc = DateTime.UtcNow };
        candidate.Measurements.Add(new CandidateMeasurement { Id = Guid.NewGuid(), Candidate = candidate, MetricName = "measurement.displacement_pixels_xy", MetadataJson = "[4.5,-3.2]" });
        db.Add(candidate);
        db.SaveChanges();
    }

    public Guid CandidateId
    {
        get
        {
            using var scope = Services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<ParallaxDbContext>().Candidates.OrderBy(x => x.CreatedAtUtc).First().Id;
        }
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        connection.Dispose();
    }
}

public sealed class FakeScienceServiceClient : IScienceServiceClient
{
    public Task<ScienceAnalysisResponse> AnalyzeAsync(ScienceProcessRequest request, CancellationToken cancellationToken)
    {
        var epoch = JsonSerializer.SerializeToElement(new { dataset_label = "DEMONSTRATION DATASET", dataset_id = "synthetic-demo", observation_id = "synthetic-epoch-a", epoch = "A", shape = new[] { 128, 128 }, coordinate_frame = "synthetic tangent-plane pixels", pixel_scale_arcsec = 0.4 });
        var epochB = JsonSerializer.SerializeToElement(new { dataset_label = "DEMONSTRATION DATASET", dataset_id = "synthetic-demo", observation_id = "synthetic-epoch-b", epoch = "B", shape = new[] { 128, 128 }, coordinate_frame = "synthetic tangent-plane pixels", pixel_scale_arcsec = 0.4 });
        return Task.FromResult(new ScienceAnalysisResponse
        {
            DatasetLabel = "DEMONSTRATION DATASET",
            Epochs = new Dictionary<string, JsonElement> { ["a"] = epoch, ["b"] = epochB },
            Candidates = [new ScienceCandidate { CandidateId = "motion-001", Classification = "apparent_motion", Interpretation = "possible apparent motion; requires additional verification", Measurement = new() { ["displacement_pixels_xy"] = JsonSerializer.SerializeToElement(new[] { 4.5, -3.2 }) }, Quality = new() { ["registration_error"] = JsonSerializer.SerializeToElement(0.04) } }],
            ScreenedCandidates = [
                new ScienceReviewItem { CandidateId = "artifact-001", Classification = "likely_artifact", Status = "screened", Interpretation = "elongated residual; likely artifact; not promoted for citizen-science classification", Measurement = new() { ["shape_ratio"] = JsonSerializer.SerializeToElement(3.4) }, Quality = new() { ["component_snr"] = JsonSerializer.SerializeToElement(12.0) } },
                new ScienceReviewItem { CandidateId = "uncertain-001", Classification = "uncertain", Status = "needs_review", Interpretation = "low-SNR residual; requires additional verification", Measurement = new() { ["position_xy"] = JsonSerializer.SerializeToElement(new[] { 63.0, 106.0 }) }, Quality = new() { ["component_snr"] = JsonSerializer.SerializeToElement(4.2), ["promotion_threshold_sigma"] = JsonSerializer.SerializeToElement(5.0) } },
            ],
            SpectralComparison = [],
        });
    }
}

public class ApiIntegrationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;

    public ApiIntegrationTests(ApiFactory factory) => this.factory = factory;

    [Fact]
    public async Task Candidate_detail_and_measurements_are_retrievable()
    {
        using var client = factory.CreateClient();
        var id = factory.CandidateId;
        var detail = await client.GetFromJsonAsync<CandidateDetail>($"/api/candidates/{id}");
        var measurements = await client.GetFromJsonAsync<List<MeasurementResponse>>($"/api/candidates/{id}/measurements");
        var spectrum = await client.GetFromJsonAsync<List<SpectrumResponse>>($"/api/candidates/{id}/spectrum");
        var provenance = await client.GetFromJsonAsync<ProvenanceResponse>($"/api/candidates/{id}/provenance");
        Assert.Equal("DEMONSTRATION DATASET", detail!.DatasetLabel);
        Assert.Contains(measurements!, measurement => measurement.MetricName.Contains("displacement", StringComparison.Ordinal));
        Assert.Empty(spectrum!);
        Assert.Equal("seed-source", provenance!.SourceIdentifier);
        Assert.Equal("A", provenance.EpochA.GetProperty("epoch").GetString());
        Assert.Equal("B", provenance.EpochB.GetProperty("epoch").GetString());
    }

    [Fact]
    public async Task Classification_persists_and_consensus_requires_a_vote()
    {
        using var client = factory.CreateClient();
        var id = factory.CandidateId;
        var before = await client.GetAsync($"/api/candidates/{id}/consensus");
        Assert.Equal(HttpStatusCode.Forbidden, before.StatusCode);
        var post = await client.PostAsJsonAsync("/api/classifications", new ClassificationRequest(id, "moving", "demo review", "HIGH"));
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var saved = await post.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("HIGH", saved.GetProperty("confidence").GetString());
        var after = await client.GetFromJsonAsync<List<ConsensusResponse>>($"/api/candidates/{id}/consensus");
        Assert.Equal("moving", after!.Single().ClassificationLabel);
    }

    [Fact]
    public async Task Passport_updates_after_review_and_learning_module()
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Demo-User", "passport-test-user");
        var id = factory.CandidateId;
        var post = await client.PostAsJsonAsync("/api/classifications", new ClassificationRequest(id, "uncertain", Confidence: "LOW"));
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);

        var passport = await client.GetFromJsonAsync<PassportResponse>("/api/passport");
        Assert.Equal(1, passport!.ObjectsInspected);
        Assert.Equal(1, passport.CandidatesReviewed);
        Assert.Equal(1, passport.ConsensusMatches);
        Assert.Contains(passport.Achievements, achievement => achievement.Key == "first-light");

        var module = await client.PostAsync("/api/passport/modules/uncertainty", content: null);
        Assert.Equal(HttpStatusCode.OK, module.StatusCode);
        var updated = await module.Content.ReadFromJsonAsync<PassportResponse>();
        Assert.Equal(1, updated!.LearningModulesCompleted);
        Assert.Contains("uncertainty", updated.LearningModules);
    }

    [Fact]
    public async Task Demo_analysis_trigger_persists_a_processing_run()
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/demo/run-analysis", new DemoRunRequest());
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        var run = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("completed", run.GetProperty("status").GetString());
        Assert.Equal(3, run.GetProperty("candidateCount").GetInt32());
        var candidates = await client.GetFromJsonAsync<List<CandidateListItem>>("/api/candidates");
        Assert.Contains(candidates!, candidate => candidate.CandidateKey == "PX-DEMO-017" && candidate.Classification == "apparent_motion");
        Assert.Contains(candidates!, candidate => candidate.Classification == "likely_artifact" && candidate.Status == "screened");
        Assert.Contains(candidates!, candidate => candidate.Classification == "uncertain" && candidate.Status == "needs_review");
    }

    [Fact]
    public async Task Swagger_document_is_available()
    {
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Classification_rejects_unknown_confidence_without_persisting_it()
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/classifications", new ClassificationRequest(factory.CandidateId, "uncertain", Confidence: "certain"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
