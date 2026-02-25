import { getDb } from '../../lib/db.js';

export default function HeadcountPage() {
  const db = getDb();
  const months = db.prepare(`SELECT DISTINCT month FROM headcount_changes WHERE month IS NOT NULL AND month<>'' ORDER BY month`).all();
  const branches = db.prepare(`SELECT DISTINCT branch FROM headcount_changes WHERE branch IS NOT NULL AND branch<>'' ORDER BY branch`).all();
  const rows = db.prepare(`
    SELECT month, branch,
      SUM(CASE WHEN metric_key LIKE '%入社%' THEN metric_value ELSE 0 END) AS join_count,
      SUM(CASE WHEN metric_key LIKE '%退社%' THEN metric_value ELSE 0 END) AS leave_count,
      SUM(CASE WHEN metric_key LIKE '%在籍%' THEN metric_value ELSE 0 END) AS active_count
    FROM headcount_changes
    GROUP BY month, branch
    ORDER BY month DESC, branch
    LIMIT 240
  `).all();

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>稼働人員変動</h1>
        <p className="note" style={{ marginTop: 8 }}>月次の入社確定数・退社確定数・純増減・在籍数を自動集計する画面です。</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge prospect">月数: {months.length}</span>
          <span className="badge ok">支店数: {branches.length}</span>
        </div>
      </section>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>月</th><th>支店</th><th style={{ textAlign: 'right' }}>入社</th><th style={{ textAlign: 'right' }}>退社</th><th style={{ textAlign: 'right' }}>純増減</th><th style={{ textAlign: 'right' }}>在籍</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.month}-${r.branch}-${i}`}>
                <td>{r.month}</td><td>{r.branch}</td><td style={{ textAlign: 'right' }}>{Number(r.join_count || 0).toLocaleString()}</td><td style={{ textAlign: 'right' }}>{Number(r.leave_count || 0).toLocaleString()}</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{Number((r.join_count || 0) - (r.leave_count || 0)).toLocaleString()}</td><td style={{ textAlign: 'right' }}>{Number(r.active_count || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}