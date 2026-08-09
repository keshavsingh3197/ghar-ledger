using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GharLedger.Api.Models;

public class VendorPayment
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("householdId")]
    public string HouseholdId { get; set; } = string.Empty;

    [BsonElement("vendorId")]
    public string VendorId { get; set; } = string.Empty;

    [BsonElement("date")]
    public DateTime Date { get; set; }

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("note")]
    public string? Note { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}