namespace GharLedger.Api.Dtos;

public record CreateHouseholdTransactionRequest(
    DateTime Date, string Type, string Category, decimal Amount, string? MemberName, string? Note);

public record HouseholdCashflowSummary(decimal Income, decimal Expenses, decimal NetIncome);