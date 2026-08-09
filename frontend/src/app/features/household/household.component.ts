import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BrandBarChartComponent, BrandBarChartPoint, BrandPaginationComponent } from '@keshavsingh3197/web-ui';
import { finalize, forkJoin } from 'rxjs';
import { DailyEntry, DeliveryPeriod, MonthlyVendorTotal } from '../../core/models/daily-entry.models';
import { Household } from '../../core/models/household.models';
import { CreateHouseholdTransactionRequest, HouseholdCashflowSummary, HouseholdTransaction, HouseholdTransactionType } from '../../core/models/household-transaction.models';
import { VendorPayment } from '../../core/models/vendor-payment.models';
import { Vendor } from '../../core/models/vendor.models';
import { DailyEntriesService } from '../../core/services/daily-entries.service';
import { HouseholdsService } from '../../core/services/households.service';
import { HouseholdTransactionsService } from '../../core/services/household-transactions.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { VendorPaymentsService } from '../../core/services/vendor-payments.service';
import { VendorsService } from '../../core/services/vendors.service';
import { RecordImportComponent } from './record-import.component';

function localDateTime(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface CashflowActivity {
  id: string;
  date: string;
  type: 'Income' | 'Expense' | 'Vendor payment';
  category: string;
  amount: number;
  memberName?: string | null;
  note?: string | null;
  source: 'transaction' | 'vendorPayment';
}

@Component({
  selector: 'app-household',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandBarChartComponent, BrandPaginationComponent, CurrencyPipe, DatePipe, FormsModule, RecordImportComponent, RouterLink],
  template: `
    <div class="household">
      <header>
        <div><a class="back" routerLink="/">← All households</a><h1>{{ household()?.name ?? 'Household ledger' }}</h1></div>
        <div class="month"><button class="icon" title="Previous month" (click)="changeMonth(-1)">‹</button><input class="input" type="month" [(ngModel)]="selectedMonth" (change)="loadMonth()" /><button class="icon" title="Next month" (click)="changeMonth(1)">›</button></div>
      </header>
      @if (message()) { <div class="toast" [class]="'toast ' + messageKind()" role="status" aria-live="polite"><span>{{ message() }}</span><button type="button" title="Dismiss notification" aria-label="Dismiss notification" (click)="message.set('')">×</button></div> }

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
        @if (reportLoading() && !monthlyTotals().length) { <div class="loading" role="status"><span class="spinner"></span><span>Loading report…</span></div> }
        <section class="metrics">
          <article><span>Vendor charges</span><strong>{{ grandTotal() | currency:currencyCode() }}</strong></article>
          <article><span>Family income</span><strong>{{ cashflowSummary().income | currency:currencyCode() }}</strong></article>
          <article><span>Other expenses</span><strong>{{ cashflowSummary().expenses | currency:currencyCode() }}</strong></article>
          <article><span>Net cash left</span><strong>{{ netCashLeft() | currency:currencyCode() }}</strong></article>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Spend by vendor</h2><p>{{ reportFrom }} to {{ reportTo }}, inclusive</p></div></div>
          @if (!monthlyTotals().length) { <p class="empty">No vendor activity for this period.</p> }
          @if (monthlyTotals().length) { <brand-bar-chart [points]="vendorChartPoints()" /> }
          @if (monthlyTotals().length) {
            <div class="scroll"><table><thead><tr><th>Vendor</th><th>Deliveries</th><th>Quantity</th><th>Charged</th><th>Paid</th><th>Balance</th></tr></thead><tbody>
              @for (total of monthlyTotals(); track total.vendorId) { <tr><td>{{ total.vendorName }}</td><td>{{ total.entryCount }}</td><td>{{ total.totalQuantity }}</td><td>{{ total.totalAmount | currency:currencyCode() }}</td><td>{{ total.totalPaid | currency:currencyCode() }}</td><td>{{ total.balance | currency:currencyCode() }}</td></tr> }
            </tbody></table></div>
          }
        </section>
      }

      @if (activeTab() === 'cashflow') {
        <section class="panel">
          <div class="heading"><div><h2>Family cashflow</h2><p>Income, daily spending, and vendor payments for {{ reportFrom }} to {{ reportTo }}.</p></div><button class="secondary" type="button" [disabled]="!cashflowActivity().length || actionBusy() === 'export-all'" (click)="exportAllRecords()">{{ actionBusy() === 'export-all' ? 'Exporting…' : 'Export all' }}</button></div>
          @if (reportLoading() && !cashflowActivity().length) { <div class="loading" role="status"><span class="spinner"></span><span>Loading family diary…</span></div> }
          <section class="metrics cashflow-metrics"><article><span>Income</span><strong>{{ cashflowSummary().income | currency:currencyCode() }}</strong></article><article><span>Daily expenses</span><strong>{{ cashflowSummary().expenses | currency:currencyCode() }}</strong></article><article><span>Paid to vendors</span><strong>{{ vendorPaymentsTotal() | currency:currencyCode() }}</strong></article><article><span>Net cash left</span><strong>{{ netCashLeft() | currency:currencyCode() }}</strong></article></section>
          <section class="chart-panel"><h3>Cash movement</h3><brand-bar-chart [points]="cashflowChartPoints()" /></section>
          <p class="accrual">Accrued left after all vendor charges: <strong>{{ accruedLeft() | currency:currencyCode() }}</strong>. Outstanding vendor bills: <strong>{{ outstandingTotal() | currency:currencyCode() }}</strong>.</p>
          @if (spendByCategory().length) { <section class="categories"><h3>Spend by category</h3><brand-bar-chart [points]="categoryChartPoints()" /><div class="category-grid">@for (category of spendByCategory(); track category.name) { <div><span>{{ category.name }}</span><strong>{{ category.amount | currency:currencyCode() }}</strong></div> }</div></section> }
          <div class="form-grid">
            <label>Type<select class="input" [(ngModel)]="transactionType"><option>Expense</option><option>Income</option></select></label>
            <label>Date and time<input class="input" type="datetime-local" [(ngModel)]="transactionDate" /></label>
            <label>Category<select class="input" [(ngModel)]="transactionCategory"><option value="">Select category</option>@for (group of categoryGroups; track group.label) { <optgroup [label]="group.label">@for (category of group.values; track category) { <option [value]="category">{{ category }}</option> }</optgroup> }</select></label>
            <label>Amount<input class="input" type="number" min="0.01" step="0.01" [(ngModel)]="transactionAmount" /></label>
            <label>Family member<input class="input" [(ngModel)]="transactionMember" placeholder="Optional" /></label>
            <label>Note<input class="input" [(ngModel)]="transactionNote" placeholder="Optional" /></label>
          </div>
          <button class="primary" [disabled]="!transactionCategory.trim() || !transactionAmount || actionBusy() === 'transaction'" (click)="addTransaction()">{{ actionBusy() === 'transaction' ? 'Adding record…' : 'Add record' }}</button>
          <app-record-import [hasRecords]="cashflowActivity().length > 0" (recordsConfirmed)="importCashflowRecords($event)" (feedback)="notify($event.message, $event.kind)" />
          @if (savingImport()) { <div class="loading" role="status"><span class="spinner"></span><span>Saving confirmed records…</span></div> }
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Family diary</h2><p>{{ cashflowActivity().length }} records, including vendor payments</p></div></div>
          @if (!reportLoading() && !cashflowActivity().length) { <p class="empty">No income, expense, or vendor payment records in this period.</p> }
          @if (cashflowActivity().length) { <div class="scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Member</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>@for (activity of pagedCashflowActivity(); track activity.source + activity.id) { <tr><td>{{ activity.date | date:'medium' }}</td><td>{{ activity.type }}</td><td>{{ activity.category }}</td><td>{{ activity.memberName || 'Household' }}</td><td>{{ activity.amount | currency:currencyCode() }}</td><td>{{ activity.note || '—' }}</td><td><button class="icon danger" title="Delete record" (click)="deleteCashflowActivity(activity)">×</button></td></tr> }</tbody></table></div> }
          @if (cashflowPageCount() > 1) { <brand-pagination [skip]="(cashflowPage() - 1) * 10" [take]="10" [total]="cashflowActivity().length" [busy]="reportLoading()" (pageChange)="cashflowPage.set(cashflowPage() + $event)">Page {{ cashflowPage() }} of {{ cashflowPageCount() }}</brand-pagination> }
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
            <button class="primary" [disabled]="!canLog() || actionBusy() === 'delivery'" (click)="logEntry()">{{ actionBusy() === 'delivery' ? 'Adding delivery…' : 'Add delivery' }}</button>
          }
        </section>
        <section class="panel">
          <div class="heading"><div><h2>{{ monthLabel() }} entries</h2><p>{{ monthEntries().length }} delivery records</p></div><div class="actions"><input #fileInput hidden type="file" accept=".xlsx,.xls,.csv" (change)="importWorkbook($event)" /><button class="secondary" type="button" [disabled]="actionBusy() === 'delivery-template'" (click)="downloadDeliveryTemplate()">{{ actionBusy() === 'delivery-template' ? 'Preparing…' : 'Download format' }}</button><button class="secondary" [disabled]="actionBusy() === 'delivery-import'" (click)="fileInput.click()">{{ actionBusy() === 'delivery-import' ? 'Importing…' : 'Import Excel' }}</button><button class="secondary" [disabled]="!monthEntries().length || actionBusy() === 'delivery-export'" (click)="exportWorkbook()">{{ actionBusy() === 'delivery-export' ? 'Exporting…' : 'Export Excel' }}</button></div></div>
          @if (monthLoading() && !monthEntries().length) { <div class="loading" role="status"><span class="spinner"></span><span>Loading deliveries…</span></div> }
          @if (!monthLoading() && !monthEntries().length) { <p class="empty">No deliveries for this month.</p> }
          @if (monthEntries().length) { <div class="scroll"><table><thead><tr><th>Date</th><th>Period</th><th>Vendor</th><th>Qty</th><th>Captured rate</th><th>Charged</th><th>Note</th><th></th></tr></thead><tbody>
            @for (entry of pagedEntries(); track entry.id) {
              <tr>
                @if (editingId() === entry.id) {
                  <td><input class="cell-input" type="datetime-local" [(ngModel)]="editEntry.date" /></td><td><select class="cell-input" [(ngModel)]="editEntry.period"><option>Morning</option><option>Evening</option><option>Anytime</option></select></td><td>{{ vendorName(entry.vendorId) }}</td><td><input class="cell-input number" type="number" [(ngModel)]="editEntry.quantity" /></td><td>{{ entry.ratePerUnit | currency:currencyCode() }}</td><td>{{ editEntry.quantity * entry.ratePerUnit | currency:currencyCode() }}</td><td><input class="cell-input" [(ngModel)]="editEntry.note" /></td><td class="row-actions"><button class="icon" title="Save" (click)="saveEntry(entry)">✓</button><button class="icon" title="Cancel" (click)="editingId.set(null)">×</button></td>
                } @else {
                  <td>{{ entry.date | date:'medium' }}</td><td>{{ entry.period }}</td><td>{{ vendorName(entry.vendorId) }}</td><td>{{ entry.quantity }}</td><td>{{ entry.ratePerUnit | currency:currencyCode() }}</td><td>{{ entry.amount | currency:currencyCode() }}</td><td>{{ entry.note || '—' }}</td><td class="row-actions"><button class="icon" title="Edit" (click)="startEdit(entry)">✎</button><button class="icon danger" title="Delete" (click)="deleteEntry(entry)">×</button></td>
                }
              </tr>
            }
          </tbody></table></div> }
          @if (pageCount() > 1) { <brand-pagination [skip]="(page() - 1) * 10" [take]="10" [total]="monthEntries().length" [busy]="monthLoading()" (pageChange)="page.set(page() + $event)">Page {{ page() }} of {{ pageCount() }}</brand-pagination> }
        </section>
      }

      @if (activeTab() === 'vendors') {
        <section class="panel">
          <div class="heading"><div><h2>Vendors</h2><p>Prices use inclusive start and end dates.</p></div></div>
          @if (vendorsLoading() && !vendors().length) { <div class="loading" role="status"><span class="spinner"></span><span>Loading vendors…</span></div> }
          @if (!vendorsLoading() && !vendors().length) { <p class="empty">No vendors yet.</p> }
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
          <button class="primary" [disabled]="!newVendor.name.trim() || actionBusy() === 'vendor'" (click)="addVendor()">{{ actionBusy() === 'vendor' ? 'Adding vendor…' : 'Add vendor' }}</button>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Add vendor price</h2><p>Leave the end date empty for an ongoing price.</p></div></div>
          <div class="form-grid"><label>Vendor<select class="input" [(ngModel)]="rateVendorId">@for (vendor of vendors(); track vendor.id) { <option [value]="vendor.id">{{ vendor.name }}</option> }</select></label><label>Price per unit<input class="input" type="number" min="0" step="0.01" [(ngModel)]="newRate.amount" /></label><label>From<input class="input" type="date" [(ngModel)]="newRate.effectiveFrom" /></label><label>To (included)<input class="input" type="date" [(ngModel)]="newRate.effectiveTo" /></label></div>
          <button class="primary" [disabled]="!rateVendorId || newRate.amount < 0 || !newRate.effectiveFrom || actionBusy() === 'rate'" (click)="addRate()">{{ actionBusy() === 'rate' ? 'Adding price…' : 'Add price' }}</button>
        </section>
        <section class="panel">
          <div class="heading"><div><h2>Vendor payments</h2><p>Record money separately from deliveries, with the exact date and time.</p></div></div>
          <div class="form-grid"><label>Vendor<select class="input" [(ngModel)]="paymentVendorId">@for (vendor of vendors(); track vendor.id) { <option [value]="vendor.id">{{ vendor.name }}</option> }</select></label><label>Date and time<input class="input" type="datetime-local" [(ngModel)]="paymentDate" /></label><label>Amount<input class="input" type="number" min="0.01" step="0.01" [(ngModel)]="paymentAmount" /></label><label>Note<input class="input" [(ngModel)]="paymentNote" placeholder="Optional" /></label></div>
          <button class="primary" [disabled]="!paymentVendorId || !paymentDate || !paymentAmount || actionBusy() === 'payment'" (click)="addPayment()">{{ actionBusy() === 'payment' ? 'Recording payment…' : 'Record payment' }}</button>
          <div class="scroll payment-list"><table><thead><tr><th>Date</th><th>Vendor</th><th>Paid</th><th>Note</th><th></th></tr></thead><tbody>@for (payment of vendorPayments(); track payment.id) { <tr><td>{{ payment.date | date:'medium' }}</td><td>{{ vendorName(payment.vendorId) }}</td><td>{{ payment.amount | currency:currencyCode() }}</td><td>{{ payment.note || '—' }}</td><td><button class="icon danger" title="Delete payment" (click)="deletePayment(payment)">×</button></td></tr> }</tbody></table></div>
        </section>
      }
    </div>
  `,
  styles: [`
    .household{max-width:1120px;margin:0 auto}header,.heading,.vendor,.actions,.pagination{display:flex;align-items:center;justify-content:space-between;gap:1rem}.back{color:var(--muted);text-decoration:none;font-size:.85rem}h1{margin:.35rem 0;font-size:1.65rem}h2{margin:0;font-size:1.05rem}.heading p{color:var(--muted);font-size:.84rem;margin:.25rem 0}.month{display:flex;align-items:center;gap:.4rem}nav{display:flex;gap:1.4rem;border-bottom:1px solid var(--border);margin:1.25rem 0 1rem}nav button{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);padding:.7rem .1rem;cursor:pointer;font-weight:600}nav button.active{color:var(--text);border-color:var(--brand)}.panel,.metrics article{background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-sm)}.panel{padding:1.25rem;margin-bottom:1rem}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem}.metrics article{padding:1rem}.metrics span{display:block;color:var(--muted);font-size:.76rem;margin-bottom:.35rem}.metrics strong{font-size:1.2rem}.notice{padding:.7rem 1rem;border-left:3px solid var(--brand);background:color-mix(in srgb,var(--brand) 10%,var(--surface))}.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:1rem 0}label{color:var(--muted);font-size:.76rem;font-weight:600}.input,.cell-input{display:block;box-sizing:border-box;width:100%;padding:.52rem .65rem;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:5px;margin-top:.3rem}.cell-input{min-width:120px;margin:0}.cell-input.number{min-width:72px;width:76px}.primary,.secondary,.icon{font:inherit;border-radius:5px;cursor:pointer}.primary{border:0;background:var(--brand);color:var(--brand-text);padding:.58rem 1rem;font-weight:600}.secondary{border:1px solid var(--border);background:transparent;color:var(--text);padding:.5rem .8rem}.icon{width:32px;height:32px;border:1px solid var(--border);background:var(--surface);color:var(--text)}button:disabled{opacity:.5;cursor:default}.danger:hover{border-color:#b42318;color:#b42318}.bar-row{display:grid;grid-template-columns:minmax(100px,1fr) 4fr minmax(85px,auto);align-items:center;gap:.75rem;margin:.85rem 0;font-size:.84rem}.track{height:10px;background:var(--border);overflow:hidden}.bar{height:100%;background:var(--brand);min-width:2px}.scroll{overflow-x:auto;margin-top:1rem}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.65rem;border-bottom:1px solid var(--border);font-size:.84rem;white-space:nowrap}th{color:var(--muted);font-size:.7rem;text-transform:uppercase}.row-actions{display:flex;gap:.25rem}.pagination{justify-content:flex-end;margin-top:1rem;color:var(--muted);font-size:.8rem}.vendor{justify-content:flex-start;padding:.65rem 0;border-bottom:1px solid var(--border)}.vendor strong{min-width:160px}.vendor .status{margin-left:auto;color:var(--muted);font-size:.76rem}.vendor.inactive{opacity:.6}.vendor>.input{margin:0}.check{display:flex;align-items:center;gap:.35rem;white-space:nowrap}.add-vendor{border-top:1px solid var(--border);padding-top:1rem}.empty{text-align:center;color:var(--muted);padding:1.5rem}.month .input{margin:0}@media(max-width:760px){header,.heading{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}.form-grid{grid-template-columns:1fr}.vendor{flex-wrap:wrap}.vendor .status{margin-left:0}.bar-row{grid-template-columns:85px 1fr 75px}}
  `, `
    .toast{position:fixed;top:68px;right:1rem;z-index:20;display:flex;align-items:center;gap:1rem;max-width:min(420px,calc(100vw - 2rem));padding:.75rem .85rem;border:1px solid var(--border);border-left:4px solid var(--brand);border-radius:6px;background:var(--surface);box-shadow:0 10px 28px rgba(0,0,0,.18);font-size:.85rem}.toast.success{border-left-color:#16834b}.toast.error{border-left-color:#c5221f}.toast.info{border-left-color:var(--brand)}.toast button{margin-left:auto;border:0;background:transparent;color:var(--muted);font-size:1.15rem;cursor:pointer}.loading{display:flex;align-items:center;justify-content:center;gap:.65rem;min-height:72px;color:var(--muted);font-size:.85rem}.spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--brand);border-radius:50%;animation:spin .8s linear infinite}.chart-panel{margin:1rem 0;padding:1rem;border:1px solid var(--border);border-radius:6px;background:var(--bg)}.chart-panel h3{font-size:.9rem;margin:0}.accrual{margin:.25rem 0 1rem;padding:.65rem .8rem;background:var(--bg);border-left:3px solid var(--brand);color:var(--muted);font-size:.82rem}.accrual strong{color:var(--text)}.categories{margin:1rem 0}.categories h3{font-size:.9rem;margin:0 0 .6rem}.category-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem}.category-grid div{display:flex;justify-content:space-between;gap:.5rem;padding:.55rem .65rem;border:1px solid var(--border);border-radius:5px;background:var(--bg);font-size:.78rem}.category-grid span{color:var(--muted)}brand-pagination{margin-top:1rem}@keyframes spin{to{transform:rotate(360deg)}}
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
  readonly cashflowPage = signal(1);
  readonly monthLoading = signal(true);
  readonly reportLoading = signal(true);
  readonly vendorsLoading = signal(true);
  readonly savingImport = signal(false);
  readonly actionBusy = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editingVendorId = signal<string | null>(null);
  readonly message = signal('');
  readonly messageKind = signal<'success' | 'error' | 'info'>('info');
  readonly activeVendors = computed(() => this.vendors().filter((vendor) => vendor.isActive));
  readonly grandTotal = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.totalAmount, 0));
  readonly previousGrandTotal = computed(() => this.previousTotals().reduce((sum, total) => sum + total.totalAmount, 0));
  readonly entryCount = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.entryCount, 0));
  readonly outstandingTotal = computed(() => this.monthlyTotals().reduce((sum, total) => sum + total.balance, 0));
  readonly vendorPaymentsTotal = computed(() => this.vendorPayments().reduce((sum, payment) => sum + payment.amount, 0));
  readonly netCashLeft = computed(() => this.cashflowSummary().income - this.cashflowSummary().expenses - this.vendorPaymentsTotal());
  readonly accruedLeft = computed(() => this.cashflowSummary().income - this.cashflowSummary().expenses - this.grandTotal());
  readonly currencyCode = computed(() => this.preferences.value().currency);
  readonly monthChange = computed(() => this.previousGrandTotal() ? (this.grandTotal() - this.previousGrandTotal()) / this.previousGrandTotal() * 100 : this.grandTotal() ? 100 : 0);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.monthEntries().length / 10)));
  readonly pagedEntries = computed(() => this.monthEntries().slice((this.page() - 1) * 10, this.page() * 10));
  readonly cashflowActivity = computed<CashflowActivity[]>(() => [
    ...this.transactions().map((transaction) => ({
      id: transaction.id, date: transaction.date, type: transaction.type, category: transaction.category,
      amount: transaction.amount, memberName: transaction.memberName, note: transaction.note, source: 'transaction' as const,
    })),
    ...this.vendorPayments().map((payment) => ({
      id: payment.id, date: payment.date, type: 'Vendor payment' as const, category: `Vendor: ${this.vendorName(payment.vendorId)}`,
      amount: payment.amount, memberName: null, note: payment.note, source: 'vendorPayment' as const,
    })),
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()));
  readonly cashflowPageCount = computed(() => Math.max(1, Math.ceil(this.cashflowActivity().length / 10)));
  readonly pagedCashflowActivity = computed(() => this.cashflowActivity().slice((this.cashflowPage() - 1) * 10, this.cashflowPage() * 10));
  readonly spendByCategory = computed(() => {
    const totals = new Map<string, number>();
    for (const transaction of this.transactions().filter((item) => item.type === 'Expense')) {
      totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
    }
    if (this.vendorPaymentsTotal()) totals.set('Vendor payments', this.vendorPaymentsTotal());
    return [...totals].map(([name, amount]) => ({ name, amount })).sort((left, right) => right.amount - left.amount);
  });
  readonly vendorChartPoints = computed<BrandBarChartPoint[]>(() => this.monthlyTotals().map((total) => ({ label: total.vendorName, value: total.totalAmount })));
  readonly cashflowChartPoints = computed<BrandBarChartPoint[]>(() => [
    { label: 'Income', value: this.cashflowSummary().income },
    { label: 'Daily expenses', value: this.cashflowSummary().expenses },
    { label: 'Vendor payments', value: this.vendorPaymentsTotal() },
  ]);
  readonly categoryChartPoints = computed<BrandBarChartPoint[]>(() => this.spendByCategory().map((category) => ({ label: category.name, value: category.amount })));

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
  readonly categoryGroups = [
    { label: 'Home', values: ['Groceries', 'Housing', 'Utilities', 'Household supplies'] },
    { label: 'Family', values: ['Healthcare', 'Education', 'Childcare', 'Personal care', 'Gifts'] },
    { label: 'Lifestyle', values: ['Dining', 'Transport', 'Shopping', 'Entertainment', 'Travel'] },
    { label: 'Income', values: ['Salary', 'Business income', 'Interest', 'Refund', 'Other income'] },
    { label: 'Other', values: ['Other expense'] },
  ];

  constructor(private route: ActivatedRoute, private householdsApi: HouseholdsService, private vendorsApi: VendorsService, private entriesApi: DailyEntriesService, private paymentsApi: VendorPaymentsService, private transactionsApi: HouseholdTransactionsService, private preferences: PreferencesService) {}

  ngOnInit() {
    this.householdId = this.route.snapshot.paramMap.get('id') ?? '';
    this.householdsApi.getById(this.householdId).subscribe({ next: (household) => this.household.set(household) });
    this.loadVendors();
    this.loadMonth();
  }

  loadVendors() {
    this.vendorsLoading.set(true);
    this.vendorsApi.list(this.householdId).pipe(finalize(() => this.vendorsLoading.set(false))).subscribe({ next: (vendors) => {
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
    this.monthLoading.set(true);
    forkJoin({
      entries: this.entriesApi.list(this.householdId, new Date(year, month - 1, 1), new Date(year, month, 1)),
      previous: this.entriesApi.monthlyTotals(this.householdId, previous.getFullYear(), previous.getMonth() + 1),
    }).pipe(finalize(() => this.monthLoading.set(false))).subscribe({ next: (result) => { this.monthEntries.set(result.entries); this.previousTotals.set(result.previous); } });
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

  notify(message: string, kind: 'success' | 'error' | 'info' = 'success') {
    this.messageKind.set(kind);
    this.message.set(message);
    window.setTimeout(() => { if (this.message() === message) this.message.set(''); }, 4500);
  }

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
    this.reportLoading.set(true);
    this.cashflowPage.set(1);
    forkJoin({
      totals: this.entriesApi.rangeTotals(this.householdId, from, toExclusive),
      payments: this.paymentsApi.list(this.householdId, from, toExclusive),
      transactions: this.transactionsApi.list(this.householdId, from, toExclusive),
      cashflow: this.transactionsApi.summary(this.householdId, from, toExclusive),
    }).pipe(finalize(() => this.reportLoading.set(false))).subscribe({
      next: (result) => { this.monthlyTotals.set(result.totals); this.vendorPayments.set(result.payments); this.transactions.set(result.transactions); this.cashflowSummary.set(result.cashflow); },
      error: () => this.notify('The report could not be loaded. Please try again.', 'error'),
    });
  }

  addVendor() {
    const name = this.newVendor.name.trim();
    if (!name) return;
    this.actionBusy.set('vendor');
    this.vendorsApi.create(this.householdId, { ...this.newVendor, name }).pipe(finalize(() => this.actionBusy.set(''))).subscribe({
      next: () => { this.newVendor = { name: '', unit: 'liter', ratePerUnit: 0 }; this.notify('Vendor added.'); this.loadVendors(); },
      error: () => this.notify('Vendor could not be added.', 'error'),
    });
  }

  startVendorEdit(vendor: Vendor) { this.editingVendorId.set(vendor.id); this.editVendor = { name: vendor.name, unit: vendor.unit, ratePerUnit: vendor.ratePerUnit, isActive: vendor.isActive }; }
  saveVendor(vendor: Vendor) { this.actionBusy.set(`vendor-${vendor.id}`); this.vendorsApi.update(vendor.id, this.editVendor).pipe(finalize(() => this.actionBusy.set(''))).subscribe({ next: () => { this.editingVendorId.set(null); this.notify('Vendor updated.'); this.loadVendors(); }, error: () => this.notify('Vendor could not be updated.', 'error') }); }
  deleteVendor(vendor: Vendor) { if (confirm(`Delete vendor "${vendor.name}"?`)) { this.actionBusy.set(`vendor-${vendor.id}`); this.vendorsApi.delete(vendor.id).pipe(finalize(() => this.actionBusy.set(''))).subscribe({ next: () => { this.notify('Vendor deleted.'); this.loadVendors(); }, error: () => this.notify('Vendor could not be deleted.', 'error') }); } }

  addRate() {
    this.actionBusy.set('rate');
    this.vendorsApi.addRate(this.rateVendorId, {
      amount: this.newRate.amount,
      effectiveFrom: new Date(`${this.newRate.effectiveFrom}T00:00:00`).toISOString(),
      effectiveTo: this.newRate.effectiveTo ? new Date(`${this.newRate.effectiveTo}T23:59:59.999`).toISOString() : null,
    }).pipe(finalize(() => this.actionBusy.set(''))).subscribe({
      next: () => { this.newRate = { amount: 0, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '' }; this.notify('Vendor price added.'); this.loadVendors(); },
      error: (error) => this.notify(error.error || 'Could not add price period.', 'error'),
    });
  }

  addPayment() {
    if (!this.paymentAmount) return;
    this.actionBusy.set('payment');
    this.paymentsApi.create(this.householdId, {
      vendorId: this.paymentVendorId,
      date: new Date(this.paymentDate).toISOString(),
      amount: this.paymentAmount,
      note: this.paymentNote.trim() || null,
    }).pipe(finalize(() => this.actionBusy.set(''))).subscribe({ next: () => { this.paymentAmount = null; this.paymentNote = ''; this.notify('Vendor payment recorded.'); this.loadReport(); }, error: () => this.notify('Vendor payment could not be recorded.', 'error') });
  }

  deletePayment(payment: VendorPayment) {
    if (confirm('Delete this vendor payment?')) this.paymentsApi.delete(payment.id).subscribe({ next: () => { this.notify('Vendor payment deleted.'); this.loadReport(); }, error: () => this.notify('Vendor payment could not be deleted.', 'error') });
  }

  addTransaction() {
    if (!this.transactionAmount || !this.transactionCategory.trim()) return;
    this.actionBusy.set('transaction');
    this.transactionsApi.create(this.householdId, {
      date: new Date(this.transactionDate).toISOString(),
      type: this.transactionType,
      category: this.transactionCategory.trim(),
      amount: this.transactionAmount,
      memberName: this.transactionMember.trim() || null,
      note: this.transactionNote.trim() || null,
    }).pipe(finalize(() => this.actionBusy.set(''))).subscribe({ next: () => { this.transactionAmount = null; this.transactionCategory = ''; this.transactionNote = ''; this.notify('Family record added.'); this.loadReport(); }, error: () => this.notify('Family record could not be added.', 'error') });
  }

  deleteTransaction(transaction: HouseholdTransaction) {
    if (confirm('Delete this cashflow record?')) this.transactionsApi.delete(transaction.id).subscribe({ next: () => { this.notify('Family record deleted.'); this.loadReport(); }, error: () => this.notify('Family record could not be deleted.', 'error') });
  }

  deleteCashflowActivity(activity: CashflowActivity) {
    if (activity.source === 'vendorPayment') {
      const payment = this.vendorPayments().find((item) => item.id === activity.id);
      if (payment) this.deletePayment(payment);
      return;
    }
    const transaction = this.transactions().find((item) => item.id === activity.id);
    if (transaction) this.deleteTransaction(transaction);
  }

  importCashflowRecords(records: CreateHouseholdTransactionRequest[]) {
    if (!records.length) return;
    this.savingImport.set(true);
    forkJoin(records.map((record) => this.transactionsApi.create(this.householdId, record)))
      .pipe(finalize(() => this.savingImport.set(false)))
      .subscribe({
        next: () => { this.notify(`Imported ${records.length} confirmed record${records.length === 1 ? '' : 's'}.`); this.loadReport(); },
        error: () => this.notify('Some records could not be imported. Review the file and try again.', 'error'),
      });
  }

  async exportAllRecords() {
    this.actionBusy.set('export-all');
    this.notify('Preparing the complete workbook…', 'info');
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const cashflow = this.cashflowActivity().map((item) => ({ Date: new Date(item.date).toLocaleString(), Type: item.type, Category: item.category, Amount: item.amount, Member: item.memberName ?? '', Note: item.note ?? '' }));
      const deliveries = this.monthEntries().map((entry) => ({ Date: new Date(entry.date).toLocaleString(), Period: entry.period, Vendor: this.vendorName(entry.vendorId), Quantity: entry.quantity, Rate: entry.ratePerUnit, Amount: entry.amount, Note: entry.note ?? '' }));
      const vendors = this.vendors().flatMap((vendor) => vendor.rates.length
        ? vendor.rates.map((rate) => ({ Vendor: vendor.name, Unit: vendor.unit, Rate: rate.amount, From: rate.effectiveFrom, To: rate.effectiveTo ?? '', Active: vendor.isActive }))
        : [{ Vendor: vendor.name, Unit: vendor.unit, Rate: vendor.ratePerUnit, From: '', To: '', Active: vendor.isActive }]);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cashflow), 'Family cashflow');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(deliveries), 'Deliveries');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(vendors), 'Vendors and prices');
      XLSX.writeFile(workbook, `ghar-ledger-records-${this.reportFrom}-to-${this.reportTo}.xlsx`);
      this.notify('Complete workbook downloaded.');
    } catch {
      this.notify('The workbook could not be created.', 'error');
    } finally {
      this.actionBusy.set('');
    }
  }

  logEntry() {
    if (!this.canLog()) return;
    this.actionBusy.set('delivery');
    this.entriesApi.create(this.householdId, { vendorId: this.logVendorId, date: new Date(this.logDate).toISOString(), period: this.logPeriod, quantity: this.logQuantity!, note: this.logNote.trim() || null }).pipe(finalize(() => this.actionBusy.set(''))).subscribe({ next: () => { this.logQuantity = null; this.logNote = ''; this.notify('Delivery added.'); this.loadMonth(); }, error: () => this.notify('Delivery could not be added.', 'error') });
  }

  startEdit(entry: DailyEntry) { this.editingId.set(entry.id); this.editEntry = { date: localDateTime(new Date(entry.date)), period: entry.period, quantity: entry.quantity, ratePerUnit: entry.ratePerUnit, paidAmount: entry.paidAmount ?? 0, note: entry.note ?? '' }; }
  saveEntry(entry: DailyEntry) { this.entriesApi.update(entry.id, { ...this.editEntry, ratePerUnit: entry.ratePerUnit, paidAmount: entry.paidAmount, date: new Date(this.editEntry.date).toISOString(), note: this.editEntry.note.trim() || null }).subscribe({ next: () => { this.editingId.set(null); this.notify('Delivery updated.'); this.loadMonth(); }, error: () => this.notify('Delivery could not be updated.', 'error') }); }
  deleteEntry(entry: DailyEntry) { if (confirm('Delete this delivery?')) this.entriesApi.delete(entry.id).subscribe({ next: () => { this.notify('Delivery deleted.'); this.loadMonth(); }, error: () => this.notify('Delivery could not be deleted.', 'error') }); }

  async exportWorkbook() {
    this.actionBusy.set('delivery-export');
    this.notify('Preparing delivery export…', 'info');
    try {
      const XLSX = await import('xlsx');
      const rows = this.monthEntries().map((entry) => ({ Date: new Date(entry.date).toLocaleString(), Period: entry.period, Vendor: this.vendorName(entry.vendorId), Quantity: entry.quantity, Rate: entry.ratePerUnit, Amount: entry.amount, Paid: entry.paidAmount, Balance: entry.amount - entry.paidAmount, Note: entry.note ?? '' }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Entries');
      XLSX.writeFile(workbook, `ghar-ledger-${this.selectedMonth}.xlsx`);
      this.notify('Delivery export downloaded.');
    } catch { this.notify('Delivery export could not be created.', 'error'); }
    finally { this.actionBusy.set(''); }
  }

  async downloadDeliveryTemplate() {
    this.actionBusy.set('delivery-template');
    this.notify('Preparing delivery import format…', 'info');
    try {
      const XLSX = await import('xlsx');
      const rows = [{ Vendor: 'Milk vendor', Date: '2026-08-09 07:30', Quantity: 1, Rate: 60, Period: 'Morning', Note: 'Daily milk' }];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Deliveries');
      XLSX.writeFile(workbook, 'ghar-ledger-delivery-import-template.xlsx');
      this.notify('Delivery import format downloaded.');
    } catch { this.notify('Delivery format could not be created.', 'error'); }
    finally { this.actionBusy.set(''); }
  }

  async importWorkbook(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.actionBusy.set('delivery-import');
    this.notify(`Reading ${file.name}…`, 'info');
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
    if (!requests.length) { this.notify('No valid rows found. Use Vendor, Date, Quantity, Rate, Period, and Note columns.', 'error'); input.value = ''; this.actionBusy.set(''); return; }
    forkJoin(requests).pipe(finalize(() => this.actionBusy.set(''))).subscribe({ next: () => { this.notify(`Imported ${requests.length} deliveries. Invalid rows were skipped.`); input.value = ''; this.loadMonth(); }, error: () => this.notify('Delivery import failed. Check the file and try again.', 'error') });
  }
}