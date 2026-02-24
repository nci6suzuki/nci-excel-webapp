import { getDb } from '../../lib/db.js';

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export default async function PerformancePage({ searchParams }) {
  const db = getDb();

  const branches = uniq(db.prepare('SELECT DISTINCT branch FROM performance WHERE branch IS NOT NULL AND branch <> "" ORDER BY branch').all().map(r => r.branch));
  const months = uniq(db.prepare('SELECT DISTINCT month FROM performance WHERE month IS NOT NULL AND month <> "" ORDER BY month').all().map(r => r.month));
  const branch = searchParams?.branch || branches[0] || '';
  const month = searchParams?.month || months[0] || '';
  const sales = searchParams?.sales || '';

  const salesList = uniq(db.prepare('SELECT DISTINCT sales_name FROM performance WHERE branch=? AND month=? AND sales_name IS NOT NULL AND sales_name<>"" ORDER BY sales_name').all(branch, month).map(r => r.sales_name));

  const where = [];
  const params = [];
  if (branch) { where.push('branch=?'); params.push(branch); }
  if (month) { where.push('month=?'); params.push(month); }
  if (sales) { where.push('sales_name=?'); params.push(sales); }
  const sql = `
    SELECT staff_name, staff_id, metric_key, SUM(metric_value) as value
    FROM performance
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY staff_name, staff_id, metric_key
    ORDER BY staff_name ASC, metric_key ASC
    LIMIT 5000;
  `;
  const rows = db.prepare(sql).all(...params);

  // pivot by staff
  const byStaff = new Map();
  for (const r of rows) {
    const key = `${r.staff_id || ''}|${r.staff_name}`;
    if (!byStaff.has(key)) byStaff.set(key, { staff_name: r.staff_name, staff_id: r.staff_id, metrics: {} });
    byStaff.get(key).metrics[r.metric_key] = r.value;
  }
  const staffRows = Array.from(byStaff.values());
  const metricKeys = uniq(rows.map(r => r.metric_key));

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      <h1 style={{ margin: '8px 0 6px' }}>個人別実績（取り込み表示）</h1>

      <form action="/performance" method="get" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '10px 0 16px' }}>
        <label style={{ fontWeight: 700 }}>支店</label>
        <select name="branch" defaultValue={branch} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <label style={{ fontWeight: 700 }}>月</label>
        <select name="month" defaultValue={month} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label style={{ fontWeight: 700 }}>担当</label>
        <select name="sales" defaultValue={sales} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb', minWidth: 160 }}>
          <option value="">（全員）</option>
          {salesList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #111827', background: '#111827', color: 'white', fontWeight: 700 }}>表示</button>
      </form>

      {staffRows.length === 0 ? (
        <div style={{ color: '#6b7280' }}>データがありません。トップページから個人別実績Excelを取り込んでください。</div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#111827', color: 'white' }}>
                <th style={{ position: 'sticky', left: 0, background: '#111827', padding: 10, borderRight: '1px solid #374151', textAlign: 'left' }}>氏名</th>
                {metricKeys.map(k => (
                  <th key={k} style={{ padding: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffRows.slice(0, 300).map((r) => (
                <tr key={(r.staff_id||'')+r.staff_name}>
                  <td style={{ position: 'sticky', left: 0, background: 'white', padding: 10, borderRight: '1px solid #e5e7eb', borderTop: '1px solid #e5e7eb', fontWeight: 700 }}>
                    {r.staff_name}
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{r.staff_id || ''}</div>
                  </td>
                  {metricKeys.map(k => (
                    <td key={k} style={{ padding: 10, borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {typeof r.metrics[k] === 'number' ? r.metrics[k].toLocaleString() : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
        ※ このMVPは、個人別実績シートの“列名”を推定し、数値列をメトリクスとして取り込みます。<br />
        ※ 本番では、各支店の実績フォーマットが微妙に違っても、設定ファイル（列名エイリアス）で完全吸収できます。
      </div>
    </div>
  );
}
