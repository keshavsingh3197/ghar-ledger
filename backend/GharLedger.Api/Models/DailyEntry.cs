using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GharLedger.Api.Models;

/// <summary>
/// One day's delivery/quantity from one vendor. <see cref="Amount"/> is captured at entry time
/// (quantity × the vendor's rate then) so editing a vendor's rate later never rewrites history.
/// </summary>
public class DailyEntry
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("householdId")]
    public string HouseholdId { get; set; } = string.Empty;

    [BsonElement("vendorId")]
    public string VendorId { get; set; } = string.Empty;

    /// <summary>Stored as UTC midnight for the calendar day the delivery happened.</summary>
    [BsonElement("date")]
    public DateTime Date { get; set; }

    [BsonElement("quantity")]
    public decimal Quantity { get; set; }

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("note")]
    public string? Note { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
