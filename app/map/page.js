import { getDb } from '../../lib/db.js';

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export default async function MapPage({ searchParams }) {
  const db = getDb();
  const branches = uniq(db.prepare('SELECT DISTINCT branch FROM staff WHERE branch IS NOT NULL AND branch <> "" ORDER BY branch').all().map(r => r.branch));
  const branch = searchParams?.branch || branches[0] || '';

  // manager order: if a manager has any staff in that branch, list them; we keep stable alphabetical for MVP.
  const managers = db.prepare(`
    SELECT sales_name, COUNT(*) as headcount
    FROM staff
    WHERE branch=? AND (leave_date IS NULL OR leave_date='')
    GROUP BY sales_name
    ORDER BY headcount DESC, sales_name ASC
  `).all(branch);

  const hierarchy = [];
  for (const m of managers) {
    if (!m.sales_name) continue;
    const clients = db.prepare(`
      SELECT client_name, COUNT(*) as headcount
      FROM assignments a
      JOIN staff s ON s.staff_id=a.staff_id
      WHERE a.branch=? AND a.sales_name=? AND a.active=1
      GROUP BY client_name
      ORDER BY headcount DESC, client_name ASC
      LIMIT 20
    `).all(branch, m.sales_name);

    const clientBlocks = [];
    for (const c of clients) {
      const staff = db.prepare(`
        SELECT s.staff_name
        FROM staff s
        JOIN assignments a ON a.staff_id=s.staff_id
        WHERE a.branch=? AND a.sales_name=? AND a.client_name=? AND a.active=1
        ORDER BY s.staff_name ASC
        LIMIT 100
      `).all(branch, m.sales_name, c.client_name).map(r => r.staff_name);
      clientBlocks.push({ client: c.client_name, headcount: c.headcount, staff });
    }

    hierarchy.push({ manager: m.sales_name, headcount: m.headcount, clients: clientBlocks });
  }

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      <h1 style={{ margin: '8px 0 6px' }}>マップ（支店 → 担当 → クライアント → スタッフ）</h1>

      <form action="/map" method="get" style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0 16px' }}>
        <label style={{ fontWeight: 700 }}>支店</label>
        <select name="branch" defaultValue={branch} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <button style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #111827', background: '#111827', color: 'white', fontWeight: 700 }}>表示</button>
      </form>

      <div style={{ display: 'grid', gap: 12 }}>
        {hierarchy.length === 0 && (
          <div style={{ color: '#6b7280' }}>データがありません。トップページからExcelを取り込んでください。</div>
        )}

        {hierarchy.map((m) => (
          <div key={m.manager} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', background: '#E8F0FE', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 900 }}>{m.manager}</div>
              <div style={{ color: '#111827', fontWeight: 800 }}>在籍 {m.headcount}</div>
            </div>

            <div style={{ padding: 12, display: 'grid', gap: 10 }}>
              {m.clients.length === 0 && <div style={{ color: '#6b7280' }}>クライアントが未登録（入退社側のクライアント列を確認）</div>}

              {m.clients.map((c) => (
                <div key={c.client} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#DAEEF3', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontWeight: 800 }}>{c.client || '(空欄)'} </div>
                    <div style={{ color: '#111827', fontWeight: 800 }}>{c.headcount}</div>
                  </div>
                  <div style={{ padding: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#111827' }}>
                    {c.staff.join('\n') || '（スタッフなし）'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
        ※ ここでは “シートの書き方を変えない” 前提で、入退社（マップ図内）の列から支店・担当・クライアント・スタッフを推定してDB化しています。<br />
        ※ 本番仕様では、担当固定枠（若井/高崎…の固定位置）を <b>マスタ</b> として持たせ、完全に“いつも同じ位置”を再現できます。
      </div>
    </div>
  );
}
