/**
 * Excel import/export for the ledger screens, written against the file formats directly rather than
 * a spreadsheet library.
 *
 * The .xlsx we produce is a plain ZIP of OOXML parts and the reader is the same thing in reverse, so
 * the whole path is inspectable and testable (see spreadsheet.spec.ts) instead of depending on a
 * ~950 kB CommonJS bundle whose browser build has to survive bundler interop to work at all — the
 * failure mode there is every Download/Import/Export button doing nothing, with no way to tell why.
 *
 * Entries are stored uncompressed: these sheets are a few hundred rows, the saving is irrelevant,
 * and it keeps writing free of any streaming-compression API. Reading still handles deflated entries
 * (files produced by Excel itself) via the platform's DecompressionStream.
 */

export interface SpreadsheetSheet {
  name: string;
  rows: Record<string, unknown>[];
  columnWidths?: number[];
}

const SHEET_XMLNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELS_XMLNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DOC_RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Builds the workbook and hands it to the browser as a download. */
export async function downloadSpreadsheet(sheets: SpreadsheetSheet[], fileName: string): Promise<void> {
  const blob = new Blob([buildWorkbook(sheets) as BlobPart], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  // Safari and mobile browsers may not have consumed the Blob before this turn finishes.
  // Removing/revoking synchronously made downloads appear to do nothing on those browsers.
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/** Reads the first worksheet of an .xlsx (or a .csv) into one object per row, keyed by header. */
export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // A ZIP always starts "PK"; anything else that got this far is treated as delimited text, which
  // is what people actually hand these screens when they say "Excel file".
  return bytes[0] === 0x50 && bytes[1] === 0x4b
    ? await readXlsx(bytes)
    : parseDelimited(new TextDecoder().decode(bytes));
}

// ---- Workbook writing ----

/** The complete .xlsx as bytes. Exported for tests; screens use downloadSpreadsheet. */
export function buildWorkbook(sheets: SpreadsheetSheet[]): Uint8Array {
  const named = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }];
  const files: ZipEntry[] = [
    { name: '[Content_Types].xml', data: contentTypesXml(named.length) },
    { name: '_rels/.rels', data: rootRelsXml() },
    { name: 'xl/workbook.xml', data: workbookXml(named) },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml(named.length) },
    { name: 'xl/styles.xml', data: stylesXml() },
    ...named.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(sheet) })),
  ];
  return zip(files);
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return xmlHeader()
    + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
    + overrides + `</Types>`;
}

function rootRelsXml(): string {
  return xmlHeader() + `<Relationships xmlns="${RELS_XMLNS}">`
    + `<Relationship Id="rId1" Type="${DOC_RELS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function workbookXml(sheets: SpreadsheetSheet[]): string {
  const entries = sheets.map((sheet, index) =>
    `<sheet name="${escapeXml(sheetName(sheet.name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  return xmlHeader() + `<workbook xmlns="${SHEET_XMLNS}" xmlns:r="${DOC_RELS}"><sheets>${entries}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="${DOC_RELS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
  return xmlHeader() + `<Relationships xmlns="${RELS_XMLNS}">${sheetRels}`
    + `<Relationship Id="rId${sheetCount + 1}" Type="${DOC_RELS}/styles" Target="styles.xml"/></Relationships>`;
}

/** Two cell formats: plain, and bold for the header row (style index 1). */
function stylesXml(): string {
  return xmlHeader() + `<styleSheet xmlns="${SHEET_XMLNS}">`
    + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
    + `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>`
    + `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
    + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
    + `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
    + `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;
}

function sheetXml(sheet: SpreadsheetSheet): string {
  const headers = Object.keys(sheet.rows[0] ?? {});
  const cols = sheet.columnWidths?.length
    ? `<cols>${sheet.columnWidths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const rows: string[] = [];
  if (headers.length) {
    rows.push(rowXml(1, headers.map(header => cellXml(header, true))));
    sheet.rows.forEach((row, index) => {
      rows.push(rowXml(index + 2, headers.map(header => cellXml(row[header] ?? '', false))));
    });
  }
  return xmlHeader() + `<worksheet xmlns="${SHEET_XMLNS}">${cols}<sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function rowXml(rowNumber: number, cells: CellContent[]): string {
  const body = cells
    .map((cell, index) => cell.empty ? '' : `<c r="${columnLetter(index)}${rowNumber}"${cell.attributes}>${cell.body}</c>`)
    .join('');
  return `<row r="${rowNumber}">${body}</row>`;
}

interface CellContent { attributes: string; body: string; empty: boolean }

/** Numbers stay numeric (so Excel can total them); everything else is written as an inline string,
 *  which avoids a shared-strings table without changing what the user sees. */
function cellXml(value: unknown, header: boolean): CellContent {
  const style = header ? ' s="1"' : '';
  if (value === null || value === undefined || value === '') return { attributes: style, body: '', empty: !header };
  if (typeof value === 'number' && Number.isFinite(value)) return { attributes: style, body: `<v>${value}</v>`, empty: false };
  if (typeof value === 'boolean') return { attributes: `${style} t="b"`, body: `<v>${value ? 1 : 0}</v>`, empty: false };
  const text = value instanceof Date ? value.toLocaleString() : String(value);
  return { attributes: `${style} t="inlineStr"`, body: `<is><t xml:space="preserve">${escapeXml(text)}</t></is>`, empty: false };
}

/** Excel rejects these characters in a tab name, and caps it at 31 chars. */
function sheetName(name: string, index: number): string {
  const cleaned = (name || `Sheet${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

function columnLetter(index: number): string {
  let letters = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) letters = String.fromCharCode(65 + (n % 26)) + letters;
  return letters;
}

function xmlHeader(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
}

function escapeXml(value: string): string {
  return stripControlCharacters(value).replace(/[&<>"']/g, ch =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&apos;');
}

/** Control characters are not representable in XML 1.0; leaving them in makes Excel declare the file
 *  corrupt, which to the person clicking Export looks exactly like "it didn't work". Tab, newline and
 *  carriage return are legal and are kept. */
function stripControlCharacters(value: string): string {
  return value.replace(/[ --]/g, '');
}

// ---- Workbook reading ----

async function readXlsx(bytes: Uint8Array): Promise<Record<string, unknown>[]> {
  const entries = readZipEntries(bytes);

  // The first sheet by workbook order, not by file name: Excel does not guarantee sheet1.xml is it.
  const workbook = await readEntryText(bytes, entries, 'xl/workbook.xml');
  const rels = await readEntryText(bytes, entries, 'xl/_rels/workbook.xml.rels');
  const target = firstSheetTarget(workbook, rels);
  const sheet = await readEntryText(bytes, entries, target)
    ?? await readEntryText(bytes, entries, 'xl/worksheets/sheet1.xml');
  if (!sheet) return [];

  const sharedStringsXml = await readEntryText(bytes, entries, 'xl/sharedStrings.xml');
  const shared = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  return rowsToObjects(parseSheetRows(sheet, shared));
}

/** Resolves the workbook's first <sheet r:id> through the relationships part to a part name. */
function firstSheetTarget(workbookXmlText: string | null, relsXmlText: string | null): string {
  const relationId = workbookXmlText?.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const target = relationId && relsXmlText
    ? relsXmlText.match(new RegExp(`<Relationship\\b[^>]*Id="${relationId}"[^>]*Target="([^"]+)"`))?.[1]
    : undefined;
  if (!target) return 'xl/worksheets/sheet1.xml';
  const normalized = target.replace(/^\//, '');
  return normalized.startsWith('xl/') ? normalized : `xl/${normalized}`;
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => textOf(match[1]));
}

/** A sheet as a grid of raw strings, blanks included, so the header row lines up with its values. */
function parseSheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)\/?>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const index = columnIndex(attributes.match(/r="([A-Z]+)\d+"/)?.[1]);
      const type = attributes.match(/t="([^"]+)"/)?.[1];
      const raw = type === 'inlineStr' || type === 'str'
        ? textOf(cellMatch[2])
        : (cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '');
      const value = type === 's' ? (shared[Number(decodeXml(raw))] ?? '') : decodeXml(raw);
      if (index >= 0) { while (cells.length < index) cells.push(''); cells[index] = value; } else cells.push(value);
    }
    rows.push(cells);
  }
  return rows;
}

