using GharLedger.Api.Models;
using MongoDB.Driver;

namespace GharLedger.Api.Services;

public sealed class VendorService
{
    private readonly IMongoCollection<Vendor> _vendors;

    public VendorService(MongoDbService db)
    {
        _vendors = db.GetCollection<Vendor>("vendors");
    }

    public async Task EnsureIndexesAsync(CancellationToken ct = default)
    {
        await _vendors.Indexes.CreateOneAsync(new CreateIndexModel<Vendor>(
            Builders<Vendor>.IndexKeys.Ascending(x => x.HouseholdId)),
            cancellationToken: ct);
    }

    public async Task<List<Vendor>> ListForHouseholdAsync(string householdId, CancellationToken ct = default) =>
        await _vendors.Find(x => x.HouseholdId == householdId).SortBy(x => x.Name).ToListAsync(ct);

    public async Task<Vendor?> GetByIdAsync(string id, CancellationToken ct = default) =>
        await _vendors.Find(x => x.Id == id).FirstOrDefaultAsync(ct);

    public async Task<Vendor> CreateAsync(string householdId, string name, string unit, decimal ratePerUnit, CancellationToken ct = default)
    {
        var vendor = new Vendor
        {
            HouseholdId = householdId,
            Name = name,
            Unit = unit,
            RatePerUnit = ratePerUnit,
            CreatedAt = DateTime.UtcNow,
        };
        await _vendors.InsertOneAsync(vendor, cancellationToken: ct);
        return vendor;
    }

    public async Task<bool> UpdateAsync(string id, string name, string unit, decimal ratePerUnit, bool isActive, CancellationToken ct = default)
    {
        var update = Builders<Vendor>.Update
            .Set(x => x.Name, name)
            .Set(x => x.Unit, unit)
            .Set(x => x.RatePerUnit, ratePerUnit)
            .Set(x => x.IsActive, isActive);
        var result = await _vendors.UpdateOneAsync(x => x.Id == id, update, cancellationToken: ct);
        return result.IsAcknowledged && result.MatchedCount > 0;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var result = await _vendors.DeleteOneAsync(x => x.Id == id, ct);
        return result.IsAcknowledged && result.DeletedCount > 0;
    }
}
