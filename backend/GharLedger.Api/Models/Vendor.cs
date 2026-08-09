using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GharLedger.Api.Models;

/// <summary>A recurring supplier a household logs daily deliveries against (milk, newspaper, maid, …).</summary>
public class Vendor
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("householdId")]
    public string HouseholdId { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>The unit a quantity is measured in — "liter", "piece", "visit", etc. Display-only.</summary>
    [BsonElement("unit")]
    public string Unit { get; set; } = "unit";

    [BsonElement("ratePerUnit")]
    public decimal RatePerUnit { get; set; }

    [BsonElement("rates")]
    public List<VendorRate> Rates { get; set; } = [];

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class VendorRate
{
    [BsonElement("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("effectiveFrom")]
    public DateTime EffectiveFrom { get; set; }

    [BsonElement("effectiveTo")]
    public DateTime? EffectiveTo { get; set; }
}
