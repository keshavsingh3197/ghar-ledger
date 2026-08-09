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
        await _entries.Find(x => x.HouseholdId == householdId && x.Date >= from && x.Date < to)
            .SortByDescending(x => x.Date).ToListAsync(ct);

    public async Task<DailyEntry?> GetByIdAsync(string id, CancellationToken ct = default) =>
        await _entries.Find(x => x.Id == id).FirstOrDefaultAsync(ct);

    public async Task<DailyEntry> CreateAsync(string householdId, CreateDailyEntryRequest req, CancellationToken ct = default)
    {
        var vendor = await _vendors.GetByIdAsync(req.VendorId, ct)
            ?? throw new InvalidOperationException("Vendor not found.");
        var ratePerUnit = req.RatePerUnit ?? vendor.RatePerUnit;
        if (req.Quantity <= 0) throw new InvalidOperationException("Quantity must be greater than zero.");
        if (ratePerUnit < 0) throw new InvalidOperationException("Rate cannot be negative.");
        if (req.PaidAmount < 0) throw new InvalidOperationException("Paid amount cannot be negative.");

        var entry = new DailyEntry
        {
            HouseholdId = householdId,
            VendorId = req.VendorId,
            Date = req.Date.ToUniversalTime(),
            Period = NormalizePeriod(req.Period),
            Quantity = req.Quantity,
            RatePerUnit = ratePerUnit,
            Amount = req.Quantity * ratePerUnit,
            PaidAmount = req.PaidAmount,
            Note = req.Note,
            CreatedAt = DateTime.UtcNow,
        };
        await _entries.InsertOneAsync(entry, cancellationToken: ct);
        return entry;
    }

    public async Task<bool> UpdateAsync(string id, UpdateDailyEntryRequest req, CancellationToken ct = default)
    {
        var existing = await GetByIdAsync(id, ct);
        if (existing is null) return false;
        if (req.Quantity <= 0) throw new InvalidOperationException("Quantity must be greater than zero.");
        if (req.RatePerUnit < 0) throw new InvalidOperationException("Rate cannot be negative.");
        if (req.PaidAmount < 0) throw new InvalidOperationException("Paid amount cannot be negative.");

        var update = Builders<DailyEntry>.Update
            .Set(x => x.Date, req.Date.ToUniversalTime())
            .Set(x => x.Period, NormalizePeriod(req.Period))
            .Set(x => x.Quantity, req.Quantity)
            .Set(x => x.RatePerUnit, req.RatePerUnit)
            .Set(x => x.Amount, req.Quantity * req.RatePerUnit)
            .Set(x => x.PaidAmount, req.PaidAmount)
            .Set(x => x.Note, req.Note);
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
                g.Count(),
                g.Sum(e => e.Quantity),
                g.Sum(e => e.Amount),
                g.Sum(e => e.PaidAmount),
                g.Sum(e => e.Amount - e.PaidAmount)))
            .OrderByDescending(t => t.TotalAmount)
            .ToList();
    }

    private static string NormalizePeriod(string? period) => period?.Trim().ToLowerInvariant() switch
    {
        "morning" or "am" => "Morning",
        "evening" or "pm" => "Evening",
        _ => "Anytime",
    };
}
