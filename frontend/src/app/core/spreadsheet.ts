export interface SpreadsheetSheet {
  name: string;
  rows: Record<string, unknown>[];
  columnWidths?: number[];
}

export async function downloadSpreadsheet(sheets: SpreadsheetSheet[], fileName: string): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    const headers = Object.keys(sheet.rows[0] ?? {});
    if (headers.length) {
      worksheet.addRow(headers);
      worksheet.addRows(sheet.rows.map((row) => headers.map((header) => row[header] ?? '')));
    }
    sheet.columnWidths?.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = (worksheet.getRow(1).values as unknown[]).slice(1).map((value) => String(value ?? ''));
  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as unknown[]).slice(1);
    if (values.every((value) => value === null || value === undefined || value === '')) return;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  });
  return rows;
}