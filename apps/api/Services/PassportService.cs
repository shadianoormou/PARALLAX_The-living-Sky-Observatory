using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Parallax.Api.Contracts;
using Parallax.Api.Data;
using Parallax.Api.Models;

namespace Parallax.Api.Services;

public sealed class PassportService(ParallaxDbContext db)
{
    private static readonly (string Key, string Name, string Description)[] AchievementDefinitions =
    [
        ("first-light", "FIRST LIGHT", "Submit your first candidate classification."),
        ("sky-detective", "SKY DETECTIVE", "Identify an imaging artifact in the review flow."),
        ("spectral-explorer", "SPECTRAL EXPLORER", "Review a candidate with spectral evidence."),
        ("100-objects-reviewed", "100 OBJECTS REVIEWED", "Review one hundred candidate objects."),
    ];

    private static readonly HashSet<string> LearningModuleKeys =
    ["registration", "normalization", "differencing", "detection", "measurement", "uncertainty", "false-positives", "candidate-vs-discovery"];

    public async Task<PassportResponse> GetAsync(string actor, CancellationToken cancellationToken)
    {
        var user = await db.UserProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.ExternalKey == actor, cancellationToken);
        if (user is null) return EmptyResponse();

        var classifications = await db.Classifications.AsNoTracking()
            .Where(x => x.UserProfileId == user.Id)
            .Include(x => x.Candidate)
            .ThenInclude(x => x.Spectra)
            .ToListAsync(cancellationToken);
        var candidateIds = classifications.Select(x => x.CandidateId).Distinct().ToArray();
        var consensus = await db.ClassificationConsensuses.AsNoTracking()
            .Where(x => candidateIds.Contains(x.CandidateId))
            .ToListAsync(cancellationToken);
        var learningModules = await db.AuditEntries.AsNoTracking()
            .Where(x => x.ActorKey == actor && x.Action == "learning-module-completed")
            .Select(x => x.MetadataJson)
            .ToListAsync(cancellationToken);
        var completedModules = learningModules
            .Select(ParseModuleKey)
            .Where(key => key is not null)
            .Select(key => key!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(key => key)
            .ToArray();

        await EnsureAchievementsAsync(user.Id, classifications, cancellationToken);
        var achievements = await db.UserAchievements.AsNoTracking()
            .Where(x => x.UserProfileId == user.Id)
            .OrderBy(x => x.EarnedAtUtc)
            .Select(x => new AchievementResponse(x.Achievement.Key, x.Achievement.Name, x.Achievement.Description, x.EarnedAtUtc))
            .ToListAsync(cancellationToken);

        var topConsensus = consensus.GroupBy(x => x.CandidateId).ToDictionary(
            group => group.Key,
            group => group.Where(x => x.VoteCount == group.Max(item => item.VoteCount)).Select(x => x.ClassificationLabel).ToHashSet(StringComparer.OrdinalIgnoreCase));
        var reviewedCount = classifications.Count;
        return new PassportResponse(
            reviewedCount,
            reviewedCount,
            classifications.Where(x => x.Candidate.SkyRegionId.HasValue).Select(x => x.Candidate.SkyRegionId!.Value).Distinct().Count(),
            classifications.Count(x => topConsensus.TryGetValue(x.CandidateId, out var labels) && labels.Contains(x.Label)),
            classifications.Count(x => IsArtifact(x.Label)),
            completedModules.Length,
            completedModules,
            achievements);
    }

    public async Task<PassportResponse?> CompleteModuleAsync(string actor, string moduleKey, CancellationToken cancellationToken)
    {
        var normalizedKey = moduleKey.Trim().ToLowerInvariant();
        if (!LearningModuleKeys.Contains(normalizedKey)) return null;
        var existing = await db.AuditEntries.AsNoTracking().AnyAsync(x => x.ActorKey == actor && x.Action == "learning-module-completed" && x.MetadataJson.Contains($"\"moduleKey\":\"{normalizedKey}\""), cancellationToken);
        if (!existing)
        {
            db.AuditEntries.Add(new AuditEntry
            {
                Id = Guid.NewGuid(),
                Action = "learning-module-completed",
                ActorKey = actor,
                EntityType = "LearningModule",
                MetadataJson = JsonSerializer.Serialize(new { moduleKey = normalizedKey }),
                CreatedAtUtc = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(cancellationToken);
        }
        return await GetAsync(actor, cancellationToken);
    }

    private async Task EnsureAchievementsAsync(Guid userId, IReadOnlyCollection<Classification> classifications, CancellationToken cancellationToken)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (classifications.Count >= 1) keys.Add("first-light");
        if (classifications.Any(x => IsArtifact(x.Label))) keys.Add("sky-detective");
        if (classifications.Any(x => x.Candidate.Spectra.Count > 0)) keys.Add("spectral-explorer");
        if (classifications.Count >= 100) keys.Add("100-objects-reviewed");
        if (keys.Count == 0) return;

        var definitions = await db.Achievements.Where(x => keys.Contains(x.Key)).ToDictionaryAsync(x => x.Key, StringComparer.OrdinalIgnoreCase, cancellationToken);
        foreach (var definition in AchievementDefinitions.Where(x => keys.Contains(x.Key)))
        {
            if (!definitions.ContainsKey(definition.Key))
            {
                var achievement = new Achievement { Id = Guid.NewGuid(), Key = definition.Key, Name = definition.Name, Description = definition.Description };
                db.Achievements.Add(achievement);
                definitions[definition.Key] = achievement;
            }
        }

        var existing = await db.UserAchievements.AsNoTracking().Where(x => x.UserProfileId == userId && keys.Contains(x.Achievement.Key)).Select(x => x.Achievement.Key).ToListAsync(cancellationToken);
        foreach (var key in keys.Except(existing, StringComparer.OrdinalIgnoreCase))
        {
            db.UserAchievements.Add(new UserAchievement { Id = Guid.NewGuid(), UserProfileId = userId, AchievementId = definitions[key].Id, EarnedAtUtc = DateTime.UtcNow });
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    private static bool IsArtifact(string label) => label.Equals("imaging_artifact", StringComparison.OrdinalIgnoreCase) || label.Equals("likely_artifact", StringComparison.OrdinalIgnoreCase) || label.Equals("artifact", StringComparison.OrdinalIgnoreCase);

    private static string? ParseModuleKey(string json)
    {
        try { return JsonDocument.Parse(json).RootElement.TryGetProperty("moduleKey", out var value) ? value.GetString() : null; }
        catch (JsonException) { return null; }
    }

    private static PassportResponse EmptyResponse() => new(0, 0, 0, 0, 0, 0, [], []);
}
