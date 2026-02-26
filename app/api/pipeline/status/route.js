import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeJinSection } from '../../../../lib/pipeline.js';
import { parseYearMonth, supabaseRest } from '../../../../lib/supabase.js';

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(['prospect', 'proposing', 'tour_scheduled', 'offer', 'active', 'leave_notice', 'left', 'invalid']),
  target_month: z.string().regex(/^\d{4}-\d{2}$/),
  updated_by: z.string().default('web-user'),
  leave_date: z.string().optional(),
  start_date: z.string().optional(),
});

export async function POST(req) {
  try {
    const body = schema.parse(await req.json());
    const ym = parseYearMonth(body.target_month);
    if (!ym) return NextResponse.json({ error: 'target_month is invalid' }, { status: 400 });

    if (body.status === 'left' && !body.leave_date) {
      const current = await supabaseRest('jin_date_rows', {
        query: { select: 'leave_date', id: `eq.${body.id}`, limit: '1' },
      });
      if (!current?.[0]?.leave_date) {
        return NextResponse.json({ error: '退職確定には退職日が必要です。' }, { status: 400 });
      }
    }

    const section = normalizeJinSection(body.status, body.target_month, body.target_month);
    const payload = {
      status: body.status,
      section,
      updated_by: body.updated_by,
    };
    if (body.leave_date) payload.leave_date = body.leave_date;
    if (body.start_date) payload.start_date = body.start_date;

    await supabaseRest('jin_date_rows', {
      method: 'PATCH',
      query: { id: `eq.${body.id}` },
      headers: { Prefer: 'return=minimal' },
      body: payload,
    });

    return NextResponse.json({ ok: true, section });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}