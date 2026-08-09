import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HouseholdsService } from '../../core/services/households.service';
import { VendorsService } from '../../core/services/vendors.service';
import { DailyEntriesService } from '../../core/services/daily-entries.service';
import { Household } from '../../core/models/household.models';
import { Vendor } from '../../core/models/vendor.models';
import { DailyEntry, MonthlyVendorTotal } from '../../core/models/daily-entry.models';

/** Today at UTC midnight, as a yyyy-MM-dd string for the date input's default value. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-household',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    <div class="household">
      <a class="back" routerLink="/">← All households</a>
      <h1>{{ household()?.name ?? 'Household' }}</h1>

      <section class="card">
        <h2>Vendors</h2>
        @if (vendors().length === 0) {
          <p class="muted">No vendors yet — add the milkman, newspaper, maid, etc.</p>
        }
        <div class="vendor-list">
          @for (v of vendors(); track v.id) {
            <div class="vendor-row" [class.inactive]="!v.isActive">
              <span class="v-name">{{ v.name }}</span>
              <span class="v-rate">₹{{ v.ratePerUnit }} / {{ v.unit }}</span>
              <button class="icon-btn danger" type="button" (click)="deleteVendor(v)" title="Delete">🗑️</button>
            </div>
          }
        </div>
        <div class="new-vendor">
          <input class="input" placeholder="Name (e.g. Milk)" [(ngModel)]="newVendor.name" />
          <input class="input" placeholder="Unit (e.g. liter)" [(ngModel)]="newVendor.unit" />
          <input class="input" type="number" placeholder="Rate/unit" [(ngModel)]="newVendor.ratePerUnit" />
          <button class="btn-secondary" type="button" [disabled]="!newVendor.name.trim()" (click)="addVendor()">+ Add vendor</button>
        </div>
      </section>

      <section class="card">
        <h2>Log today's delivery</h2>
        @if (vendors().length === 0) {
          <p class="muted">Add a vendor above first.</p>
        } @else {
          <div class="log-row">
            <select class="input" [(ngModel)]="logVendorId">
              @for (v of activeVendors(); track v.id) { <option [value]="v.id">{{ v.name }}</option> }
            </select>
            <input class="input" type="date" [(ngModel)]="logDate" />
            <input class="input" type="number" placeholder="Quantity" [(ngModel)]="logQuantity" />
            <button class="btn-primary" type="button" [disabled]="!logVendorId || !logQuantity" (click)="logEntry()">Log</button>
          </div>
        }
      </section>

      <section class="card">
        <h2>This month's totals</h2>
        @if (monthlyTotals().length === 0) {
          <p class="muted">No entries logged this month yet.</p>
        } @else {
          <table class="tbl">
            <thead><tr><th>Vendor</th><th>Quantity</th><th>Amount</th></tr></thead>
            <tbody>
              @for (t of monthlyTotals(); track t.vendorId) {
                <tr><td>{{ t.vendorName }}</td><td>{{ t.totalQuantity }}</td><td>₹{{ t.totalAmount }}</td></tr>
              }
              <tr class="total-row"><td>Total</td><td></td><td>₹{{ grandTotal() }}</td></tr>
            </tbody>
          </table>
        }
      </section>

      <section class="card">
        <h2>Recent entries</h2>
        @if (recentEntries().length === 0) {
          <p class="muted">Nothing logged yet.</p>
        } @else {
          <table class="tbl">
            <thead><tr><th>Date</th><th>Vendor</th><th>Quantity</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              @for (e of recentEntries(); track e.id) {
                <tr>
                  <td>{{ e.date | date:'mediumDate' }}</td>
                  <td>{{ vendorName(e.vendorId) }}</td>
                  <td>{{ e.quantity }}</td>
                  <td>₹{{ e.amount }}</td>
                  <td><button class="icon-btn danger" type="button" (click)="deleteEntry(e)" title="Delete">🗑️</button></td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>
  `,
  styles: [`
    .household { max-width: 720px; margin: 0 auto; }
    .back { color: var(--muted); text-decoration: none; font-size: 0.85rem; }
    h1 { margin: 0.3rem 0 1.25rem; font-size: 1.4rem; }

    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.25rem; box-shadow: var(--shadow-sm); margin-bottom: 1.25rem;
    }
    .card h2 { margin: 0 0 0.85rem; font-size: 1.05rem; }
    .muted { color: var(--muted); font-size: 0.9rem; }

    .vendor-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .vendor-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
    .vendor-row.inactive { opacity: 0.5; }
    .v-name { flex: 1; font-weight: 600; }
    .v-rate { color: var(--muted); font-size: 0.85rem; }

    .new-vendor, .log-row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
    .input {
      padding: 0.5rem 0.7rem; border: 1px solid var(--border); background: var(--surface); color: var(--text);
      border-radius: 6px; font-size: 0.95rem; flex: 1; min-width: 120px;
    }
    .btn-primary { background: var(--brand); color: var(--brand-text); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
    .btn-secondary:disabled { opacity: 0.6; cursor: default; }

    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 28px;
      border: 1px solid var(--border); background: var(--surface); border-radius: 6px; cursor: pointer;
    }
    .icon-btn.danger:hover { border-color: #d93025; }

    .tbl { width: 100%; border-collapse: collapse; }
    .tbl th, .tbl td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    .tbl th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; }
    .total-row td { font-weight: 700; border-top: 2px solid var(--border); border-bottom: none; }
  `]
})
export class HouseholdComponent implements OnInit {
  householdId = '';
  household = signal<Household | null>(null);
  vendors = signal<Vendor[]>([]);
  recentEntries = signal<DailyEntry[]>([]);
  monthlyTotals = signal<MonthlyVendorTotal[]>([]);

  readonly activeVendors = computed(() => this.vendors().filter((v) => v.isActive));
  readonly grandTotal = computed(() => this.monthlyTotals().reduce((sum, t) => sum + t.totalAmount, 0));

  newVendor = { name: '', unit: 'liter', ratePerUnit: 0 };
  logVendorId = '';
  logDate = todayIso();
  logQuantity: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private householdsApi: HouseholdsService,
    private vendorsApi: VendorsService,
    private entriesApi: DailyEntriesService,
  ) {}

  ngOnInit() {
    this.householdId = this.route.snapshot.paramMap.get('id') ?? '';
    this.householdsApi.getById(this.householdId).subscribe({ next: (h) => this.household.set(h) });
    this.loadVendors();
    this.loadRecentEntries();
    this.loadMonthlyTotals();
  }

  loadVendors() {
    this.vendorsApi.list(this.householdId).subscribe({
      next: (data) => {
        this.vendors.set(data);
        if (!this.logVendorId && data.length) this.logVendorId = data[0].id;
      },
    });
  }

  loadRecentEntries() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    this.entriesApi.list(this.householdId, from, to).subscribe({ next: (data) => this.recentEntries.set(data) });
  }

  loadMonthlyTotals() {
    const now = new Date();
    this.entriesApi.monthlyTotals(this.householdId, now.getFullYear(), now.getMonth() + 1)
      .subscribe({ next: (data) => this.monthlyTotals.set(data) });
  }

  vendorName(vendorId: string): string {
    return this.vendors().find((v) => v.id === vendorId)?.name ?? '(deleted vendor)';
  }

  addVendor() {
    const name = this.newVendor.name.trim();
    if (!name) return;
    this.vendorsApi.create(this.householdId, { ...this.newVendor, name }).subscribe({
      next: () => {
        this.newVendor = { name: '', unit: 'liter', ratePerUnit: 0 };
        this.loadVendors();
      },
    });
  }

  deleteVendor(v: Vendor) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    this.vendorsApi.delete(v.id).subscribe({ next: () => this.loadVendors() });
  }

  logEntry() {
    if (!this.logVendorId || !this.logQuantity) return;
    this.entriesApi.create(this.householdId, {
      vendorId: this.logVendorId,
      date: new Date(this.logDate).toISOString(),
      quantity: this.logQuantity,
    }).subscribe({
      next: () => {
        this.logQuantity = null;
        this.loadRecentEntries();
        this.loadMonthlyTotals();
      },
    });
  }

  deleteEntry(e: DailyEntry) {
    if (!confirm('Delete this entry?')) return;
    this.entriesApi.delete(e.id).subscribe({
      next: () => {
        this.loadRecentEntries();
        this.loadMonthlyTotals();
      },
    });
  }
}
