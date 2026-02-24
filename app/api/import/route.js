import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../../../lib/db.js';
import { importMapWorkbook, importPerformanceWorkbook, importHeadcountWorkbook, guessBranchFromFilename } from '../../../lib/excel/importers.js';

export const runtime = 'nodejs';

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function detectKind(filename) {
  if (filename.includes('マップ図')) return 'map';
  if (filename.includes('稼働人員変動')) return 'headcount';
  if (filename.includes('個人別実績') || filename.includes('個人別実績管理表')) return 'performance';
  return 'unknown';
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const files = form.getAll('files');
    if (!files?.length) {
      return NextResponse.json({ error: 'files がありません' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    ensureDir(uploadDir);

    const db = getDb();
    let totalStaff = 0;
    let totalAssign = 0;
    let totalPerf = 0;
    let totalHC = 0;

    const upsertStaff = db.prepare(`
      INSERT INTO staff(staff_id, branch, sales_name, staff_name, gender, employment_type, retire_risk, join_date, leave_date)
      VALUES (@staff_id, @branch, @sales_name, @staff_name, @gender, @employment_type, @retire_risk, @join_date, @leave_date)
      ON CONFLICT(staff_id) DO UPDATE SET
        branch=excluded.branch,
        sales_name=excluded.sales_name,
        staff_name=excluded.staff_name,
        gender=excluded.gender,
        employment_type=excluded.employment_type,
        retire_risk=excluded.retire_risk,
        join_date=excluded.join_date,
        leave_date=excluded.leave_date;
    `);

    const upsertAssign = db.prepare(`
      INSERT INTO assignments(staff_id, client_name, branch, sales_name, active)
      VALUES (@staff_id, @client_name, @branch, @sales_name, @active)
      ON CONFLICT(staff_id, client_name, branch, sales_name) DO UPDATE SET active=excluded.active;
    `);

    const insertPerf = db.prepare(`
      INSERT INTO performance(branch, month, sales_name, staff_name, staff_id, metric_key, metric_value, raw_row_json)
      VALUES (@branch, @month, @sales_name, @staff_name, @staff_id, @metric_key, @metric_value, @raw_row_json);
    `);

    const insertHC = db.prepare(`
      INSERT INTO headcount_changes(month, branch, metric_key, metric_value, raw_row_json)
      VALUES (@month, @branch, @metric_key, @metric_value, @raw_row_json);
    `);

    const insertImport = db.prepare(`
      INSERT INTO imports(filename, kind, imported_at) VALUES (@filename, @kind, @imported_at);
    `);

    // to prevent duplicated performance rows on reimport, clear same month+branch? We'll keep simple: clear all of that filename kind.
    // For MVP: clear all perf/headcount before import to avoid duplicates.
    db.exec('DELETE FROM performance;');
    db.exec('DELETE FROM headcount_changes;');

    for (const f of files) {
      if (!(f instanceof File)) continue;
      const filename = f.name;
      const kind = detectKind(filename);
      const buf = Buffer.from(await f.arrayBuffer());

      fs.writeFileSync(path.join(uploadDir, filename), buf);

      if (kind === 'map') {
        const { rows } = importMapWorkbook(buf, filename);
        const tx = db.transaction((rows) => {
          for (const r of rows) {
            upsertStaff.run({
              staff_id: r.staff_id,
              branch: r.branch,
              sales_name: r.sales_name,
              staff_name: r.staff_name,
              gender: r.gender,
              employment_type: r.employment_type,
              retire_risk: r.retire_risk,
              join_date: r.join_date,
              leave_date: r.leave_date
            });
            totalStaff++;
            if (r.client_name) {
              upsertAssign.run({
                staff_id: r.staff_id,
                client_name: r.client_name,
                branch: r.branch,
                sales_name: r.sales_name,
                active: r.leave_date ? 0 : 1
              });
              totalAssign++;
            }
          }
        });
        tx(rows);
      }

      if (kind === 'performance') {
        const branchHint = guessBranchFromFilename(filename);
        const { rows } = importPerformanceWorkbook(buf, filename, branchHint);
        const tx = db.transaction((rows) => {
          for (const r of rows) {
            // try resolve staff_id via exact staff_name+branch
            let staff_id = null;
            if (r.staff_name) {
              const q = db.prepare('SELECT staff_id FROM staff WHERE staff_name=? AND (branch=? OR ?="") ORDER BY join_date DESC LIMIT 1').get(r.staff_name, r.branch || branchHint, r.branch || branchHint);
              staff_id = q?.staff_id ?? null;
            }
            insertPerf.run({
              branch: r.branch || branchHint,
              month: r.month,
              sales_name: r.sales_name,
              staff_name: r.staff_name,
              staff_id,
              metric_key: r.metric_key,
              metric_value: r.metric_value,
              raw_row_json: JSON.stringify(r)
            });
            totalPerf++;
          }
        });
        tx(rows);
      }

      if (kind === 'headcount') {
        const { rows } = importHeadcountWorkbook(buf, filename);
        const tx = db.transaction((rows) => {
          for (const r of rows) {
            insertHC.run({
              month: r.month,
              branch: r.branch,
              metric_key: r.metric_key,
              metric_value: r.metric_value,
              raw_row_json: JSON.stringify(r)
            });
            totalHC++;
          }
        });
        tx(rows);
      }

      insertImport.run({ filename, kind, imported_at: new Date().toISOString() });
    }

    const summary = `staff ${totalStaff}件 / assignment ${totalAssign}件 / performance ${totalPerf}件 / headcount ${totalHC}件`;
    return NextResponse.json({ ok: true, summary });

  } catch (e) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
