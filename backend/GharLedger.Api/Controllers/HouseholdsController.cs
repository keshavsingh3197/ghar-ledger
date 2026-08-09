using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using GharLedger.Api.Services;
using KeshavSingh.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GharLedger.Api.Controllers;

/// <summary>Households (families). Denials return 404, never 403 — anti-IDOR, same convention as admin.</summary>
[ApiController]
[Route("api/households")]
[Authorize]
public class HouseholdsController : ControllerBase
{
    private readonly HouseholdService _households;

    public HouseholdsController(HouseholdService households) => _households = households;

    [HttpGet]
    public async Task<ActionResult<List<Household>>> GetMine() =>
        Ok(await _households.ListForUserAsync(User.GetUserId()));

    [HttpGet("{id}")]
    public async Task<ActionResult<Household>> GetById(string id)
    {
        if (!await _households.IsMemberAsync(id, User.GetUserId())) return NotFound();
        var household = await _households.GetByIdAsync(id);
        return household is null ? NotFound() : Ok(household);
    }

    [HttpPost]
    public async Task<ActionResult<Household>> Create([FromBody] CreateHouseholdRequest req)
    {
        var created = await _households.CreateAsync(req.Name, User.GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id}/members")]
    public async Task<IActionResult> AddMember(string id, [FromBody] AddMemberRequest req)
    {
        if (!await _households.IsMemberAsync(id, User.GetUserId())) return NotFound();
        var added = await _households.AddMemberAsync(id, req.UserId);
        return added ? NoContent() : NotFound();
    }

    [HttpDelete("{id}/members/{userId}")]
    public async Task<IActionResult> RemoveMember(string id, string userId)
    {
        if (!await _households.IsMemberAsync(id, User.GetUserId())) return NotFound();
        var removed = await _households.RemoveMemberAsync(id, userId);
        return removed ? NoContent() : NotFound();
    }
}
