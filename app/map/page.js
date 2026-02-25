import { getDb } from '../../lib/db.js';
import { computeFiscalMonths } from '../../lib/pipeline.js';

export default function MapPage({ searchParams }) {
  const db = getDb();
  const months = computeFiscalMonths(new Date());
  const month = searchParams?.month || months[0];
  const branches = db.prepare(`SELECT DISTINCT branch FROM jin_date_rows ORDER BY branch`).all().map((r) => r.branch);
  const branch = searchParams?.branch || branches[0] || '未設定';

  const managers = db.prepare(`
    SELECT manager_name, COUNT(*) AS headcount
    FROM v_map_rows
    WHERE branch=? AND target_month=?
    GROUP BY manager_name
    ORDER BY headcount DESC, manager_name
  `).all(branch, month);

  const cards = managers.map((m) => {
    const clients = db.prepare(`
      SELECT client_name, COUNT(*) AS headcount,
             SUM(CASE WHEN status='leave_notice' THEN 1 ELSE 0 END) AS leaving
      FROM v_map_rows
      WHERE branch=? AND target_month=? AND manager_name=?
      GROUP BY client_name
      ORDER BY headcount DESC, client_name
      LIMIT 20
    `).all(branch, month, m.manager_name);

    return {
      ...m,
      clients: clients.map((c) => ({
        ...c,
        staff: db.prepare(`
          SELECT staff_name, status
          FROM v_map_rows
          WHERE branch=? AND target_month=? AND manager_name=? AND client_name=?
          ORDER BY staff_name
          LIMIT 100
        `).all(branch, month, m.manager_name, c.client_name),
      })),
    };
  });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>マップ図（陣立て基準）</h1>
        <form action="/map" method="get" className="filters">
          <label style={{ fontWeight: 800 }}>月</label>
          <select name="month" defaultValue={month}>{months.map((m) => <option key={m}>{m}</option>)}</select>
          <label style={{ fontWeight: 800 }}>支店</label>
          <select name="branch" defaultValue={branch}>{branches.map((b) => <option key={b}>{b}</option>)}</select>
          <button>表示</button>
        </form>
      </section>

      {cards.map((m, i) => (
        <article className="panel" key={m.manager_name} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', background: 'linear-gradient(90deg,#dbeafe,#ede9fe)', display: 'flex', justifyContent: 'space-between' }}>
            <strong>{String(i + 1).padStart(2, '0')} 枠: {m.manager_name}</strong>
            <span className="badge ok">{m.headcount}名</span>
          </div>
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            {m.clients.map((c) => (
              <div key={`${m.manager_name}-${c.client_name}`} style={{ border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ padding: 8, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.client_name || '(空欄)'}</span>
                  <span className="badge prospect">{c.headcount}名 / 退職予定{c.leaving || 0}</span>
                </div>
                <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {c.staff.map((s) => <span key={`${c.client_name}-${s.staff_name}`} className={`badge ${s.status === 'leave_notice' ? 'warn' : 'ok'}`}>{s.staff_name}</span>)}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
      {cards.length === 0 && <div className="panel" style={{ padding: 16, color: '#64748b' }}>表示データがありません。陣立て（/pipeline）でステータスを更新してください。</div>}
    </div>
  );
}
