import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureBranch, supabaseRest } from '../../../../lib/supabase.js';

const createSchema = z.object({
  name: z.string().trim().min(1, '支店名を入力してください。').max(60, '支店名は60文字以内で入力してください。'),
});

const deleteSchema = z.object({
  name: z.string().trim().min(1),
});

async function listBranches() {
  const rows = await supabaseRest('branches', {
    query: { select: 'name', is_active: 'eq.true', order: 'sort_order.asc,name.asc' },
  });
  return rows.map((r) => r.name);
}

export async function GET() {
  const branches = await listBranches();
  return NextResponse.json({ branches });
}

export async function POST(req) {
  try {
    const payload = createSchema.parse(await req.json());
    await ensureBranch(payload.name);
    return NextResponse.json({ ok: true, branches: await listBranches() });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const payload = deleteSchema.parse(await req.json());
    const branchRows = await supabaseRest('branches', {
      query: { select: 'id,name', name: `eq.${payload.name}`, limit: '1' },
    });
    const branch = branchRows?.[0];
    if (!branch?.id) return NextResponse.json({ ok: true, branches: await listBranches() });

    const inUse = await supabaseRest('jin_date_rows', {
      query: { select: 'id', branch_id: `eq.${branch.id}`, limit: '1' },
    });
    if (inUse.length > 0) {
      return NextResponse.json({ error: '陣立てデータで使用中のため削除できません。' }, { status: 400 });
    }

    await supabaseRest('branches', { method: 'DELETE', query: { id: `eq.${branch.id}` } });

    const rest = await listBranches();
    if (rest.length === 0) {
      await ensureBranch('未設定');
    }

    return NextResponse.json({ ok: true, branches: await listBranches() });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
}