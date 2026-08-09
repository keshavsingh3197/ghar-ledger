using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GharLedger.Api.Models;

/// <summary>
/// One family's ledger. Membership is a list of the shared SSO user ids (the same ids the identity
/// provider issues as the JWT "sub" claim) — there is no local account system here.
/// </summary>
public class Household
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("memberUserIds")]
    public List<string> MemberUserIds { get; set; } = new();

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
