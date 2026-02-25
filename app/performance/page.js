import { getDb } from '../../lib/db.js';

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export default async function PerformancePage({ searchParams }) {
  const db = getDb();

  const branches = uniq(db.prepare(`SELECT DISTINCT branch FROM performance WHERE branch IS NOT NULL AND branch <> '' ORDER BY branch`).all().map((r) => r.branch));
  const months = uniq(db.prepare(`SELECT DISTINCT month FROM performance WHERE month IS NOT NULL AND month <> '' ORDER BY month`).all().map((r) => r.month));
  const branch = searchParams?.branch || branches[0] || '';
  const month = searchParams?.month || months[0] || '';
  const sales = searchParams?.sales || '';

  const salesList = uniq(db.prepare(`SELECT DISTINCT sales_name FROM performance WHERE branch=? AND month=? AND sales_name IS NOT NULL AND sales_name<>'' ORDER BY sales_name`).all(branch, month).map((r) => r.sales_name));

  const where = [];
  const params = [];
  if (branch) { where.push('branch=?'); params.push(branch); }
  if (month) { where.push('month=?'); params.push(month); }
  if (sales) { where.push('sales_name=?'); params.push(sales); }
  const sql = `
    SELECT staff_name, staff_id, metric_key, SUM(metric_value) as value
    FROM performance
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY staff_name, staff_id, metric_key
    ORDER BY staff_name ASC, metric_key ASC
    LIMIT 5000;
  `;

  const rows = db.prepare(sql).all(...params);
  const byStaff = new Map();
  for (const r of rows) {
    const key = `${r.staff_id || ''}|${r.staff_name}`;
    if (!byStaff.has(key)) byStaff.set(key, { staff_name: r.staff_name, staff_id: r.staff_id, metrics: {} });
    byStaff.get(key).metrics[r.metric_key] = r.value;
  }
  const staffRows = Array.from(byStaff.values());
  const metricKeys = uniq(rows.map((r) => r.metric_key));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>個人別実績</h1>
        <form action="/performance" method="get" className="filters">
          <label style={{ fontWeight: 800 }}>支店</label>
          <select name="branch" defaultValue={branch}>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select>

          <label style={{ fontWeight: 800 }}>月</label>
          <select name="month" defaultValue={month}>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select>

          <label style={{ fontWeight: 800 }}>担当</label>
          <select name="sales" defaultValue={sales}>
            <option value=''>（全員）</option>
            {salesList.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button>表示</button>
        </form>
      </section>

      {staffRows.length === 0 ? (
        <div className="panel" style={{ padding: 16, color: '#64748b' }}>データがありません。トップページから個人別実績Excelを取り込んでください。</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0 }}>氏名</th>
                {metricKeys.map((k) => <th key={k} style={{ textAlign: 'right' }}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {staffRows.slice(0, 300).map((r) => (
                <tr key={`${r.staff_id || ''}${r.staff_name}`}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 700 }}>
                    {r.staff_name}
                    <div style={{ color: '#64748b', fontSize: 11 }}>{r.staff_id || ''}</div>
                  </td>
                  {metricKeys.map((k) => (
                    <td key={k} style={{ textAlign: 'right' }}>{typeof r.metrics[k] === 'number' ? r.metrics[k].toLocaleString() : ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="note">MVPでは実績値を取り込み表示。次フェーズで「自動補助（入社/退社/見込み）ON/OFF入力」に対応可能です。</p>
    </div>
  );
}
