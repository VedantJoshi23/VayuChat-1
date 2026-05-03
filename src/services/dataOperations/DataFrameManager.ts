export type Row = Record<string, any>;

export interface FunctionCall {
  function: string;
  args: Record<string, any>;
}

export interface ExecutionStep {
  fn: string;
  args: Record<string, any>;
  result: string;
  error?: string;
}

export interface ExecutionResult {
  steps: ExecutionStep[];
  finalResult: string;
  error?: string;
}

/**
 * JavaScript equivalent of the notebook's DataFrameManager.
 * Executes a chain of named data-operations against in-memory tables.
 */
export class DataFrameManager {
  private tables: Record<string, Row[]> = {};
  private currentDf: Row[] | null = null;

  setTables(tables: Record<string, Row[]>): void {
    this.tables = tables;
    this.currentDf = null;
  }

  addTable(name: string, rows: Row[]): void {
    this.tables[name] = rows;
  }

  getTableNames(): string[] {
    return Object.keys(this.tables);
  }

  getTableInfo(): Record<string, { rowCount: number; columns: string[] }> {
    const info: Record<string, { rowCount: number; columns: string[] }> = {};
    for (const [name, rows] of Object.entries(this.tables)) {
      info[name] = {
        rowCount: rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      };
    }
    return info;
  }

  private req(): Row[] {
    if (!this.currentDf) throw new Error('No table loaded. Call load_table first.');
    return this.currentDf;
  }

  // ── Operations (match notebook signatures exactly) ──────────────────────────

  load_table(table: string): string {
    if (!(table in this.tables)) {
      const avail = Object.keys(this.tables).join(', ') || '(none)';
      throw new Error(`Table '${table}' not found. Available: ${avail}`);
    }
    this.currentDf = this.tables[table].map((r) => ({ ...r }));
    return `Loaded ${table}: ${this.currentDf.length} rows`;
  }

  filter_rows(column: string, operator: string, value: any): string {
    const df = this.req();
    const before = df.length;
    this.currentDf = df.filter((row) => {
      const v = row[column];
      switch (operator) {
        case '==': return String(v) === String(value) || v == value;
        case '!=': return v != value;
        case '>':  return Number(v) > Number(value);
        case '>=': return Number(v) >= Number(value);
        case '<':  return Number(v) < Number(value);
        case '<=': return Number(v) <= Number(value);
        case 'contains':
          return String(v ?? '').toLowerCase().includes(String(value).toLowerCase());
        case 'in':
          return Array.isArray(value) && value.includes(v);
        default: return true;
      }
    });
    return `Filtered ${column} ${operator} ${value}: ${before} → ${this.currentDf.length} rows`;
  }

  filter_date_range(column: string, start_date: string, end_date: string): string {
    const df = this.req();
    const before = df.length;
    this.currentDf = df.filter((row) => {
      const val = String(row[column] ?? '').substring(0, 10);
      return val >= start_date && val <= end_date;
    });
    return `Filtered ${column} from ${start_date} to ${end_date}: ${before} → ${this.currentDf.length} rows`;
  }

  aggregate(
    group_by: string | string[],
    aggregations: Record<string, string>
  ): string {
    const df = this.req();
    const keys = Array.isArray(group_by) ? group_by : [group_by];

    const groups = new Map<string, Row[]>();
    for (const row of df) {
      const k = keys.map((c) => String(row[c] ?? '')).join('\x00');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(row);
    }

    const result: Row[] = [];
    for (const rows of groups.values()) {
      const newRow: Row = {};
      keys.forEach((c) => { newRow[c] = rows[0][c]; });
      for (const [col, func] of Object.entries(aggregations)) {
        const vals = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
        newRow[col] = this._agg(vals, func);
      }
      result.push(newRow);
    }

    this.currentDf = result;
    return `Aggregated by [${keys.join(', ')}]: ${result.length} groups`;
  }