function columnIndex(letters: string | undefined): number {
  if (!letters) return -1;
  return [...letters].reduce((total, ch) => total * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

/** All the text inside a fragment (`<t>` runs and plain text), with entities decoded. */
function textOf(fragment: string): string {
  const runs = [...fragment.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
  return decodeXml((runs.length ? runs.join('') : fragment.replace(/<[^>]*>/g, '')));
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Header row + value rows -> one object per row, dropping rows that are entirely blank. */
function rowsToObjects(rows: string[][]): Record<string, unknown>[] {
  const [headers, ...body] = rows;
  if (!headers?.length) return [];
  return body
    .filter(row => row.some(value => value !== '' && value !== undefined))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

/** Comma-separated text, honouring quoted fields (including embedded commas, quotes and newlines). */
function parseDelimited(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') { field += ch; continue; }
      if (text[i + 1] === '"') { field += '"'; i++; continue; }
      quoted = false;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rowsToObjects(rows.map(cells => cells.map(cell => cell.trim())));
}

// ---- ZIP container ----

interface ZipEntry { name: string; data: string }
interface ZipDirectoryEntry { name: string; method: number; compressedSize: number; localHeaderOffset: number }

/** A ZIP with every entry stored (method 0) — see the note at the top of this file. */
function zip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.data);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);            // Version needed to extract.
    localView.setUint16(6, 0x0800, true);        // Names and text are UTF-8.
    localView.setUint16(8, 0, true);             // Stored, not deflated.
    localView.setUint16(10, 0, true);            // Fixed timestamp: the bytes stay reproducible.
    localView.setUint16(12, 0x21, true);         // 1980-01-01, the earliest DOS date.
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);          // Version made by.
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x21, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);     // Where this entry's local header starts.
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return concat([...locals, ...centrals, end]);
}

function readZipEntries(bytes: Uint8Array): ZipDirectoryEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is last, but a trailing comment can push it back a little.
  let end = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 0xffff; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) return [];

  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries: ZipDirectoryEntry[] = [];
  for (let i = 0; i < count && cursor + 46 <= bytes.length; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const nameLength = view.getUint16(cursor + 28, true);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)),
      method: view.getUint16(cursor + 10, true),
      compressedSize: view.getUint32(cursor + 20, true),
      localHeaderOffset: view.getUint32(cursor + 42, true),
    });
    cursor += 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
  }
  return entries;
}

async function readEntryText(bytes: Uint8Array, entries: ZipDirectoryEntry[], name: string): Promise<string | null> {
  const entry = entries.find(x => x.name === name);
  if (!entry) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const start = entry.localHeaderOffset + 30
    + view.getUint16(entry.localHeaderOffset + 26, true)
    + view.getUint16(entry.localHeaderOffset + 28, true);
  const payload = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(payload);
  if (entry.method !== 8) return null;             // Only stored/deflate exist in practice.
  return new TextDecoder().decode(await inflateRaw(payload));
}

async function inflateRaw(payload: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  void writer.write(payload as BufferSource);
  void writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return concat(chunks);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
