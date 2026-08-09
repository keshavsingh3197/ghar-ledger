using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using GharLedger.Api.Services;
using KeshavSingh.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GharLedger.Api.Controllers;

/// <summary>Daily vendor deliveries (e.g. today's milk) and the monthly rollup they feed.</summary>
[ApiController]
[Authorize]
public class DailyEntriesController : ControllerBase
{
    private readonly DailyEntryService _entries;
    private readonly HouseholdService _households;

    public DailyEntriesController(DailyEntryService entries, HouseholdService households)
    {
        _entries = entries;
        _households = households;
    }

    [HttpGet("api/households/{householdId}/entries")]
    public async Task<ActionResult<List<DailyEntry>>> List(
        string householdId, [FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        return Ok(await _entries.ListAsync(householdId, from, to));
    }

    [HttpGet("api/households/{householdId}/entries/monthly-totals")]
    public async Task<ActionResult<List<MonthlyVendorTotal>>> MonthlyTotals(
        string householdId, [FromQuery] int year, [FromQuery] int month)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();

        var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = from.AddMonths(1);
        return Ok(await _entries.MonthlyTotalsAsync(householdId, from, to));
    }

    [HttpPost("api/households/{householdId}/entries")]
    public async Task<ActionResult<DailyEntry>> Create(string householdId, [FromBody] CreateDailyEntryRequest req)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();

        try
        {
            var created = await _entries.CreateAsync(householdId, req);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("api/entries/{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateDailyEntryRequest req)
    {
        var entry = await _entries.GetByIdAsync(id);
        if (entry is null || !await _households.IsMemberAsync(entry.HouseholdId, User.GetUserId())) return NotFound();

        try
        {
            var updated = await _entries.UpdateAsync(id, req);
            return updated ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("api/entries/{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var entry = await _entries.GetByIdAsync(id);
        if (entry is null || !await _households.IsMemberAsync(entry.HouseholdId, User.GetUserId())) return NotFound();

        var deleted = await _entries.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
