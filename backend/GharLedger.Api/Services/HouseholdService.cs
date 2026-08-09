using GharLedger.Api.Models;
using MongoDB.Driver;

namespace GharLedger.Api.Services;

public sealed class HouseholdService
{
    private readonly IMongoCollection<Household> _households;

    public HouseholdService(MongoDbService db)
    {
        _households = db.GetCollection<Household>("households");
    }

    public async Task EnsureIndexesAsync(CancellationToken ct = default)
    {
        await _households.Indexes.CreateOneAsync(new CreateIndexModel<Household>(
            Builders<Household>.IndexKeys.Ascending(x => x.MemberUserIds)),
            cancellationToken: ct);
    }

    /// <summary>Every household the caller belongs to.</summary>
    public async Task<List<Household>> ListForUserAsync(string userId, CancellationToken ct = default) =>
        await _households.Find(x => x.MemberUserIds.Contains(userId)).ToListAsync(ct);

    public async Task<Household?> GetByIdAsync(string id, CancellationToken ct = default) =>
        await _households.Find(x => x.Id == id).FirstOrDefaultAsync(ct);

    public async Task<bool> IsMemberAsync(string householdId, string userId, CancellationToken ct = default) =>
        await _households.Find(x => x.Id == householdId && x.MemberUserIds.Contains(userId))
            .AnyAsync(ct);

    /// <summary>Creates a household with the caller as its first member.</summary>
    public async Task<Household> CreateAsync(string name, string creatorUserId, CancellationToken ct = default)
    {
        var household = new Household
        {
            Name = name,
            MemberUserIds = new List<string> { creatorUserId },
            CreatedAt = DateTime.UtcNow,
        };
        await _households.InsertOneAsync(household, cancellationToken: ct);
        return household;
    }

    public async Task<bool> AddMemberAsync(string householdId, string userId, CancellationToken ct = default)
    {
        var update = Builders<Household>.Update.AddToSet(x => x.MemberUserIds, userId);
        var result = await _households.UpdateOneAsync(x => x.Id == householdId, update, cancellationToken: ct);
        return result.IsAcknowledged && result.MatchedCount > 0;
    }

    public async Task<bool> RemoveMemberAsync(string householdId, string userId, CancellationToken ct = default)
    {
        var update = Builders<Household>.Update.Pull(x => x.MemberUserIds, userId);
        var result = await _households.UpdateOneAsync(x => x.Id == householdId, update, cancellationToken: ct);
        return result.IsAcknowledged && result.MatchedCount > 0;
    }
}
