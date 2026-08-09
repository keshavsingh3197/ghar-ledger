import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DailyEntry, DeliveryPeriod, MonthlyVendorTotal } from '../../core/models/daily-entry.models';
import { Household } from '../../core/models/household.models';
import { HouseholdCashflowSummary, HouseholdTransaction, HouseholdTransactionType } from '../../core/models/household-transaction.models';
import { VendorPayment } from '../../core/models/vendor-payment.models';
import { Vendor } from '../../core/models/vendor.models';
import { DailyEntriesService } from '../../core/services/daily-entries.service';
import { HouseholdsService } from '../../core/services/households.service';
import { HouseholdTransactionsService } from '../../core/services/household-transactions.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { VendorPaymentsService } from '../../core/services/vendor-payments.service';
import { VendorsService } from '../../core/services/vendors.service';

function localDateTime(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

@Component({
  selector: 'app-household',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
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
        <section class="panel report-controls">
          <div class="heading"><div><h2>Report period</h2><p>Vendor charges, payments, and balance for inclusive dates.</p></div></div>
          <div class="form-grid">
            <label>Period<select class="input" [(ngModel)]="reportPreset" (change)="applyReportPreset()"><option value="month">Monthly</option><option value="quarter">Quarterly</option><option value="year">Yearly</option><option value="custom">Custom</option></select></label>
            <label>From<input class="input" type="date" [(ngModel)]="reportFrom" (change)="loadReport()" /></label>
            <label>To (included)<input class="input" type="date" [(ngModel)]="reportTo" (change)="loadReport()" /></label>
          </div>
        </section>
        <section class="metrics">
          <article><span>Selected spend</span><strong>{{ grandTotal() | currency:currencyCode() }}</strong></article>
          <article><span>Family income</span><strong>{{ cashflowSummary().income | currency:currencyCode() }}</strong></article>
          <article><span>Other expenses</span><strong>{{ cashflowSummary().expenses | currency:currencyCode() }}</strong></article>
          <article><span>Net left</span><strong>{{ netAfterVendorSpend() | currency:currencyCode() }}</strong></article>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Spend by vendor</h2><p>{{ reportFrom }} to {{ reportTo }}, inclusive</p></div></div>
          @if (!monthlyTotals().length) { <p class="empty">No vendor activity for this period.</p> }
          @for (total of monthlyTotals(); track total.vendorId) {
            <div class="bar-row"><span>{{ total.vendorName }}</span><div class="track"><div class="bar" [style.width.%]="barWidth(total.totalAmount)"></div></div><strong>{{ total.totalAmount | currency:currencyCode() }}</strong></div>
          }
          @if (monthlyTotals().length) {
            <div class="scroll"><table><thead><tr><th>Vendor</th><th>Deliveries</th><th>Quantity</th><th>Charged</th><th>Paid</th><th>Balance</th></tr></thead><tbody>
              @for (total of monthlyTotals(); track total.vendorId) { <tr><td>{{ total.vendorName }}</td><td>{{ total.entryCount }}</td><td>{{ total.totalQuantity }}</td><td>{{ total.totalAmount | currency:currencyCode() }}</td><td>{{ total.totalPaid | currency:currencyCode() }}</td><td>{{ total.balance | currency:currencyCode() }}</td></tr> }
            </tbody></table></div>
          }
        </section>
      }

      @if (activeTab() === 'cashflow') {
        <section class="panel">
          <div class="heading"><div><h2>Family cashflow</h2><p>Income and daily spending for {{ reportFrom }} to {{ reportTo }}.</p></div></div>
          <section class="metrics cashflow-metrics"><article><span>Income</span><strong>{{ cashflowSummary().income | currency:currencyCode() }}</strong></article><article><span>Daily expenses</span><strong>{{ cashflowSummary().expenses | currency:currencyCode() }}</strong></article><article><span>Vendor spend</span><strong>{{ grandTotal() | currency:currencyCode() }}</strong></article><article><span>Net left</span><strong>{{ netAfterVendorSpend() | currency:currencyCode() }}</strong></article></section>
          <div class="form-grid">
            <label>Type<select class="input" [(ngModel)]="transactionType"><option>Expense</option><option>Income</option></select></label>
            <label>Date and time<input class="input" type="datetime-local" [(ngModel)]="transactionDate" /></label>
            <label>Category<input class="input" [(ngModel)]="transactionCategory" placeholder="Groceries, salary, transport" /></label>
            <label>Amount<input class="input" type="number" min="0.01" step="0.01" [(ngModel)]="transactionAmount" /></label>
            <label>Family member<input class="input" [(ngModel)]="transactionMember" placeholder="Optional" /></label>
            <label>Note<input class="input" [(ngModel)]="transactionNote" placeholder="Optional" /></label>
          </div>
          <button class="primary" [disabled]="!transactionCategory.trim() || !transactionAmount" (click)="addTransaction()">Add record</button>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Cashflow records</h2><p>{{ transactions().length }} records in the selected report period</p></div></div>
          @if (!transactions().length) { <p class="empty">No income or daily expense records in this period.</p> }
          <div class="scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Member</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>@for (transaction of transactions(); track transaction.id) { <tr><td>{{ transaction.date | date:'medium' }}</td><td>{{ transaction.type }}</td><td>{{ transaction.category }}</td><td>{{ transaction.memberName || 'Household' }}</td><td>{{ transaction.amount | currency:currencyCode() }}</td><td>{{ transaction.note || '—' }}</td><td><button class="icon danger" title="Delete record" (click)="deleteTransaction(transaction)">×</button></td></tr> }</tbody></table></div>
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
              <label>Note<input class="input" [(ngModel)]="logNote" placeholder="Optional" /></label>
            </div>
            <button class="primary" [disabled]="!canLog()" (click)="logEntry()">Add delivery</button>
          }
        </section>
        <section class="panel">
          <div class="heading"><div><h2>{{ monthLabel() }} entries</h2><p>{{ monthEntries().length }} delivery records</p></div><div class="actions"><input #fileInput hidden type="file" accept=".xlsx,.xls,.csv" (change)="importWorkbook($event)" /><button class="secondary" (click)="fileInput.click()">Import Excel</button><button class="secondary" [disabled]="!monthEntries().length" (click)="exportWorkbook()">Export Excel</button></div></div>
          <div class="scroll"><table><thead><tr><th>Date</th><th>Period</th><th>Vendor</th><th>Qty</th><th>Captured rate</th><th>Charged</th><th>Note</th><th></th></tr></thead><tbody>
            @for (entry of pagedEntries(); track entry.id) {
              <tr>
                @if (editingId() === entry.id) {
                  <td><input class="cell-input" type="datetime-local" [(ngModel)]="editEntry.date" /></td><td><select class="cell-input" [(ngModel)]="editEntry.period"><option>Morning</option><option>Evening</option><option>Anytime</option></select></td><td>{{ vendorName(entry.vendorId) }}</td><td><input class="cell-input number" type="number" [(ngModel)]="editEntry.quantity" /></td><td>{{ entry.ratePerUnit | currency:currencyCode() }}</td><td>{{ editEntry.quantity * entry.ratePerUnit | currency:currencyCode() }}</td><td><input class="cell-input" [(ngModel)]="editEntry.note" /></td><td class="row-actions"><button class="icon" title="Save" (click)="saveEntry(entry)">✓</button><button class="icon" title="Cancel" (click)="editingId.set(null)">×</button></td>
                } @else {
                  <td>{{ entry.date | date:'medium' }}</td><td>{{ entry.period }}</td><td>{{ vendorName(entry.vendorId) }}</td><td>{{ entry.quantity }}</td><td>{{ entry.ratePerUnit | currency:currencyCode() }}</td><td>{{ entry.amount | currency:currencyCode() }}</td><td>{{ entry.note || '—' }}</td><td class="row-actions"><button class="icon" title="Edit" (click)="startEdit(entry)">✎</button><button class="icon danger" title="Delete" (click)="deleteEntry(entry)">×</button></td>
                }
              </tr>
            }
          </tbody></table></div>
          @if (pageCount() > 1) { <div class="pagination"><button class="secondary" [disabled]="page() === 1" (click)="page.set(page() - 1)">Previous</button><span>Page {{ page() }} of {{ pageCount() }}</span><button class="secondary" [disabled]="page() === pageCount()" (click)="page.set(page() + 1)">Next</button></div> }
        </section>
      }

      @if (activeTab() === 'vendors') {
        <section class="panel">
          <div class="heading"><div><h2>Vendors</h2><p>Prices use inclusive start and end dates.</p></div></div>
          @for (vendor of vendors(); track vendor.id) {
            <div class="vendor" [class.inactive]="!vendor.isActive">
              @if (editingVendorId() === vendor.id) {
                <input class="input" [(ngModel)]="editVendor.name" /><input class="input" [(ngModel)]="editVendor.unit" /><input class="input" type="number" min="0" [(ngModel)]="editVendor.ratePerUnit" /><label class="check"><input type="checkbox" [(ngModel)]="editVendor.isActive" /> Active</label><button class="icon" title="Save" (click)="saveVendor(vendor)">✓</button><button class="icon" title="Cancel" (click)="editingVendorId.set(null)">×</button>
              } @else {
                <strong>{{ vendor.name }}</strong><span>{{ vendor.ratePerUnit | currency:currencyCode() }} / {{ vendor.unit }}</span><span class="status">{{ vendor.isActive ? 'Active' : 'Inactive' }}</span><button class="icon" title="Edit" (click)="startVendorEdit(vendor)">✎</button><button class="icon danger" title="Delete" (click)="deleteVendor(vendor)">×</button>
              }
            </div>
            @if (vendor.rates.length) { <div class="rate-list">@for (rate of vendor.rates; track rate.id) { <span>{{ rate.amount | currency:currencyCode() }}: {{ rate.effectiveFrom | date:'mediumDate' }} to {{ rate.effectiveTo ? (rate.effectiveTo | date:'mediumDate') : 'ongoing' }}</span> }</div> }
          }
          <div class="form-grid add-vendor"><label>Name<input class="input" [(ngModel)]="newVendor.name" placeholder="Milk vendor" /></label><label>Unit<input class="input" [(ngModel)]="newVendor.unit" /></label><label>Rate per unit<input class="input" type="number" min="0" [(ngModel)]="newVendor.ratePerUnit" /></label></div>
          <button class="primary" [disabled]="!newVendor.name.trim()" (click)="addVendor()">Add vendor</button>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Add vendor price</h2><p>Leave the end date empty for an ongoing price.</p></div></div>
          <div class="form-grid"><label>Vendor<select class="input" [(ngModel)]="rateVendorId">@for (vendor of vendors(); track vendor.id) { <option [value]="vendor.id">{{ vendor.name }}</option> }</select></label><label>Price per unit<input class="input" type="number" min="0" step="0.01" [(ngModel)]="newRate.amount" /></label><label>From<input class="input" type="date" [(ngModel)]="newRate.effectiveFrom" /></label><label>To (included)<input class="input" type="date" [(ngModel)]="newRate.effectiveTo" /></label></div>
          <button class="primary" [disabled]="!rateVendorId || newRate.amount < 0 || !newRate.effectiveFrom" (click)="addRate()">Add price</button>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Vendor payments</h2><p>Record money separately from deliveries, with the exact date and time.</p></div></div>
          <div class="form-grid"><label>Vendor<select class="input" [(ngModel)]="paymentVendorId">@for (vendor of vendors(); track vendor.id) { <option [value]="vendor.id">{{ vendor.name }}</option> }</select></label><label>Date and time<input class="input" type="datetime-local" [(ngModel)]="paymentDate" /></label><label>Amount<input class="input" type="number" min="0.01" step="0.01" [(ngModel)]="paymentAmount" /></label><label>Note<input class="input" [(ngModel)]="paymentNote" placeholder="Optional" /></label></div>
          <button class="primary" [disabled]="!paymentVendorId || !paymentDate || !paymentAmount" (click)="addPayment()">Record payment</button>
          <div class="scroll payment-list"><table><thead><tr><th>Date</th><th>Vendor</th><th>Paid</th><th>Note</th><th></th></tr></thead><tbody>@for (payment of vendorPayments(); track payment.id) { <tr><td>{{ payment.date | date:'medium' }}</td><td>{{ vendorName(payment.vendorId) }}</td><td>{{ payment.amount | currency:currencyCode() }}</td><td>{{ payment.note || '—' }}</td><td><button class="icon danger" title="Delete payment" (click)="deletePayment(payment)">×</button></td></tr> }</tbody></table></div>
        </section>
      }
    </div>
  `,
  styles: [`
    .household{max-width:1120px;margin:0 auto}header,.heading,.vendor,.actions,.pagination{display:flex;align-items:center;justify-content:space-between;gap:1rem}.back{color:var(--muted);text-decoration:none;font-size:.85rem}h1{margin:.35rem 0;font-size:1.65rem}h2{margin:0;font-size:1.05rem}.heading p{color:var(--muted);font-size:.84rem;margin:.25rem 0}.month{display:flex;align-items:center;gap:.4rem}nav{display:flex;gap:1.4rem;border-bottom:1px solid var(--border);margin:1.25rem 0 1rem}nav button{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);padding:.7rem .1rem;cursor:pointer;font-weight:600}nav button.active{color:var(--text);border-color:var(--brand)}.panel,.metrics article{background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-sm)}.panel{padding:1.25rem;margin-bottom:1rem}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem}.metrics article{padding:1rem}.metrics span{display:block;color:var(--muted);font-size:.76rem;margin-bottom:.35rem}.metrics strong{font-size:1.2rem}.notice{padding:.7rem 1rem;border-left:3px solid var(--brand);background:color-mix(in srgb,var(--brand) 10%,var(--surface))}.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:1rem 0}label{color:var(--muted);font-size:.76rem;font-weight:600}.input,.cell-input{display:block;box-sizing:border-box;width:100%;padding:.52rem .65rem;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:5px;margin-top:.3rem}.cell-input{min-width:120px;margin:0}.cell-input.number{min-width:72px;width:76px}.primary,.secondary,.icon{font:inherit;border-radius:5px;cursor:pointer}.primary{border:0;background:var(--brand);color:var(--brand-text);padding:.58rem 1rem;font-weight:600}.secondary{border:1px solid var(--border);background:transparent;color:var(--text);padding:.5rem .8rem}.icon{width:32px;height:32px;border:1px solid var(--border);background:var(--surface);color:var(--text)}button:disabled{opacity:.5;cursor:default}.danger:hover{border-color:#b42318;color:#b42318}.bar-row{display:grid;grid-template-columns:minmax(100px,1fr) 4fr minmax(85px,auto);align-items:center;gap:.75rem;margin:.85rem 0;font-size:.84rem}.track{height:10px;background:var(--border);overflow:hidden}.bar{height:100%;background:var(--brand);min-width:2px}.scroll{overflow-x:auto;margin-top:1rem}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.65rem;border-bottom:1px solid var(--border);font-size:.84rem;white-space:nowrap}th{color:var(--muted);font-size:.7rem;text-transform:uppercase}.row-actions{display:flex;gap:.25rem}.pagination{justify-content:flex-end;margin-top:1rem;color:var(--muted);font-size:.8rem}.vendor{justify-content:flex-start;padding:.65rem 0;border-bottom:1px solid var(--border)}.vendor strong{min-width:160px}.vendor .status{margin-left:auto;color:var(--muted);font-size:.76rem}.vendor.inactive{opacity:.6}.vendor>.input{margin:0}.check{display:flex;align-items:center;gap:.35rem;white-space:nowrap}.add-vendor{border-top:1px solid var(--border);padding-top:1rem}.empty{text-align:center;color:var(--muted);padding:1.5rem}.month .input{margin:0}@media(max-width:760px){header,.heading{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}.form-grid{grid-template-columns:1fr}.vendor{flex-wrap:wrap}.vendor .status{margin-left:0}.bar-row{grid-template-columns:85px 1fr 75px}}
  `],
})
export class HouseholdComponent implements OnInit {
  readonly tabs = [{ id: 'overview' as const, label: 'Overview' }, { id: 'entries' as const, label: 'Entries' }, { id: 'vendors' as const, label: 'Vendors' }, { id: 'cashflow' as const, label: 'Family cashflow' }];
  readonly household = signal<Household | null>(null);
  readonly vendors = signal<Vendor[]>([]);
  readonly monthEntries = signal<DailyEntry[]>([]);
  readonly monthlyTotals = signal<MonthlyVendorTotal[]>([]);
  readonly previousTotals = signal<MonthlyVendorTotal[]>([]);
  readonly vendorPayments = signal<VendorPayment[]>([]);
  readonly transactions = signal<HouseholdTransaction[]>([]);
  readonly cashflowSummary = signal<HouseholdCashflowSummary>({ income: 0, expenses: 0, netIncome: 0 });
  readonly activeTab = signal<'overview' | 'entries' | 'vendors' | 'cashflow'>('overview');
  readonly page = signal(1);
  readonly editingId = signal<string | null>(null);
  readonly editingVendorId = signal<string | null>(null);
  readonly message = signal('');
  readonly activeVendors = computed(() => this.vendors().filter((vendor) => vendor.isActive));
  readonly grandTotal = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.totalAmount, 0));
  readonly previousGrandTotal = computed(() => this.previousTotals().reduce((sum, total) => sum + total.totalAmount, 0));
  readonly entryCount = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.entryCount, 0));
  readonly outstandingTotal = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.balance, 0));
  readonly netAfterVendorSpend = computed(() => this.cashflowSummary().income - this.cashflowSummary().expenses - this.grandTotal());
  readonly currencyCode = computed(() => this.preferences.value().currency);
  readonly monthChange = computed(() => this.previousGrandTotal() ? (this.grandTotal() - this.previousGrandTotal()) / this.previousGrandTotal() * 100 : this.grandTotal() ? 100 : 0);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.monthEntries().length / 10)));
  readonly pagedEntries = computed(() => this.monthEntries().slice((this.page() - 1) * 10, this.page() * 10));

  householdId = '';
  selectedMonth = new Date().toISOString().slice(0, 7);
  reportPreset: 'month' | 'quarter' | 'year' | 'custom' = 'month';
  reportFrom = `${this.selectedMonth}-01`;
  reportTo = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  newVendor = { name: '', unit: 'liter', ratePerUnit: 0 };
  editVendor = { name: '', unit: '', ratePerUnit: 0, isActive: true };
  logVendorId = '';
  logDate = localDateTime();
  logPeriod: DeliveryPeriod = new Date().getHours() < 15 ? 'Morning' : 'Evening';
  logQuantity: number | null = null;
  logRate: number | null = null;
  logNote = '';
  editEntry = { date: '', period: 'Anytime' as DeliveryPeriod, quantity: 0, ratePerUnit: 0, paidAmount: 0, note: '' };
  rateVendorId = '';
  newRate = { amount: 0, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '' };
  paymentVendorId = '';
  paymentDate = localDateTime();
  paymentAmount: number | null = null;
  paymentNote = '';
  transactionType: HouseholdTransactionType = 'Expense';
  transactionDate = localDateTime();
  transactionCategory = '';
  transactionAmount: number | null = null;
  transactionMember = '';
  transactionNote = '';

  constructor(private route: ActivatedRoute, private householdsApi: HouseholdsService, private vendorsApi: VendorsService, private entriesApi: DailyEntriesService, private paymentsApi: VendorPaymentsService, private transactionsApi: HouseholdTransactionsService, private preferences: PreferencesService) {}

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
      if (!this.rateVendorId && vendors.length) this.rateVendorId = vendors[0].id;
      if (!this.paymentVendorId && vendors.length) this.paymentVendorId = vendors[0].id;
    } });
  }

  loadMonth() {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const previous = new Date(year, month - 2, 1);
    this.page.set(1);
    forkJoin({
      entries: this.entriesApi.list(this.householdId, new Date(year, month - 1, 1), new Date(year, month, 1)),
      previous: this.entriesApi.monthlyTotals(this.householdId, previous.getFullYear(), previous.getMonth() + 1),
    }).subscribe({ next: (result) => { this.monthEntries.set(result.entries); this.previousTotals.set(result.previous); } });
    if (this.reportPreset === 'month') this.applyReportPreset();
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

  applyReportPreset() {
    if (this.reportPreset === 'custom') return;
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const startMonth = this.reportPreset === 'quarter' ? Math.floor((month - 1) / 3) * 3 : this.reportPreset === 'year' ? 0 : month - 1;
    const months = this.reportPreset === 'quarter' ? 3 : this.reportPreset === 'year' ? 12 : 1;
    const from = new Date(year, startMonth, 1);
    const to = new Date(year, startMonth + months, 0);
    this.reportFrom = localDateTime(from).slice(0, 10);
    this.reportTo = localDateTime(to).slice(0, 10);
    this.loadReport();
  }

  loadReport() {
    if (!this.reportFrom || !this.reportTo || this.reportTo < this.reportFrom) return;
    const from = new Date(`${this.reportFrom}T00:00:00`);
    const toExclusive = new Date(`${this.reportTo}T00:00:00`);
    toExclusive.setDate(toExclusive.getDate() + 1);
    forkJoin({
      totals: this.entriesApi.rangeTotals(this.householdId, from, toExclusive),
      payments: this.paymentsApi.list(this.householdId, from, toExclusive),
      transactions: this.transactionsApi.list(this.householdId, from, toExclusive),
      cashflow: this.transactionsApi.summary(this.householdId, from, toExclusive),
    }).subscribe({ next: (result) => { this.monthlyTotals.set(result.totals); this.vendorPayments.set(result.payments); this.transactions.set(result.transactions); this.cashflowSummary.set(result.cashflow); } });
  }

  addVendor() {
    const name = this.newVendor.name.trim();
    if (!name) return;
    this.vendorsApi.create(this.householdId, { ...this.newVendor, name }).subscribe({ next: () => { this.newVendor = { name: '', unit: 'liter', ratePerUnit: 0 }; this.loadVendors(); } });
  }

  startVendorEdit(vendor: Vendor) { this.editingVendorId.set(vendor.id); this.editVendor = { name: vendor.name, unit: vendor.unit, ratePerUnit: vendor.ratePerUnit, isActive: vendor.isActive }; }
  saveVendor(vendor: Vendor) { this.vendorsApi.update(vendor.id, this.editVendor).subscribe({ next: () => { this.editingVendorId.set(null); this.loadVendors(); } }); }
  deleteVendor(vendor: Vendor) { if (confirm(`Delete vendor "${vendor.name}"?`)) this.vendorsApi.delete(vendor.id).subscribe({ next: () => this.loadVendors() }); }

  addRate() {
    this.vendorsApi.addRate(this.rateVendorId, {
      amount: this.newRate.amount,
      effectiveFrom: new Date(`${this.newRate.effectiveFrom}T00:00:00`).toISOString(),
      effectiveTo: this.newRate.effectiveTo ? new Date(`${this.newRate.effectiveTo}T23:59:59.999`).toISOString() : null,
    }).subscribe({
      next: () => { this.newRate = { amount: 0, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '' }; this.loadVendors(); },
      error: (error) => this.message.set(error.error || 'Could not add price period.'),
    });
  }

  addPayment() {
    if (!this.paymentAmount) return;
    this.paymentsApi.create(this.householdId, {
      vendorId: this.paymentVendorId,
      date: new Date(this.paymentDate).toISOString(),
      amount: this.paymentAmount,
      note: this.paymentNote.trim() || null,
    }).subscribe({ next: () => { this.paymentAmount = null; this.paymentNote = ''; this.loadReport(); } });
  }

  deletePayment(payment: VendorPayment) {
    if (confirm('Delete this vendor payment?')) this.paymentsApi.delete(payment.id).subscribe({ next: () => this.loadReport() });
  }

  addTransaction() {
    if (!this.transactionAmount || !this.transactionCategory.trim()) return;
    this.transactionsApi.create(this.householdId, {
      date: new Date(this.transactionDate).toISOString(),
      type: this.transactionType,
      category: this.transactionCategory.trim(),
      amount: this.transactionAmount,
      memberName: this.transactionMember.trim() || null,
      note: this.transactionNote.trim() || null,
    }).subscribe({ next: () => { this.transactionAmount = null; this.transactionCategory = ''; this.transactionNote = ''; this.loadReport(); } });
  }

  deleteTransaction(transaction: HouseholdTransaction) {
    if (confirm('Delete this cashflow record?')) this.transactionsApi.delete(transaction.id).subscribe({ next: () => this.loadReport() });
  }

  logEntry() {
    if (!this.canLog()) return;
    this.entriesApi.create(this.householdId, { vendorId: this.logVendorId, date: new Date(this.logDate).toISOString(), period: this.logPeriod, quantity: this.logQuantity!, note: this.logNote.trim() || null }).subscribe({ next: () => { this.logQuantity = null; this.logNote = ''; this.loadMonth(); } });
  }

  startEdit(entry: DailyEntry) { this.editingId.set(entry.id); this.editEntry = { date: localDateTime(new Date(entry.date)), period: entry.period, quantity: entry.quantity, ratePerUnit: entry.ratePerUnit, paidAmount: entry.paidAmount ?? 0, note: entry.note ?? '' }; }
  saveEntry(entry: DailyEntry) { this.entriesApi.update(entry.id, { ...this.editEntry, ratePerUnit: entry.ratePerUnit, paidAmount: entry.paidAmount, date: new Date(this.editEntry.date).toISOString(), note: this.editEntry.note.trim() || null }).subscribe({ next: () => { this.editingId.set(null); this.loadMonth(); } }); }
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