using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using GharLedger.Api.Services;
using KeshavSingh.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GharLedger.Api.Controllers;

[ApiController]
[Authorize]
public class VendorPaymentsController : ControllerBase
{
    private readonly VendorPaymentService _payments;
    private readonly HouseholdService _households;

    public VendorPaymentsController(VendorPaymentService payments, HouseholdService households)
    {
        _payments = payments;
        _households = households;
    }

    [HttpGet("api/households/{householdId}/vendor-payments")]
    public async Task<ActionResult<List<VendorPayment>>> List(
        string householdId, [FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        return Ok(await _payments.ListAsync(householdId, from, to));
    }

    [HttpPost("api/households/{householdId}/vendor-payments")]
    public async Task<ActionResult<VendorPayment>> Create(
        string householdId, [FromBody] CreateVendorPaymentRequest request)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        try
        {
            return Ok(await _payments.CreateAsync(householdId, request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("api/vendor-payments/{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var payment = await _payments.GetByIdAsync(id);
        if (payment is null || !await _households.IsMemberAsync(payment.HouseholdId, User.GetUserId())) return NotFound();
        return await _payments.DeleteAsync(id) ? NoContent() : NotFound();
    }
}