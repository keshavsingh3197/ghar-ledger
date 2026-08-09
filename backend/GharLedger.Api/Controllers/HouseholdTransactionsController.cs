using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using GharLedger.Api.Services;
using KeshavSingh.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GharLedger.Api.Controllers;

[ApiController]
[Authorize]
public class HouseholdTransactionsController : ControllerBase
{
    private readonly HouseholdTransactionService _transactions;
    private readonly HouseholdService _households;

    public HouseholdTransactionsController(HouseholdTransactionService transactions, HouseholdService households)
    {
        _transactions = transactions;
        _households = households;
    }

    [HttpGet("api/households/{householdId}/transactions")]
    public async Task<ActionResult<List<HouseholdTransaction>>> List(
        string householdId, [FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        if (to <= from) return BadRequest("To must be after from.");
        return Ok(await _transactions.ListAsync(householdId, from, to));
    }

    [HttpGet("api/households/{householdId}/transactions/summary")]
    public async Task<ActionResult<HouseholdCashflowSummary>> Summary(
        string householdId, [FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        if (to <= from) return BadRequest("To must be after from.");
        return Ok(await _transactions.SummaryAsync(householdId, from, to));
    }

    [HttpPost("api/households/{householdId}/transactions")]
    public async Task<ActionResult<HouseholdTransaction>> Create(
        string householdId, [FromBody] CreateHouseholdTransactionRequest request)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        try { return Ok(await _transactions.CreateAsync(householdId, request)); }
        catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
    }

    [HttpDelete("api/transactions/{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var transaction = await _transactions.GetByIdAsync(id);
        if (transaction is null || !await _households.IsMemberAsync(transaction.HouseholdId, User.GetUserId())) return NotFound();
        return await _transactions.DeleteAsync(id) ? NoContent() : NotFound();
    }
}