export const dynamic = 'force-dynamic';
import { computeFiscalMonths } from '../../lib/pipeline.js';
import { parseYearMonth, supabaseRest } from '../../lib/supabase.js';

export default async function MapPage({ searchParams }) {
  const months = computeFiscalMonths(new Date());
  const month = searchParams?.month || months[0];
  const parsed = parseYearMonth(month);

  const branchRows = await supabaseRest('branches', {
    query: { select: 'name', is_active: 'eq.true', order: 'sort_order.asc,name.asc' },
  });
  const branches = branchRows.map((r) => r.name);
  const branch = searchParams?.branch || branches[0] || '未設定';

  const rows = parsed
    ? await supabaseRest('jin_date_rows', {
        query: {
          select: 'branch_name,manager_name,client_name,leave_client_name,staff_name,status',
          target_year: `eq.${parsed.year}`,
          target_month: `eq.${parsed.month}`,
          branch_name: `eq.${branch}`,
          status: 'in.(offer,active,leave_notice)',
          order: 'manager_name.asc,client_name.asc,staff_name.asc',
        },
      })
    : [];

  const managerMap = new Map();
  for (const row of rows) {
    const manager = row.manager_name || '未設定';
    const client = row.client_name || row.leave_client_name || '(空欄)';
    if (!managerMap.has(manager)) managerMap.set(manager, new Map());
    const clientMap = managerMap.get(manager);
    if (!clientMap.has(client)) clientMap.set(client, []);
    clientMap.get(client).push({ staff_name: row.staff_name, status: row.status });
  }

  const cards = Array.from(managerMap.entries()).map(([manager_name, clientsMap]) => {
    const clients = Array.from(clientsMap.entries())
      .map(([client_name, staff]) => ({
        client_name,
        headcount: staff.length,
        leaving: staff.filter((s) => s.status === 'leave_notice').length,
        staff: staff.sort((a, b) => a.staff_name.localeCompare(b.staff_name)).slice(0, 100),
      }))
      .sort((a, b) => b.headcount - a.headcount || a.client_name.localeCompare(b.client_name))
      .slice(0, 20);

    return {
      manager_name,
      headcount: clients.reduce((sum, c) => sum + c.headcount, 0),
      clients,
    };
  }).sort((a, b) => b.headcount - a.headcount || a.manager_name.localeCompare(b.manager_name));

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
                  <span>{c.client_name}</span>
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
