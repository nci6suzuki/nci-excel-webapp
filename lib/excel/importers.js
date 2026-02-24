import * as XLSX from 'xlsx';
import crypto from 'node:crypto';
import { z } from 'zod';

// ---- config ----
export const DEFAULT_ALIASES = {
  branch: ['支店','拠点','支社'],
  sales: ['営業担当','営業担当者','担当','担当者','営業'],
  staff: ['スタッフ','スタッフ名','氏名','名前'],
  join: ['入社日','入社','入社年月日'],
  leave: ['退社日','退社','退職日'],
  gender: ['性別'],
  employment: ['雇用形態','無期/有期','雇用','有期無期'],
  client: ['クライアント','クライアント名','派遣先','取引先','企業名'],
  retireRisk: ['退職見込み','退職見込みあり','退職見込']
};

function norm(s) {
  return String(s ?? '')
    .replace(/[\s　]+/g, '')
    .replace(/[（）\(\)]+/g, '')
    .trim();
}

function findHeaderRow(sheet, maxRows = 40) {
  // sheet is array-of-arrays
  for (let r = 0; r < Math.min(sheet.length, maxRows); r++) {
    const row = sheet[r] ?? [];
    const joined = row.map(norm).join('|');
    if (joined.includes('スタッフ') && (joined.includes('入社') || joined.includes('退社'))) return r;
  }
  // fallback: first row with 3+ non-empty cells
  for (let r = 0; r < Math.min(sheet.length, maxRows); r++) {
    const nonEmpty = (sheet[r] ?? []).filter(v => norm(v)).length;
    if (nonEmpty >= 3) return r;
  }
  return 0;
}

function buildColMap(headerRow, aliases = DEFAULT_ALIASES) {
  const map = {};
  const headers = headerRow.map(norm);
  const pick = (keys) => {
    for (const key of keys) {
      const idx = headers.findIndex(h => h === norm(key) || h.includes(norm(key)));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  map.branch = pick(aliases.branch);
  map.sales = pick(aliases.sales);
  map.staff = pick(aliases.staff);
  map.join = pick(aliases.join);
  map.leave = pick(aliases.leave);
  map.gender = pick(aliases.gender);
  map.employment = pick(aliases.employment);
  map.client = pick(aliases.client);
  map.retireRisk = pick(aliases.retireRisk);
  return map;
}

function getCell(row, idx) {
  if (idx == null || idx < 0) return '';
  return row[idx];
}

function toISODate(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    const s = v.trim();
    // 2026/2/1, 2026-02-01, etc.
    const m = s.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (m) {
      const y = m[1];
      const mm = String(m[2]).padStart(2,'0');
      const dd = String(m[3]).padStart(2,'0');
      return `${y}-${mm}-${dd}`;
    }
    return s;
  }
  if (typeof v === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2,'0');
      const dd = String(d.d).padStart(2,'0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  if (v instanceof Date) {
    return v.toISOString().slice(0,10);
  }
  return String(v);
}

function makeStaffId({ branch, staff_name, join_date }) {
  const base = `${norm(branch)}|${norm(staff_name)}|${toISODate(join_date)}`;
  return crypto.createHash('sha1').update(base).digest('hex').slice(0, 10).toUpperCase();
}

// -----------------------------
// 1) マップ図（入退社）取り込み
// -----------------------------
export function importMapWorkbook(buffer, filename) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = [];

  for (const sheetName of wb.SheetNames) {
    if (!sheetName.includes('入退社')) continue;
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    const hr = findHeaderRow(aoa);
    const header = aoa[hr] ?? [];
    const col = buildColMap(header);

    const inferredBranch = sheetName
      .replace('入退社','')
      .replace(/[\(\)（）]/g,'')
      .replace(/\s+/g,'')
      .replace(/\d+/g,'')
      .replace(/\-/g,'');

    for (let r = hr + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const staff_name = String(getCell(row, col.staff) ?? '').trim();
      const join_date = toISODate(getCell(row, col.join));
      const leave_date = toISODate(getCell(row, col.leave));

      if (!staff_name) continue;
      // allow blank join_date; still import but id becomes name-only hash
      const branch = String(getCell(row, col.branch) || inferredBranch).trim();
      const sales_name = String(getCell(row, col.sales) || '').trim();
      const gender = String(getCell(row, col.gender) || '').trim();
      const employment_type = String(getCell(row, col.employment) || '').trim();
      const client_name = String(getCell(row, col.client) || '').trim();
      const retire_risk = String(getCell(row, col.retireRisk) || '').trim();

      const staff_id = makeStaffId({ branch, staff_name, join_date });

      rows.push({
        staff_id,
        branch,
        sales_name,
        staff_name,
        gender,
        employment_type,
        retire_risk,
        join_date,
        leave_date,
        client_name,
        _sheet: sheetName,
        _row: r + 1
      });
    }
  }

  return { kind: 'map', filename, rows };
}

