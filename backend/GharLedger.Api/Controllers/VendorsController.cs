using GharLedger.Api.Dtos;
using GharLedger.Api.Models;
using GharLedger.Api.Services;
using KeshavSingh.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GharLedger.Api.Controllers;

/// <summary>Vendors (milk, newspaper, maid, …) that belong to one household.</summary>
[ApiController]
[Authorize]
public class VendorsController : ControllerBase
{
    private readonly VendorService _vendors;
    private readonly HouseholdService _households;

    public VendorsController(VendorService vendors, HouseholdService households)
    {
        _vendors = vendors;
        _households = households;
    }

    [HttpGet("api/households/{householdId}/vendors")]
    public async Task<ActionResult<List<Vendor>>> ListForHousehold(string householdId)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        return Ok(await _vendors.ListForHouseholdAsync(householdId));
    }

    [HttpPost("api/households/{householdId}/vendors")]
    public async Task<ActionResult<Vendor>> Create(string householdId, [FromBody] CreateVendorRequest req)
    {
        if (!await _households.IsMemberAsync(householdId, User.GetUserId())) return NotFound();
        var created = await _vendors.CreateAsync(householdId, req.Name, req.Unit, req.RatePerUnit);
        return Ok(created);
    }

    [HttpPut("api/vendors/{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateVendorRequest req)
    {
        var vendor = await _vendors.GetByIdAsync(id);
        if (vendor is null || !await _households.IsMemberAsync(vendor.HouseholdId, User.GetUserId())) return NotFound();

        var updated = await _vendors.UpdateAsync(id, req.Name, req.Unit, req.RatePerUnit, req.IsActive);
        return updated ? NoContent() : NotFound();
    }

    [HttpPost("api/vendors/{id}/rates")]
    public async Task<ActionResult<VendorRate>> AddRate(string id, [FromBody] CreateVendorRateRequest req)
    {
        var vendor = await _vendors.GetByIdAsync(id);
        if (vendor is null || !await _households.IsMemberAsync(vendor.HouseholdId, User.GetUserId())) return NotFound();

        try
        {
            return Ok(await _vendors.AddRateAsync(id, req.Amount, req.EffectiveFrom, req.EffectiveTo));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("api/vendors/{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var vendor = await _vendors.GetByIdAsync(id);
        if (vendor is null || !await _households.IsMemberAsync(vendor.HouseholdId, User.GetUserId())) return NotFound();

        var deleted = await _vendors.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
