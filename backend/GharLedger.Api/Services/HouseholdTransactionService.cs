using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using MongoDB.Driver;

namespace GharLedger.Api.Services;

public sealed class HouseholdTransactionService
{
    private readonly IMongoCollection<HouseholdTransaction> _transactions;

    public HouseholdTransactionService(MongoDbService db) =>
        _transactions = db.GetCollection<HouseholdTransaction>("household_transactions");

    public async Task EnsureIndexesAsync(CancellationToken ct = default) =>
        await _transactions.Indexes.CreateOneAsync(new CreateIndexModel<HouseholdTransaction>(
            Builders<HouseholdTransaction>.IndexKeys.Ascending(x => x.HouseholdId).Descending(x => x.Date)),
            cancellationToken: ct);

    public async Task<List<HouseholdTransaction>> ListAsync(
        string householdId, DateTime from, DateTime to, CancellationToken ct = default) =>
        await _transactions.Find(x => x.HouseholdId == householdId && x.Date >= from && x.Date < to)
            .SortByDescending(x => x.Date).ToListAsync(ct);

    public async Task<HouseholdTransaction?> GetByIdAsync(string id, CancellationToken ct = default) =>
        await _transactions.Find(x => x.Id == id).FirstOrDefaultAsync(ct);

    public async Task<HouseholdTransaction> CreateAsync(
        string householdId, CreateHouseholdTransactionRequest request, CancellationToken ct = default)
    {
        var type = request.Type.Trim().ToLowerInvariant() switch
        {
            "income" => "Income",
            "expense" => "Expense",
            _ => throw new InvalidOperationException("Type must be Income or Expense."),
        };
        if (request.Amount <= 0) throw new InvalidOperationException("Amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(request.Category)) throw new InvalidOperationException("Category is required.");

        var transaction = new HouseholdTransaction
        {
            HouseholdId = householdId,
            Date = request.Date.ToUniversalTime(),
            Type = type,
            Category = request.Category.Trim(),
            Amount = request.Amount,
            MemberName = string.IsNullOrWhiteSpace(request.MemberName) ? null : request.MemberName.Trim(),
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
        };
        await _transactions.InsertOneAsync(transaction, cancellationToken: ct);
        return transaction;
    }

    public async Task<HouseholdCashflowSummary> SummaryAsync(
        string householdId, DateTime from, DateTime to, CancellationToken ct = default)
    {
        var transactions = await ListAsync(householdId, from, to, ct);
        var income = transactions.Where(x => x.Type == "Income").Sum(x => x.Amount);
        var expenses = transactions.Where(x => x.Type == "Expense").Sum(x => x.Amount);
        return new HouseholdCashflowSummary(income, expenses, income - expenses);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var result = await _transactions.DeleteOneAsync(x => x.Id == id, ct);
        return result.IsAcknowledged && result.DeletedCount > 0;
    }
}