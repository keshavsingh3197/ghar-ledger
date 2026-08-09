using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using MongoDB.Driver;

namespace GharLedger.Api.Services;

public sealed class DailyEntryService
{
    private readonly IMongoCollection<DailyEntry> _entries;
    private readonly VendorService _vendors;

    public DailyEntryService(MongoDbService db, VendorService vendors)
    {
        _entries = db.GetCollection<DailyEntry>("daily_entries");
        _vendors = vendors;
    }

    public async Task EnsureIndexesAsync(CancellationToken ct = default)
    {
        await _entries.Indexes.CreateOneAsync(new CreateIndexModel<DailyEntry>(
            Builders<DailyEntry>.IndexKeys.Ascending(x => x.HouseholdId).Descending(x => x.Date)),
            cancellationToken: ct);
    }

    public async Task<List<DailyEntry>> ListAsync(
        string householdId, DateTime from, DateTime to, CancellationToken ct = default) =>
        await _entries.Find(x => x.HouseholdId == householdId && x.Date >= from && x.Date <= to)
            .SortByDescending(x => x.Date).ToListAsync(ct);

    public async Task<DailyEntry?> GetByIdAsync(string id, CancellationToken ct = default) =>
        await _entries.Find(x => x.Id == id).FirstOrDefaultAsync(ct);

    public async Task<DailyEntry> CreateAsync(string householdId, CreateDailyEntryRequest req, CancellationToken ct = default)
    {
        var vendor = await _vendors.GetByIdAsync(req.VendorId, ct)
            ?? throw new InvalidOperationException("Vendor not found.");

        var entry = new DailyEntry
        {
            HouseholdId = householdId,
            VendorId = req.VendorId,
            Date = req.Date.Date,
            Quantity = req.Quantity,
            Amount = req.Quantity * vendor.RatePerUnit,
            Note = req.Note,
            CreatedAt = DateTime.UtcNow,
        };
        await _entries.InsertOneAsync(entry, cancellationToken: ct);
        return entry;
    }

    public async Task<bool> UpdateAsync(string id, decimal quantity, string? note, CancellationToken ct = default)
    {
        var existing = await GetByIdAsync(id, ct);
        if (existing is null) return false;

        var vendor = await _vendors.GetByIdAsync(existing.VendorId, ct);
        var amount = vendor is null ? existing.Amount : quantity * vendor.RatePerUnit;

        var update = Builders<DailyEntry>.Update
            .Set(x => x.Quantity, quantity)
            .Set(x => x.Amount, amount)
            .Set(x => x.Note, note);
        var result = await _entries.UpdateOneAsync(x => x.Id == id, update, cancellationToken: ct);
        return result.IsAcknowledged && result.MatchedCount > 0;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var result = await _entries.DeleteOneAsync(x => x.Id == id, ct);
        return result.IsAcknowledged && result.DeletedCount > 0;
    }

    /// <summary>Per-vendor totals for the given date range — the household's monthly bill breakdown.</summary>
    public async Task<List<MonthlyVendorTotal>> MonthlyTotalsAsync(
        string householdId, DateTime from, DateTime to, CancellationToken ct = default)
    {
        var entries = await ListAsync(householdId, from, to, ct);
        var vendors = await _vendors.ListForHouseholdAsync(householdId, ct);
        var vendorNames = vendors.ToDictionary(v => v.Id ?? "", v => v.Name);

        return entries
            .GroupBy(e => e.VendorId)
            .Select(g => new MonthlyVendorTotal(
                g.Key,
                vendorNames.TryGetValue(g.Key, out var name) ? name : "(deleted vendor)",
                g.Sum(e => e.Quantity),
                g.Sum(e => e.Amount)))
            .OrderByDescending(t => t.TotalAmount)
            .ToList();
    }
}
