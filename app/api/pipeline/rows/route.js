import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeFiscalMonths, normalizeJinSection } from '../../../../lib/pipeline.js';
import { ensureBranch, findManagerId, mapCaseTypeToEnum, parseYearMonth, supabaseRest } from '../../../../lib/supabase.js';

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
    const month = parseYearMonth(body.target_month);
    if (!month) return NextResponse.json({ error: 'target_month is invalid' }, { status: 400 });

    const activeMonth = computeFiscalMonths(new Date())[0];
    const section = normalizeJinSection(body.status, body.target_month, activeMonth);
    const branch = await ensureBranch(body.branch);
    const managerId = await findManagerId(body.manager_name);

    const payload = {
      term_label: '第15期',
      target_year: month.year,
      target_month: month.month,
      branch_id: branch.id,
      branch_name: body.branch,
      section,
      case_type: mapCaseTypeToEnum(body.case_type || 'new_case'),
      rank: body.rank || null,
      staff_name: body.staff_name,
      manager_id: managerId,
      manager_name: body.manager_name || '未設定',
      memo: body.memo || null,
      client_name: body.client_name || null,
      hope: body.hope || null,
      tour_date: toIsoDate(body.tour_date),
      selection_text: body.selection || null,
      start_date: toIsoDate(body.start_date),
      leave_client_name: body.client_name || null,
      leave_date: toIsoDate(body.leave_date),
      rework_text: null,
      next_job: null,
      leave_reason: null,
      status: body.status,
      created_by: 'web-user',
      updated_by: 'web-user',
    };

    const inserted = await supabaseRest('jin_date_rows', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: [payload],
    });

    return NextResponse.json({ ok: true, id: inserted?.[0]?.id, section });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}