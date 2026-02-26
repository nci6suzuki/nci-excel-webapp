import { getDb, listBranches } from '../../lib/db.js';
import BranchMasterPanel from '../../lib/ui/BranchMasterPanel.js';

export default function MastersPage() {
  const db = getDb();
  const branches = listBranches(db);
  const managers = db.prepare(`SELECT DISTINCT sales_name FROM staff WHERE sales_name IS NOT NULL AND sales_name<>'' ORDER BY sales_name`).all().map((r) => r.sales_name);
  const clients = db.prepare(`SELECT DISTINCT client_name FROM assignments WHERE client_name IS NOT NULL AND client_name<>'' ORDER BY client_name LIMIT 200`).all().map((r) => r.client_name);

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