  private _agg(vals: number[], func: string): number | null {
    if (vals.length === 0) return null;
    switch (func) {
      case 'mean':   return round2(vals.reduce((a, b) => a + b, 0) / vals.length);
      case 'sum':    return round2(vals.reduce((a, b) => a + b, 0));
      case 'min':    return Math.min(...vals);
      case 'max':    return Math.max(...vals);
      case 'count':  return vals.length;
      case 'std': {
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        return round2(Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length));
      }
      case 'median': {
        const s = [...vals].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : round2((s[mid - 1] + s[mid]) / 2);
      }
      default: return vals[0];
    }
  }

  sort_values(column: string, ascending: boolean = true): string {
    const df = this.req();
    this.currentDf = [...df].sort((a, b) => {
      const na = Number(a[column]);
      const nb = Number(b[column]);
      const cmp =
        !isNaN(na) && !isNaN(nb)
          ? na - nb
          : String(a[column] ?? '').localeCompare(String(b[column] ?? ''));
      return ascending ? cmp : -cmp;
    });
    return `Sorted by ${column} (${ascending ? 'asc' : 'desc'})`;
  }

  top_k(k: number, column?: string): string {
    if (column) this.sort_values(column, false);
    this.currentDf = this.req().slice(0, k);
    return JSON.stringify(this.currentDf);
  }

  bottom_k(k: number, column?: string): string {
    if (column) this.sort_values(column, true);
    this.currentDf = this.req().slice(0, k);
    return JSON.stringify(this.currentDf);
  }

  count_rows(): string {
    return String(this.req().length);
  }

  get_value(row_index: number, column: string): string {
    const df = this.req();
    if (row_index < 0 || row_index >= df.length) {
      throw new Error(`Row index ${row_index} out of range (${df.length} rows)`);
    }
    return String(df[row_index][column] ?? '');
  }

  join_table(right_table: string, on: string | string[], how: string = 'inner'): string {
    const df = this.req();
    const right = this.tables[right_table];
    if (!right) throw new Error(`Table '${right_table}' not found`);
    const onCols = Array.isArray(on) ? on : [on];
    const result: Row[] = [];
    for (const lr of df) {
      const match = right.find((rr) => onCols.every((c) => lr[c] == rr[c]));
      if (match) result.push({ ...lr, ...match });
      else if (how === 'left') result.push({ ...lr });
    }
    this.currentDf = result;
    return `Joined with ${right_table}: ${result.length} rows`;
  }

  // ── Dispatcher ───────────────────────────────────────────────────────────────

  executeCalls(calls: FunctionCall[]): ExecutionResult {
    this.currentDf = null;
    const steps: ExecutionStep[] = [];
    let finalResult = '';

    for (const call of calls) {
      const { function: fn, args = {} } = call;
      try {
        const result = this._dispatch(fn, args);
        finalResult = String(result ?? '');
        steps.push({ fn, args, result: finalResult });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        steps.push({ fn, args, result: '', error });
        return { steps, finalResult: '', error: `${fn}: ${error}` };
      }
    }

    return { steps, finalResult };
  }

  private _dispatch(fn: string, args: Record<string, any>): unknown {
    switch (fn) {
      case 'load_table':
        return this.load_table(args.table);
      case 'filter_rows':
        return this.filter_rows(args.column, args.operator, args.value);
      case 'filter_date_range':
        return this.filter_date_range(args.column, args.start_date, args.end_date);
      case 'aggregate':
        return this.aggregate(args.group_by, args.aggregations);
      case 'sort_values':
        return this.sort_values(args.column, args.ascending ?? true);
      case 'top_k':
        return this.top_k(args.k, args.column);
      case 'bottom_k':
        return this.bottom_k(args.k, args.column);
      case 'count_rows':
        return this.count_rows();
      case 'get_value':
        return this.get_value(args.row_index, args.column);
      case 'join_table':
        return this.join_table(args.right_table, args.on, args.how);
      default:
        throw new Error(`Unknown function: ${fn}`);
    }
  }
}

// ── File loaders ─────────────────────────────────────────────────────────────

export function parseCSV(text: string): Row[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Row = {};
    headers.forEach((h, idx) => {
      const raw = values[idx] ?? '';
      const num = Number(raw);
      row[h] = raw === '' ? null : isNaN(num) ? raw : num;
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseJSON(text: string): Row[] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  // Support {data: [...]} wrapper
  if (data && typeof data === 'object') {
    const firstArray = Object.values(data).find(Array.isArray);
    if (firstArray) return firstArray as Row[];
  }
  throw new Error('JSON must be an array of objects or {key: [...]}');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
