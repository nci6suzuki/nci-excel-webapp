import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '../../../../lib/db.js';
import { computeFiscalMonths, normalizeJinSection } from '../../../../lib/pipeline.js';
import { upsertRows } from '../../../../lib/supabaseSync.js';

const schema = z.object({
  target_month: z.string().regex(/^\d{4}-\d{2}$/),
  branch: z.string().min(1),
  status: z.enum(['prospect', 'proposing', 'tour_scheduled', 'offer', 'active', 'leave_notice', 'left', 'invalid']),
  staff_name: z.string().min(1),
  client_name: z.string().optional(),
  manager_name: z.string().optional(),
  case_type: z.string().optional(),
  rank: z.string().optional(),
  hope: z.string().optional(),
  tour_date: z.string().optional(),
  selection: z.string().optional(),
  start_date: z.string().optional(),
  leave_date: z.string().optional(),
  memo: z.string().optional(),
});

function toIsoDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

export async function POST(req) {
  try {
    const body = schema.parse(await req.json());
    const activeMonth = computeFiscalMonths(new Date())[0];
    const section = normalizeJinSection(body.status, body.target_month, activeMonth);
    const now = new Date().toISOString();
    const id = `row-${crypto.randomUUID()}`;

    const payload = {
      id,
      year_term: '第15期',
      target_month: body.target_month,
      branch: body.branch,
      section,
      case_type: body.case_type || '新規案件',
      rank: body.rank || null,
      staff_name: body.staff_name,
      client_name: body.client_name || null,
      hope: body.hope || null,
      tour_date: toIsoDate(body.tour_date),
      manager_name: body.manager_name || null,
      selection: body.selection || null,
      start_date: toIsoDate(body.start_date),
      leave_date: toIsoDate(body.leave_date),
      rework: null,
      next_job: null,
      leave_reason: null,
      memo: body.memo || null,
      status: body.status,
      created_by: 'web-user',
      updated_by: 'web-user',
      created_at: now,
      updated_at: now,
    };

    const db = getDb();
    db.prepare(`
      INSERT INTO jin_date_rows (
        id, year_term, target_month, branch, section, case_type, rank,
        staff_name, client_name, hope, tour_date, manager_name, selection,
        start_date, leave_date, rework, next_job, leave_reason, memo, status,
        created_by, updated_by, created_at, updated_at
      ) VALUES (
        @id, @year_term, @target_month, @branch, @section, @case_type, @rank,
        @staff_name, @client_name, @hope, @tour_date, @manager_name, @selection,
        @start_date, @leave_date, @rework, @next_job, @leave_reason, @memo, @status,
        @created_by, @updated_by, @created_at, @updated_at
      )
    `).run(payload);

    await upsertRows('jin_date_rows', [payload], 'id');
    return NextResponse.json({ ok: true, id, section });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}