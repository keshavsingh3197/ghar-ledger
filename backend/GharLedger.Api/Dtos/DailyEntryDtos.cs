namespace GharLedger.Api.Dtos;

public record CreateDailyEntryRequest(string VendorId, DateTime Date, decimal Quantity, string? Note);

public record UpdateDailyEntryRequest(decimal Quantity, string? Note);

/// <summary>One vendor's rolled-up total for a month, used by the monthly summary view.</summary>
public record MonthlyVendorTotal(string VendorId, string VendorName, decimal TotalQuantity, decimal TotalAmount);
