using Microsoft.EntityFrameworkCore;
using Parallax.Api.Data;
using Parallax.Api.Models;

namespace Parallax.Api.Services;

public sealed class ConsensusService(ParallaxDbContext db)
{
    public async Task RecalculateAsync(Guid candidateId, CancellationToken cancellationToken)
    {
        var votes = await db.Classifications.Where(x => x.CandidateId == candidateId).ToListAsync(cancellationToken);
        var existing = await db.ClassificationConsensuses.Where(x => x.CandidateId == candidateId).ToListAsync(cancellationToken);
        db.ClassificationConsensuses.RemoveRange(existing);
        if (votes.Count == 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        foreach (var group in votes.GroupBy(x => x.Label, StringComparer.OrdinalIgnoreCase))
        {
            db.ClassificationConsensuses.Add(new ClassificationConsensus
            {
                Id = Guid.NewGuid(),
                CandidateId = candidateId,
                ClassificationLabel = group.Key,
                VoteCount = group.Count(),
                TotalVotes = votes.Count,
                AgreementFraction = (double)group.Count() / votes.Count,
                CalculatedAtUtc = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}
