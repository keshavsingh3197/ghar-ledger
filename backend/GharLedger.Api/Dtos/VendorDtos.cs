namespace GharLedger.Api.Dtos;

public record CreateVendorRequest(string Name, string Unit, decimal RatePerUnit);

public record UpdateVendorRequest(string Name, string Unit, decimal RatePerUnit, bool IsActive);

public record CreateVendorRateRequest(decimal Amount, DateTime EffectiveFrom, DateTime? EffectiveTo);
