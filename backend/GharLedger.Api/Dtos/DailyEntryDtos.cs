namespace GharLedger.Api.Dtos;

public record CreateDailyEntryRequest(
	string VendorId,
	DateTime Date,
	decimal Quantity,
	string? Note,
	decimal? RatePerUnit = null,
	string? Period = null,
	decimal PaidAmount = 0);

public record UpdateDailyEntryRequest(
	DateTime Date,
	decimal Quantity,
	decimal RatePerUnit,
	string? Period,
	string? Note,
	decimal PaidAmount = 0);

/// <summary>One vendor's rolled-up total for a month, used by the monthly summary view.</summary>
public record MonthlyVendorTotal(
	string VendorId,
	string VendorName,
	int EntryCount,
	decimal TotalQuantity,
	decimal TotalAmount,
	decimal TotalPaid,
	decimal Balance);