// -----------------------------
// 2) 個人別実績（支店別）取り込み
// -----------------------------
export function importPerformanceWorkbook(buffer, filename, branchHint = '') {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = [];

  const monthFromSheet = (name) => {
    // e.g. "15期4月", "5月 " etc
    const m = String(name).match(/(\d{1,2})月/);
    return m ? `${m[1]}月` : String(name).trim();
  };

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    const hr = findHeaderRow(aoa, 30);
    const header = aoa[hr] ?? [];
    // We keep perf flexible: detect staff/sales columns, and treat other numeric columns as metrics.
    const col = buildColMap(header);

    const month = monthFromSheet(sheetName);
    for (let r = hr + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const staff_name = String(getCell(row, col.staff) ?? '').trim();
      const sales_name = String(getCell(row, col.sales) ?? '').trim();
      if (!staff_name && !sales_name) continue;

      // metrics: any header cell that is non-empty and row cell is number
      for (let c = 0; c < header.length; c++) {
        const key = String(header[c] ?? '').trim();
        if (!key) continue;
        if ([col.branch,col.sales,col.staff,col.join,col.leave,col.gender,col.employment,col.client,col.retireRisk].includes(c)) continue;
        const v = row[c];
        if (typeof v !== 'number') continue;
        rows.push({
          branch: branchHint,
          month,
          sales_name,
          staff_name,
          metric_key: key,
          metric_value: v,
          _sheet: sheetName,
          _row: r + 1
        });
      }
    }
  }

  return { kind: 'performance', filename, rows };
}

// -----------------------------
// 3) 稼働人員変動表（集計）取り込み
// -----------------------------
export function importHeadcountWorkbook(buffer, filename) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = [];

  const monthFromSheet = (name) => {
    const m = String(name).match(/(\d{1,2})月/);
    return m ? `${m[1]}月` : String(name).trim();
  };

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    // heuristic: first row with branch-like cells
    const hr = findHeaderRow(aoa, 20);
    const header = aoa[hr] ?? [];
    const month = monthFromSheet(sheetName);

    // naive: treat first column as metric name, other columns as branches
    const branchCols = [];
    for (let c = 1; c < header.length; c++) {
      const b = String(header[c] ?? '').trim();
      if (!b) continue;
      branchCols.push({ c, branch: b });
    }

    for (let r = hr + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const metric_key = String(row[0] ?? '').trim();
      if (!metric_key) continue;
      for (const bc of branchCols) {
        const v = row[bc.c];
        if (typeof v !== 'number') continue;
        rows.push({ month, branch: bc.branch, metric_key, metric_value: v, _sheet: sheetName, _row: r + 1 });
      }
    }
  }

  return { kind: 'headcount', filename, rows };
}

// -----------------------------
// Linking helpers
// -----------------------------
export function guessBranchFromFilename(filename) {
  const base = filename.replace(/\.xlsx$/i,'');
  // e.g. "1.個人別実績管理表・南魚沼（R7年度）"
  const m = base.match(/・([^（\)\(]+)[（\(]/);
  if (m) return String(m[1]).trim();
  return '';
}
