export const dynamic = 'force-dynamic';
import BranchMasterPanel from '../../lib/ui/BranchMasterPanel.js';
import { supabaseRest } from '../../lib/supabase.js';

export default async function MastersPage() {
  const branches = (await supabaseRest('branches', {
    query: { select: 'name', is_active: 'eq.true', order: 'sort_order.asc,name.asc' },
  })).map((r) => r.name);

  const managers = (await supabaseRest('managers', {
    query: { select: 'name', is_active: 'eq.true', order: 'name.asc', limit: '200' },
  })).map((r) => r.name);

  const clients = (await supabaseRest('clients', {
    query: { select: 'name', is_active: 'eq.true', order: 'name.asc', limit: '200' },
  })).map((r) => r.name);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>マスタ管理</h1>
        <p className="note" style={{ marginTop: 8 }}>支店/担当/クライアント/担当固定枠（1〜16）の整備状況を確認する画面です。</p>
      </section>

      <section className="card-grid">
        <BranchMasterPanel initialBranches={branches} />
        <article className="panel" style={{ padding: 14 }}><h3 className="section-title">担当マスタ</h3>{managers.slice(0, 30).map((m) => <div key={m}>{m}</div>)}</article>
        <article className="panel" style={{ padding: 14 }}><h3 className="section-title">クライアント（上位200件）</h3>{clients.slice(0, 30).map((c) => <div key={c}>{c}</div>)}</article>
      </section>
    </div>
  );
}