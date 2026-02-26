import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '../../../../lib/db.js';
import { normalizeJinSection } from '../../../../lib/pipeline.js';
import { updateRow } from '../../../../lib/supabaseSync.js';

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(['prospect', 'proposing', 'tour_scheduled', 'offer', 'active', 'leave_notice', 'left', 'invalid']),
  target_month: z.string().regex(/^\d{4}-\d{2}$/),
  updated_by: z.string().default('web-user'),
  leave_date: z.string().optional(),
  start_date: z.string().optional(),
});

export async function POST(req) {
  try {
    const body = schema.parse(await req.json());
    if (body.status === 'left' && !body.leave_date) {
      const current = getDb().prepare('SELECT leave_date FROM jin_date_rows WHERE id=?').get(body.id);
      if (!current?.leave_date) return NextResponse.json({ error: '退職確定には退職日が必要です。' }, { status: 400 });
    }

    const db = getDb();
    const currentMonth = body.target_month;
    const section = normalizeJinSection(body.status, body.target_month, currentMonth);
    const patch = {
      status: body.status,
      section,
      updated_by: body.updated_by,
      updated_at: new Date().toISOString(),
      leave_date: body.leave_date ?? null,
      start_date: body.start_date ?? null,
    };
    db.prepare(`
      UPDATE jin_date_rows
      SET status=@status,
          section=@section,
          updated_by=@updated_by,
          updated_at=@updated_at,
          leave_date=COALESCE(@leave_date, leave_date),
          start_date=COALESCE(@start_date, start_date)
      WHERE id=@id
    `).run({
      id: body.id,
      ...patch,
    });

    await updateRow('jin_date_rows', { id: body.id }, {
      ...patch,
      leave_date: body.leave_date,
      start_date: body.start_date,
    });

    return NextResponse.json({ ok: true, section });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}