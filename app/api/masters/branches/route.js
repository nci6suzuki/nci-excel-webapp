import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, listBranches } from '../../../../lib/db.js';

const createSchema = z.object({
  name: z.string().trim().min(1, '支店名を入力してください。').max(60, '支店名は60文字以内で入力してください。'),
});

const deleteSchema = z.object({
  name: z.string().trim().min(1),
});

export async function GET() {
  const db = getDb();
  const branches = listBranches(db);
  return NextResponse.json({ branches });
}

export async function POST(req) {
  try {
    const payload = createSchema.parse(await req.json());
    const db = getDb();
    const now = new Date().toISOString();
    const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM branch_master').get().next_order;

    db.prepare(`
      INSERT INTO branch_master (name, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(payload.name, nextOrder, now, now);

    return NextResponse.json({ ok: true, branches: listBranches(db) });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const payload = deleteSchema.parse(await req.json());
    const db = getDb();
    const inUse = db
      .prepare('SELECT COUNT(*) AS c FROM jin_date_rows WHERE branch=?')
      .get(payload.name).c;

    if (inUse > 0) {
      return NextResponse.json({ error: '陣立てデータで使用中のため削除できません。' }, { status: 400 });
    }

    db.prepare('DELETE FROM branch_master WHERE name=?').run(payload.name);
    const rest = listBranches(db);
    if (rest.length === 0) {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO branch_master (name, sort_order, created_at, updated_at) VALUES (?, 0, ?, ?)').run('未設定', now, now);
    }

    return NextResponse.json({ ok: true, branches: listBranches(db) });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
}