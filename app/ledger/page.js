import { getDb } from '../../lib/db.js';

export default function LedgerPage() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT staff_id, branch, sales_name, staff_name, join_date, leave_date
    FROM staff
    ORDER BY COALESCE(join_date, ''), staff_name
    LIMIT 500
  `).all();

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>入退社台帳</h1>
        <p className="note" style={{ marginTop: 8 }}>陣立てステータス変化をトリガーに staff_id / 入社日 / 退社日を管理する台帳ビューです。</p>
      </section>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>staff_id</th><th>氏名</th><th>支店</th><th>担当</th><th>入社日</th><th>退社日</th><th>在籍</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staff_id}>
                <td>{r.staff_id}</td><td>{r.staff_name}</td><td>{r.branch}</td><td>{r.sales_name}</td><td>{r.join_date || '-'}</td><td>{r.leave_date || '-'}</td>
                <td>{r.leave_date ? <span className="badge warn">OFF</span> : <span className="badge ok">ON</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}