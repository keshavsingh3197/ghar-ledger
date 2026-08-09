import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DailyEntry, DeliveryPeriod, MonthlyVendorTotal } from '../../core/models/daily-entry.models';
import { Household } from '../../core/models/household.models';
import { Vendor } from '../../core/models/vendor.models';
import { DailyEntriesService } from '../../core/services/daily-entries.service';
import { HouseholdsService } from '../../core/services/households.service';
import { VendorsService } from '../../core/services/vendors.service';

function localDateTime(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

@Component({
  selector: 'app-household',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="household">
      <header>
        <div><a class="back" routerLink="/">← All households</a><h1>{{ household()?.name ?? 'Household ledger' }}</h1></div>
        <div class="month"><button class="icon" title="Previous month" (click)="changeMonth(-1)">‹</button><input class="input" type="month" [(ngModel)]="selectedMonth" (change)="loadMonth()" /><button class="icon" title="Next month" (click)="changeMonth(1)">›</button></div>
      </header>
      @if (message()) { <p class="notice" role="status">{{ message() }}</p> }

      <nav aria-label="Ledger sections">
        @for (tab of tabs; track tab.id) { <button [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">{{ tab.label }}</button> }
      </nav>

      @if (activeTab() === 'overview') {
        <section class="metrics">
          <article><span>Current month</span><strong>₹{{ grandTotal() | number:'1.2-2' }}</strong></article>
          <article><span>Previous month</span><strong>₹{{ previousGrandTotal() | number:'1.2-2' }}</strong></article>
          <article><span>Month change</span><strong>{{ monthChange() > 0 ? '+' : '' }}{{ monthChange() | number:'1.1-1' }}%</strong></article>
          <article><span>Outstanding</span><strong>₹{{ outstandingTotal() | number:'1.2-2' }}</strong></article>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Spend by vendor</h2><p>{{ monthLabel() }} at captured delivery prices</p></div></div>
          @if (!monthlyTotals().length) { <p class="empty">No entries for this month.</p> }
          @for (total of monthlyTotals(); track total.vendorId) {
            <div class="bar-row"><span>{{ total.vendorName }}</span><div class="track"><div class="bar" [style.width.%]="barWidth(total.totalAmount)"></div></div><strong>₹{{ total.totalAmount | number:'1.2-2' }}</strong></div>
          }
          @if (monthlyTotals().length) {
            <div class="scroll"><table><thead><tr><th>Vendor</th><th>Deliveries</th><th>Quantity</th><th>Charged</th><th>Paid</th><th>Balance</th></tr></thead><tbody>
              @for (total of monthlyTotals(); track total.vendorId) { <tr><td>{{ total.vendorName }}</td><td>{{ total.entryCount }}</td><td>{{ total.totalQuantity }}</td><td>₹{{ total.totalAmount | number:'1.2-2' }}</td><td>₹{{ total.totalPaid | number:'1.2-2' }}</td><td>₹{{ total.balance | number:'1.2-2' }}</td></tr> }
            </tbody></table></div>
          }
        </section>
      }

      @if (activeTab() === 'entries') {
        <section class="panel">
          <div class="heading"><div><h2>Add delivery</h2><p>The selected rate is saved with this delivery.</p></div></div>
          @if (!activeVendors().length) { <p class="empty">Add an active vendor first.</p> } @else {
            <div class="form-grid">
              <label>Vendor<select class="input" [(ngModel)]="logVendorId" (change)="useVendorRate()">@for (vendor of activeVendors(); track vendor.id) { <option [value]="vendor.id">{{ vendor.name }}</option> }</select></label>
              <label>Date and time<input class="input" type="datetime-local" [(ngModel)]="logDate" /></label>
              <label>Delivery<select class="input" [(ngModel)]="logPeriod"><option>Morning</option><option>Evening</option><option>Anytime</option></select></label>
              <label>Quantity<input class="input" type="number" min="0.01" step="0.01" [(ngModel)]="logQuantity" /></label>
              <label>Rate per unit<input class="input" type="number" min="0" step="0.01" [(ngModel)]="logRate" /></label>
              <label>Amount paid<input class="input" type="number" min="0" step="0.01" [(ngModel)]="logPaid" /></label>
              <label>Note<input class="input" [(ngModel)]="logNote" placeholder="Optional" /></label>
            </div>
            <button class="primary" [disabled]="!canLog()" (click)="logEntry()">Add delivery</button>
          }
        </section>
        <section class="panel">
          <div class="heading"><div><h2>{{ monthLabel() }} entries</h2><p>{{ monthEntries().length }} records</p></div><div class="actions"><input #fileInput hidden type="file" accept=".xlsx,.xls,.csv" (change)="importWorkbook($event)" /><button class="secondary" (click)="fileInput.click()">Import Excel</button><button class="secondary" [disabled]="!monthEntries().length" (click)="exportWorkbook()">Export Excel</button></div></div>
          <div class="scroll"><table><thead><tr><th>Date</th><th>Period</th><th>Vendor</th><th>Qty</th><th>Rate</th><th>Charged</th><th>Paid</th><th>Balance</th><th>Note</th><th></th></tr></thead><tbody>
            @for (entry of pagedEntries(); track entry.id) {
              <tr>
                @if (editingId() === entry.id) {
                  <td><input class="cell-input" type="datetime-local" [(ngModel)]="editEntry.date" /></td><td><select class="cell-input" [(ngModel)]="editEntry.period"><option>Morning</option><option>Evening</option><option>Anytime</option></select></td><td>{{ vendorName(entry.vendorId) }}</td><td><input class="cell-input number" type="number" [(ngModel)]="editEntry.quantity" /></td><td><input class="cell-input number" type="number" [(ngModel)]="editEntry.ratePerUnit" /></td><td>₹{{ editEntry.quantity * editEntry.ratePerUnit | number:'1.2-2' }}</td><td><input class="cell-input number" type="number" [(ngModel)]="editEntry.paidAmount" /></td><td>₹{{ editEntry.quantity * editEntry.ratePerUnit - editEntry.paidAmount | number:'1.2-2' }}</td><td><input class="cell-input" [(ngModel)]="editEntry.note" /></td><td class="row-actions"><button class="icon" title="Save" (click)="saveEntry(entry)">✓</button><button class="icon" title="Cancel" (click)="editingId.set(null)">×</button></td>
                } @else {
                  <td>{{ entry.date | date:'medium' }}</td><td>{{ entry.period }}</td><td>{{ vendorName(entry.vendorId) }}</td><td>{{ entry.quantity }}</td><td>₹{{ entry.ratePerUnit | number:'1.2-2' }}</td><td>₹{{ entry.amount | number:'1.2-2' }}</td><td>₹{{ entry.paidAmount | number:'1.2-2' }}</td><td>₹{{ entry.amount - entry.paidAmount | number:'1.2-2' }}</td><td>{{ entry.note || '—' }}</td><td class="row-actions"><button class="icon" title="Edit" (click)="startEdit(entry)">✎</button><button class="icon danger" title="Delete" (click)="deleteEntry(entry)">×</button></td>
                }
              </tr>
            }
          </tbody></table></div>
          @if (pageCount() > 1) { <div class="pagination"><button class="secondary" [disabled]="page() === 1" (click)="page.set(page() - 1)">Previous</button><span>Page {{ page() }} of {{ pageCount() }}</span><button class="secondary" [disabled]="page() === pageCount()" (click)="page.set(page() + 1)">Next</button></div> }
        </section>
      }

      @if (activeTab() === 'vendors') {
        <section class="panel">
          <div class="heading"><div><h2>Vendors</h2><p>Rate changes apply only to new deliveries.</p></div></div>
          @for (vendor of vendors(); track vendor.id) {
            <div class="vendor" [class.inactive]="!vendor.isActive">
              @if (editingVendorId() === vendor.id) {
                <input class="input" [(ngModel)]="editVendor.name" /><input class="input" [(ngModel)]="editVendor.unit" /><input class="input" type="number" min="0" [(ngModel)]="editVendor.ratePerUnit" /><label class="check"><input type="checkbox" [(ngModel)]="editVendor.isActive" /> Active</label><button class="icon" title="Save" (click)="saveVendor(vendor)">✓</button><button class="icon" title="Cancel" (click)="editingVendorId.set(null)">×</button>
              } @else {
                <strong>{{ vendor.name }}</strong><span>₹{{ vendor.ratePerUnit | number:'1.2-2' }} / {{ vendor.unit }}</span><span class="status">{{ vendor.isActive ? 'Active' : 'Inactive' }}</span><button class="icon" title="Edit" (click)="startVendorEdit(vendor)">✎</button><button class="icon danger" title="Delete" (click)="deleteVendor(vendor)">×</button>
              }
            </div>
          }
          <div class="form-grid add-vendor"><label>Name<input class="input" [(ngModel)]="newVendor.name" placeholder="Milk vendor" /></label><label>Unit<input class="input" [(ngModel)]="newVendor.unit" /></label><label>Rate per unit<input class="input" type="number" min="0" [(ngModel)]="newVendor.ratePerUnit" /></label></div>
          <button class="primary" [disabled]="!newVendor.name.trim()" (click)="addVendor()">Add vendor</button>
        </section>
      }
    </div>
  `,
  styles: [`
    .household{max-width:1120px;margin:0 auto}header,.heading,.vendor,.actions,.pagination{display:flex;align-items:center;justify-content:space-between;gap:1rem}.back{color:var(--muted);text-decoration:none;font-size:.85rem}h1{margin:.35rem 0;font-size:1.65rem}h2{margin:0;font-size:1.05rem}.heading p{color:var(--muted);font-size:.84rem;margin:.25rem 0}.month{display:flex;align-items:center;gap:.4rem}nav{display:flex;gap:1.4rem;border-bottom:1px solid var(--border);margin:1.25rem 0 1rem}nav button{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);padding:.7rem .1rem;cursor:pointer;font-weight:600}nav button.active{color:var(--text);border-color:var(--brand)}.panel,.metrics article{background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-sm)}.panel{padding:1.25rem;margin-bottom:1rem}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem}.metrics article{padding:1rem}.metrics span{display:block;color:var(--muted);font-size:.76rem;margin-bottom:.35rem}.metrics strong{font-size:1.2rem}.notice{padding:.7rem 1rem;border-left:3px solid var(--brand);background:color-mix(in srgb,var(--brand) 10%,var(--surface))}.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:1rem 0}label{color:var(--muted);font-size:.76rem;font-weight:600}.input,.cell-input{display:block;box-sizing:border-box;width:100%;padding:.52rem .65rem;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:5px;margin-top:.3rem}.cell-input{min-width:120px;margin:0}.cell-input.number{min-width:72px;width:76px}.primary,.secondary,.icon{font:inherit;border-radius:5px;cursor:pointer}.primary{border:0;background:var(--brand);color:var(--brand-text);padding:.58rem 1rem;font-weight:600}.secondary{border:1px solid var(--border);background:transparent;color:var(--text);padding:.5rem .8rem}.icon{width:32px;height:32px;border:1px solid var(--border);background:var(--surface);color:var(--text)}button:disabled{opacity:.5;cursor:default}.danger:hover{border-color:#b42318;color:#b42318}.bar-row{display:grid;grid-template-columns:minmax(100px,1fr) 4fr minmax(85px,auto);align-items:center;gap:.75rem;margin:.85rem 0;font-size:.84rem}.track{height:10px;background:var(--border);overflow:hidden}.bar{height:100%;background:var(--brand);min-width:2px}.scroll{overflow-x:auto;margin-top:1rem}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.65rem;border-bottom:1px solid var(--border);font-size:.84rem;white-space:nowrap}th{color:var(--muted);font-size:.7rem;text-transform:uppercase}.row-actions{display:flex;gap:.25rem}.pagination{justify-content:flex-end;margin-top:1rem;color:var(--muted);font-size:.8rem}.vendor{justify-content:flex-start;padding:.65rem 0;border-bottom:1px solid var(--border)}.vendor strong{min-width:160px}.vendor .status{margin-left:auto;color:var(--muted);font-size:.76rem}.vendor.inactive{opacity:.6}.vendor>.input{margin:0}.check{display:flex;align-items:center;gap:.35rem;white-space:nowrap}.add-vendor{border-top:1px solid var(--border);padding-top:1rem}.empty{text-align:center;color:var(--muted);padding:1.5rem}.month .input{margin:0}@media(max-width:760px){header,.heading{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}.form-grid{grid-template-columns:1fr}.vendor{flex-wrap:wrap}.vendor .status{margin-left:0}.bar-row{grid-template-columns:85px 1fr 75px}}
  `],
})
export class HouseholdComponent implements OnInit {
  readonly tabs = [{ id: 'overview' as const, label: 'Overview' }, { id: 'entries' as const, label: 'Entries' }, { id: 'vendors' as const, label: 'Vendors' }];
  readonly household = signal<Household | null>(null);
  readonly vendors = signal<Vendor[]>([]);
  readonly monthEntries = signal<DailyEntry[]>([]);
  readonly monthlyTotals = signal<MonthlyVendorTotal[]>([]);
  readonly previousTotals = signal<MonthlyVendorTotal[]>([]);
  readonly activeTab = signal<'overview' | 'entries' | 'vendors'>('overview');
  readonly page = signal(1);
  readonly editingId = signal<string | null>(null);
  readonly editingVendorId = signal<string | null>(null);
  readonly message = signal('');
  readonly activeVendors = computed(() => this.vendors().filter((vendor) => vendor.isActive));
  readonly grandTotal = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.totalAmount, 0));
  readonly previousGrandTotal = computed(() => this.previousTotals().reduce((sum, total) => sum + total.totalAmount, 0));
  readonly entryCount = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.entryCount, 0));
  readonly outstandingTotal = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.balance, 0));
  readonly monthChange = computed(() => this.previousGrandTotal() ? (this.grandTotal() - this.previousGrandTotal()) / this.previousGrandTotal() * 100 : this.grandTotal() ? 100 : 0);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.monthEntries().length / 10)));
  readonly pagedEntries = computed(() => this.monthEntries().slice((this.page() - 1) * 10, this.page() * 10));

  householdId = '';
  selectedMonth = new Date().toISOString().slice(0, 7);
  newVendor = { name: '', unit: 'liter', ratePerUnit: 0 };
  editVendor = { name: '', unit: '', ratePerUnit: 0, isActive: true };
  logVendorId = '';
  logDate = localDateTime();
  logPeriod: DeliveryPeriod = new Date().getHours() < 15 ? 'Morning' : 'Evening';
  logQuantity: number | null = null;
  logRate: number | null = null;
  logPaid = 0;
  logNote = '';
  editEntry = { date: '', period: 'Anytime' as DeliveryPeriod, quantity: 0, ratePerUnit: 0, paidAmount: 0, note: '' };

  constructor(private route: ActivatedRoute, private householdsApi: HouseholdsService, private vendorsApi: VendorsService, private entriesApi: DailyEntriesService) {}

  ngOnInit() {
    this.householdId = this.route.snapshot.paramMap.get('id') ?? '';
    this.householdsApi.getById(this.householdId).subscribe({ next: (household) => this.household.set(household) });
    this.loadVendors();
    this.loadMonth();
  }

  loadVendors() {
    this.vendorsApi.list(this.householdId).subscribe({ next: (vendors) => {
      this.vendors.set(vendors);
      if (!this.logVendorId && vendors.length) { this.logVendorId = vendors[0].id; this.useVendorRate(); }
    } });
  }

  loadMonth() {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const previous = new Date(year, month - 2, 1);
    this.page.set(1);
    forkJoin({
      entries: this.entriesApi.list(this.householdId, new Date(year, month - 1, 1), new Date(year, month, 1)),
      totals: this.entriesApi.monthlyTotals(this.householdId, year, month),
      previous: this.entriesApi.monthlyTotals(this.householdId, previous.getFullYear(), previous.getMonth() + 1),
    }).subscribe({ next: (result) => { this.monthEntries.set(result.entries); this.monthlyTotals.set(result.totals); this.previousTotals.set(result.previous); } });
  }

  changeMonth(offset: number) {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    this.selectedMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    this.loadMonth();
  }

  monthLabel() { const [year, month] = this.selectedMonth.split('-').map(Number); return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)); }
  vendorName(id: string) { return this.vendors().find((vendor) => vendor.id === id)?.name ?? '(deleted vendor)'; }
  barWidth(amount: number) { return amount / Math.max(...this.monthlyTotals().map((total) => total.totalAmount), 1) * 100; }
  canLog() { return !!this.logVendorId && !!this.logDate && !!this.logQuantity && this.logRate !== null && this.logRate >= 0; }
  useVendorRate() { this.logRate = this.vendors().find((vendor) => vendor.id === this.logVendorId)?.ratePerUnit ?? null; }

  addVendor() {
    const name = this.newVendor.name.trim();
    if (!name) return;
    this.vendorsApi.create(this.householdId, { ...this.newVendor, name }).subscribe({ next: () => { this.newVendor = { name: '', unit: 'liter', ratePerUnit: 0 }; this.loadVendors(); } });
  }

  startVendorEdit(vendor: Vendor) { this.editingVendorId.set(vendor.id); this.editVendor = { name: vendor.name, unit: vendor.unit, ratePerUnit: vendor.ratePerUnit, isActive: vendor.isActive }; }
  saveVendor(vendor: Vendor) { this.vendorsApi.update(vendor.id, this.editVendor).subscribe({ next: () => { this.editingVendorId.set(null); this.loadVendors(); } }); }
  deleteVendor(vendor: Vendor) { if (confirm(`Delete vendor "${vendor.name}"?`)) this.vendorsApi.delete(vendor.id).subscribe({ next: () => this.loadVendors() }); }

  logEntry() {
    if (!this.canLog()) return;
    this.entriesApi.create(this.householdId, { vendorId: this.logVendorId, date: new Date(this.logDate).toISOString(), period: this.logPeriod, quantity: this.logQuantity!, ratePerUnit: this.logRate, paidAmount: this.logPaid, note: this.logNote.trim() || null }).subscribe({ next: () => { this.logQuantity = null; this.logPaid = 0; this.logNote = ''; this.loadMonth(); } });
  }

  startEdit(entry: DailyEntry) { this.editingId.set(entry.id); this.editEntry = { date: localDateTime(new Date(entry.date)), period: entry.period, quantity: entry.quantity, ratePerUnit: entry.ratePerUnit, paidAmount: entry.paidAmount ?? 0, note: entry.note ?? '' }; }
  saveEntry(entry: DailyEntry) { this.entriesApi.update(entry.id, { ...this.editEntry, date: new Date(this.editEntry.date).toISOString(), note: this.editEntry.note.trim() || null }).subscribe({ next: () => { this.editingId.set(null); this.loadMonth(); } }); }
  deleteEntry(entry: DailyEntry) { if (confirm('Delete this delivery?')) this.entriesApi.delete(entry.id).subscribe({ next: () => this.loadMonth() }); }

  async exportWorkbook() {
    const XLSX = await import('xlsx');
    const rows = this.monthEntries().map((entry) => ({ Date: new Date(entry.date).toLocaleString(), Period: entry.period, Vendor: this.vendorName(entry.vendorId), Quantity: entry.quantity, Rate: entry.ratePerUnit, Amount: entry.amount, Paid: entry.paidAmount, Balance: entry.amount - entry.paidAmount, Note: entry.note ?? '' }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Entries');
    XLSX.writeFile(workbook, `ghar-ledger-${this.selectedMonth}.xlsx`);
  }

  async importWorkbook(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const requests = rows.map((row) => {
      const vendor = this.vendors().find((item) => item.name.trim().toLowerCase() === String(row['Vendor']).trim().toLowerCase());
      const quantity = Number(row['Quantity']);
      const rate = Number(row['Rate']);
      const date = new Date(row['Date'] as string | number | Date);
      if (!vendor || !quantity || Number.isNaN(rate) || Number.isNaN(date.getTime())) return null;
      const value = String(row['Period']).toLowerCase();
      const period: DeliveryPeriod = value === 'morning' || value === 'am' ? 'Morning' : value === 'evening' || value === 'pm' ? 'Evening' : 'Anytime';
      return this.entriesApi.create(this.householdId, { vendorId: vendor.id, date: date.toISOString(), period, quantity, ratePerUnit: rate, paidAmount: Number(row['Paid']) || 0, note: String(row['Note'] ?? '').trim() || null });
    }).filter((request) => request !== null);
    if (!requests.length) { this.message.set('No valid rows found. Use Vendor, Date, Quantity, Rate, Period, and Note columns.'); input.value = ''; return; }
    forkJoin(requests).subscribe({ next: () => { this.message.set(`Imported ${requests.length} deliveries. Invalid rows were skipped.`); input.value = ''; this.loadMonth(); } });
  }
}