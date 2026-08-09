namespace GharLedger.Api.Dtos;

public record CreateVendorPaymentRequest(string VendorId, DateTime Date, decimal Amount, string? Note);