import { describe, expect, it } from 'vitest';
import { buildWorkbook, readSpreadsheet } from './spreadsheet';

describe('spreadsheet helpers', () => {
  it('round-trips a workbook through the custom OOXML reader', async () => {
    const workbook = buildWorkbook([
      {
        name: 'Entries',
        rows: [
          { Date: '2026-08-09', Vendor: 'Milk vendor', Quantity: 2, Rate: 60, Amount: 120, Note: 'Morning' },
          { Date: '2026-08-10', Vendor: 'Bread', Quantity: 1, Rate: 35, Amount: 35, Note: 'Evening' },
        ],
      },
    ]);

    const rows = await readSpreadsheet(new File([workbook], 'entries.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

    expect(rows).toEqual([
      { Date: '2026-08-09', Vendor: 'Milk vendor', Quantity: '2', Rate: '60', Amount: '120', Note: 'Morning' },
      { Date: '2026-08-10', Vendor: 'Bread', Quantity: '1', Rate: '35', Amount: '35', Note: 'Evening' },
    ]);
  });

  it('accepts CSV files with a UTF-8 BOM in the first header', async () => {
    const csv = '\uFEFFDate,Type,Category,Amount\r\n2026-08-09,Expense,Groceries,120\r\n';
    const rows = await readSpreadsheet(new File([csv], 'import.csv', { type: 'text/csv;charset=utf-8' }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ Date: '2026-08-09', Type: 'Expense', Category: 'Groceries', Amount: '120' });
  });
});
