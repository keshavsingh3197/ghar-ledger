using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GharLedger.Api.Models;

public class HouseholdTransaction
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("householdId")]
    public string HouseholdId { get; set; } = string.Empty;

    [BsonElement("date")]
    public DateTime Date { get; set; }

    [BsonElement("type")]
    public string Type { get; set; } = "Expense";

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("memberName")]
    public string? MemberName { get; set; }

    [BsonElement("note")]
    public string? Note { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}