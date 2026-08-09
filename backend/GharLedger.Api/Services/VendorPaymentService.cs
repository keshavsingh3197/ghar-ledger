using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using MongoDB.Driver;

namespace GharLedger.Api.Services;

public sealed class VendorPaymentService
{
    private readonly IMongoCollection<VendorPayment> _payments;
    private readonly VendorService _vendors;

    public VendorPaymentService(MongoDbService db, VendorService vendors)
    {
        _payments = db.GetCollection<VendorPayment>("vendor_payments");
        _vendors = vendors;
    }

    public async Task EnsureIndexesAsync(CancellationToken ct = default) =>
        await _payments.Indexes.CreateOneAsync(new CreateIndexModel<VendorPayment>(
            Builders<VendorPayment>.IndexKeys.Ascending(x => x.HouseholdId).Descending(x => x.Date)),
            cancellationToken: ct);

    public async Task<List<VendorPayment>> ListAsync(
        string householdId, DateTime from, DateTime to, CancellationToken ct = default) =>
        await _payments.Find(x => x.HouseholdId == householdId && x.Date >= from && x.Date < to)
            .SortByDescending(x => x.Date).ToListAsync(ct);

    public async Task<VendorPayment?> GetByIdAsync(string id, CancellationToken ct = default) =>
        await _payments.Find(x => x.Id == id).FirstOrDefaultAsync(ct);

    public async Task<VendorPayment> CreateAsync(
        string householdId, CreateVendorPaymentRequest request, CancellationToken ct = default)
    {
        var vendor = await _vendors.GetByIdAsync(request.VendorId, ct);
        if (vendor is null || vendor.HouseholdId != householdId)
            throw new InvalidOperationException("Vendor not found.");
        if (request.Amount <= 0) throw new InvalidOperationException("Payment must be greater than zero.");

        var payment = new VendorPayment
        {
            HouseholdId = householdId,
            VendorId = request.VendorId,
            Date = request.Date.ToUniversalTime(),
            Amount = request.Amount,
            Note = request.Note,
        };
        await _payments.InsertOneAsync(payment, cancellationToken: ct);
        return payment;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var result = await _payments.DeleteOneAsync(x => x.Id == id, ct);
        return result.IsAcknowledged && result.DeletedCount > 0;
    }
}