import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateHouseholdTransactionRequest, HouseholdTransactionType } from '../../core/models/household-transaction.models';
import { downloadSpreadsheet, readSpreadsheet } from '../../core/spreadsheet';

export interface PendingLedgerRecord extends CreateHouseholdTransactionRequest {
  selected: boolean;
  sourceFile: string;
}

const categoryKeywords: Record<string, string[]> = {
  Groceries: ['grocery', 'supermarket', 'mart', 'food'],
  Dining: ['restaurant', 'cafe', 'hotel', 'swiggy', 'zomato'],
  Transport: ['fuel', 'petrol', 'diesel', 'uber', 'ola', 'metro'],
  Utilities: ['electricity', 'water', 'gas', 'internet', 'mobile'],
  Healthcare: ['hospital', 'medical', 'pharmacy', 'clinic'],
  Shopping: ['store', 'shop', 'amazon', 'flipkart'],
  Salary: ['salary', 'payroll', 'income'],
};

@Component({
  selector: 'app-record-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <section class="importer">
      @if (!hasRecords) {
        <div class="starter">
          <strong>Start your family diary</strong>
          <p>No records yet. Add one manually, upload a receipt screenshot, or download the format and fill multiple records.</p>
        </div>
      }
      <div class="heading">
        <div><h3>Import records</h3><p>Read a receipt screenshot or import CSV/Excel. Review every row before saving.</p></div>
        <div class="heading-actions"><button class="secondary" type="button" (click)="downloadCsvTemplate()">Download CSV format</button><button class="secondary" type="button" (click)="downloadExcelTemplate()">Download Excel format</button><label class="upload">Choose file<input type="file" accept="image/*,.csv,.xlsx,.xls" (change)="readFile($event)" /></label></div>
      </div>

      @if (reading()) {
        <div class="loading" role="status"><span class="spinner"></span><span>{{ progress() }}</span></div>
      }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (previewUrl()) { <img class="preview" [src]="previewUrl()" alt="Uploaded record preview" /> }

      @if (pending().length) {
        <div class="review" role="region" aria-label="Review imported records">
          <h3>Confirm imported records</h3>
          <p>Edit incorrect values, uncheck unwanted rows, then confirm.</p>
          <div class="scroll"><table><thead><tr><th>Use</th><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Member</th><th>Note</th></tr></thead><tbody>
            @for (row of pending(); track $index) {
              <tr>
                <td><input type="checkbox" [(ngModel)]="row.selected" aria-label="Include record" /></td>
                <td><input type="datetime-local" [(ngModel)]="row.date" /></td>
                <td><select [(ngModel)]="row.type"><option>Expense</option><option>Income</option></select></td>
                <td><input [(ngModel)]="row.category" list="import-categories" /></td>
                <td><input class="amount" type="number" min="0.01" step="0.01" [(ngModel)]="row.amount" /></td>
                <td><input [(ngModel)]="row.memberName" /></td>
                <td><input [(ngModel)]="row.note" /></td>
              </tr>
            }
          </tbody></table></div>
          <datalist id="import-categories">@for (category of categories; track category) { <option [value]="category"></option> }</datalist>
          <div class="actions"><button class="secondary" type="button" (click)="clear()">Cancel</button><button class="primary" type="button" [disabled]="!validCount()" (click)="confirm()">Confirm {{ validCount() }} record{{ validCount() === 1 ? '' : 's' }}</button></div>
        </div>
      }
    </section>
  `,
  styles: [`
    .importer{border-top:1px solid var(--border);margin-top:1.2rem;padding-top:1.2rem}.starter{margin-bottom:1rem;padding:.8rem 1rem;border:1px solid var(--border);border-left:3px solid var(--brand);border-radius:5px;background:var(--bg)}.starter strong{font-size:.9rem}.starter p{margin:.3rem 0 0;color:var(--muted);font-size:.8rem}.heading,.heading-actions,.actions,.loading{display:flex;align-items:center;justify-content:space-between;gap:.6rem}.heading-actions{flex-wrap:wrap;justify-content:flex-end}.heading h3,.review h3{font-size:.95rem;margin:0}.heading p,.review p{color:var(--muted);font-size:.8rem;margin:.25rem 0}.upload,.primary,.secondary{border-radius:5px;padding:.55rem .8rem;cursor:pointer;font:inherit;white-space:nowrap}.upload{background:var(--brand);color:var(--brand-text);font-size:.82rem;font-weight:600}.upload input{display:none}.loading{justify-content:flex-start;color:var(--muted);font-size:.85rem;padding:1rem 0}.spinner{width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--brand);border-radius:50%;animation:spin .8s linear infinite}.error{color:#b42318}.preview{display:block;max-width:260px;max-height:180px;object-fit:contain;margin:1rem 0;border:1px solid var(--border);border-radius:5px}.review{margin-top:1rem;padding:1rem;background:var(--bg);border:1px solid var(--border);border-radius:6px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.8rem}th,td{text-align:left;padding:.5rem;border-bottom:1px solid var(--border);white-space:nowrap}input,select{min-width:120px;padding:.4rem;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text)}input.amount{min-width:90px;width:100px}.actions{justify-content:flex-end;margin-top:1rem}.primary{border:0;background:var(--brand);color:var(--brand-text)}.secondary{border:1px solid var(--border);background:var(--surface);color:var(--text)}button:disabled{opacity:.55;cursor:default}@media(max-width:760px){.heading{align-items:flex-start;flex-direction:column}.heading-actions{justify-content:flex-start}}@keyframes spin{to{transform:rotate(360deg)}}
  `],
})
export class RecordImportComponent {
  @Input() hasRecords = false;
  @Output() recordsConfirmed = new EventEmitter<CreateHouseholdTransactionRequest[]>();
  @Output() feedback = new EventEmitter<{ message: string; kind: 'success' | 'error' | 'info' }>();

  readonly pending = signal<PendingLedgerRecord[]>([]);
  readonly reading = signal(false);
  readonly progress = signal('Reading file...');
  readonly error = signal('');
  readonly previewUrl = signal('');
  readonly categories = Object.keys(categoryKeywords).concat(['Housing', 'Education', 'Entertainment', 'Personal care', 'Gifts', 'Other income', 'Other expense']);

  validCount(): number {
    return this.pending().filter((row) => row.selected && row.amount > 0 && row.category.trim() && !Number.isNaN(new Date(row.date).getTime())).length;
  }

  downloadCsvTemplate(): void {
    const rows = this.templateRows();
    const headers = Object.keys(rows[0]);
    const csv = [headers, ...rows.map((row) => headers.map((header) => String(row[header as keyof typeof row]))) ]
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    this.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'ghar-ledger-import-template.csv');
    this.feedback.emit({ message: 'CSV import format downloaded.', kind: 'success' });
  }

  async downloadExcelTemplate(): Promise<void> {
    this.feedback.emit({ message: 'Preparing Excel import format…', kind: 'info' });
    await downloadSpreadsheet([{
      name: 'Records',
      rows: this.templateRows(),
      columnWidths: [20, 12, 20, 12, 18, 36],
    }], 'ghar-ledger-import-template.xlsx');
    this.feedback.emit({ message: 'Excel import format downloaded.', kind: 'success' });
  }

  async readFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.feedback.emit({ message: `Reading ${file.name}…`, kind: 'info' });
    this.clear();
    this.reading.set(true);
    try {
      if (file.type.startsWith('image/')) await this.readImage(file);
      else await this.readWorkbook(file);
    } catch {
      this.error.set('The file could not be read. Try a clearer image or a CSV/Excel file with Date, Type, Category, Amount, Member, and Note columns.');
      this.feedback.emit({ message: 'The selected file could not be read.', kind: 'error' });
    } finally {
      this.reading.set(false);
    }
  }

  confirm(): void {
    const records = this.pending()
      .filter((row) => row.selected && row.amount > 0 && row.category.trim())
      .map(({ selected: _selected, sourceFile: _sourceFile, ...row }) => ({ ...row, date: new Date(row.date).toISOString() }));
    if (!records.length) return;
    this.recordsConfirmed.emit(records);
    this.feedback.emit({ message: `${records.length} record${records.length === 1 ? '' : 's'} confirmed. Saving…`, kind: 'info' });
    this.clear();
  }

  clear(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set('');
    this.pending.set([]);
    this.error.set('');
  }

  private async readImage(file: File): Promise<void> {
    this.previewUrl.set(URL.createObjectURL(file));
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', undefined, {
      logger: (status) => {
        const percentage = status.progress ? ` ${Math.round(status.progress * 100)}%` : '';
        this.progress.set(`${status.status.replace(/_/g, ' ')}${percentage}`);
      },
    });
    try {
      const result = await worker.recognize(file);
      const text = result.data.text.trim();
      if (!text) throw new Error('No text found');
      this.pending.set([this.recordFromText(text, file.name)]);
    } finally {
      await worker.terminate();
    }
  }

  private async readWorkbook(file: File): Promise<void> {
    this.progress.set('Reading spreadsheet...');
    const rows = await readSpreadsheet(file);
    const pending = rows.map((row) => {
      const date = new Date((row['Date'] || row['date']) as string | number | Date);
      const amount = Number(row['Amount'] || row['amount']);
      const rawType = String(row['Type'] || row['type']).toLowerCase();
      const type: HouseholdTransactionType = rawType === 'income' ? 'Income' : 'Expense';
      return {
        selected: !Number.isNaN(date.getTime()) && amount > 0,
        sourceFile: file.name,
        date: this.localDateTime(Number.isNaN(date.getTime()) ? new Date() : date),
        type,
        category: String(row['Category'] || row['category'] || (type === 'Income' ? 'Other income' : 'Other expense')),
        amount: Number.isFinite(amount) ? amount : 0,
        memberName: String(row['Member'] || row['member'] || '') || null,
        note: String(row['Note'] || row['note'] || `Imported from ${file.name}`),
      } satisfies PendingLedgerRecord;
    });
    if (!pending.length) throw new Error('No rows');
    this.pending.set(pending);
  }

  private recordFromText(text: string, fileName: string): PendingLedgerRecord {
    const normalized = text.toLowerCase();
    const category = Object.entries(categoryKeywords).find(([, words]) => words.some((word) => normalized.includes(word)))?.[0] ?? 'Other expense';
    const labeledAmount = text.match(/(?:grand\s*total|total|amount|payable|paid)\D{0,12}(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1];
    const numbers = [...text.matchAll(/(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{2}))/gi)].map((match) => Number(match[1].replace(/,/g, ''))).filter(Number.isFinite);
    const amount = labeledAmount ? Number(labeledAmount.replace(/,/g, '')) : Math.max(0, ...numbers);
    const dateMatch = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
    let date = new Date();
    if (dateMatch) {
      const year = Number(dateMatch[3]) < 100 ? 2000 + Number(dateMatch[3]) : Number(dateMatch[3]);
      const parsed = new Date(year, Number(dateMatch[2]) - 1, Number(dateMatch[1]), date.getHours(), date.getMinutes());
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
    return {
      selected: amount > 0,
      sourceFile: fileName,
      date: this.localDateTime(date),
      type: 'Expense',
      category,
      amount,
      memberName: null,
      note: `Read from ${fileName}. Please verify against the image.`,
    };
  }

  private localDateTime(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private templateRows(): Record<string, string | number>[] {
    return [
      { Date: '2026-08-09 09:30', Type: 'Expense', Category: 'Groceries', Amount: 1250, Member: 'Household', Note: 'Weekly groceries' },
      { Date: '2026-08-09 10:00', Type: 'Income', Category: 'Salary', Amount: 50000, Member: 'Keshav', Note: 'Monthly salary' },
    ];
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
