export const dynamic = 'force-dynamic';
import StatusCell from '../../lib/ui/StatusCell.js';
import PipelineRowForm from '../../lib/ui/PipelineRowForm.js';
import { computeFiscalMonths, statusLabel } from '../../lib/pipeline.js';
import { parseYearMonth, supabaseRest } from '../../lib/supabase.js';

function groupBySection(rows) {
  return rows.reduce((acc, row) => {
    if (!acc[row.section]) acc[row.section] = [];
    acc[row.section].push(row);
    return acc;
  }, {});
}

function renderRows(rows, columns, month) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>状態</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => <td key={`${r.id}-${c.key}`}>{r[c.key] || '-'}</td>)}
              <td>
                <StatusCell id={r.id} status={r.status} month={month} />
                <div style={{ marginTop: 4, color: '#64748b', fontSize: 11 }}>{statusLabel(r.status)}</div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length + 1} style={{ color: '#64748b' }}>データなし</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function PipelinePage({ searchParams }) {
  const months = computeFiscalMonths(new Date());
  const branchRows = await supabaseRest('branches', { query: { select: 'name', is_active: 'eq.true', order: 'sort_order.asc,name.asc' } });
  const branches = branchRows.map((r) => r.name);
  const month = searchParams?.month || months[0];
  const branch = searchParams?.branch || branches[0] || '未設定';
  const parsed = parseYearMonth(month);

  const rows = parsed
    ? await supabaseRest('jin_date_rows', {
        query: {
          select: 'id,section,case_type,rank,staff_name,client_name,hope,tour_date,manager_name,selection_text,start_date,leave_client_name,leave_date,rework_text,next_job,leave_reason,memo,status',
          target_year: `eq.${parsed.year}`,
          target_month: `eq.${parsed.month}`,
          branch_name: `eq.${branch}`,
          order: 'manager_name.asc,client_name.asc,staff_name.asc',
        },
      })
    : [];

  const normalizedRows = rows.map((r) => ({
    ...r,
    selection: r.selection_text,
    rework: r.rework_text,
    next_job: r.next_job,
    client_name: r.client_name || r.leave_client_name,
  }));

  const sec = groupBySection(normalizedRows);

  const joinCols = [
    { key: 'staff_name', label: '氏名' },
    { key: 'client_name', label: 'クライアント' },
    { key: 'tour_date', label: '見学日' },
    { key: 'manager_name', label: '担当' },
    { key: 'selection', label: '人選' },
    { key: 'start_date', label: '入職日' },
  ];
  const leaveCols = [
    { key: 'staff_name', label: '氏名' },
    { key: 'client_name', label: '退職クライアント' },
    { key: 'leave_date', label: '退職日' },
    { key: 'manager_name', label: '担当' },
    { key: 'rework', label: '再稼働' },
    { key: 'next_job', label: '次職' },
    { key: 'leave_reason', label: '退職理由' },
  ];
  const prospectCols = [
    { key: 'case_type', label: '案件区分' },
    { key: 'rank', label: 'ランク' },
    { key: 'staff_name', label: '氏名' },
    { key: 'client_name', label: 'クライアント' },
    { key: 'hope', label: '希望' },
    { key: 'tour_date', label: '見学日' },
    { key: 'manager_name', label: '担当' },
    { key: 'selection', label: '人選' },
    { key: 'memo', label: '備考' },
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>陣立て表（入力・更新）</h1>
        <form action="/pipeline" method="get" className="filters">
          <label style={{ fontWeight: 800 }}>月</label>
          <select name="month" defaultValue={month}>{months.map((m) => <option key={m}>{m}</option>)}</select>
          <label style={{ fontWeight: 800 }}>支店</label>
          <select name="branch" defaultValue={branch}>{branches.map((b) => <option key={b}>{b}</option>)}</select>
          <button>表示</button>
        </form>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h2 className="section-title">新規行の追加</h2>
        <PipelineRowForm months={months} branches={branches} defaultMonth={month} defaultBranch={branch} />
      </section>

      <section className="panel" style={{ padding: 16 }}><h2 className="section-title">見込み案件（当月/次月）</h2>{renderRows([...(sec.prospect_current || []), ...(sec.prospect_next || [])], prospectCols, month)}</section>
      <section className="panel" style={{ padding: 16 }}><h2 className="section-title">入職確定</h2>{renderRows(sec.join_confirmed || [], joinCols, month)}</section>
      <section className="panel" style={{ padding: 16 }}><h2 className="section-title">退職者（予定含む）</h2>{renderRows([...(sec.leave_current || []), ...(sec.leave_next || [])], leaveCols, month)}</section>
      <section className="panel" style={{ padding: 16 }}><h2 className="section-title">求職者</h2>{renderRows(sec.jobseeker || [], prospectCols, month)}</section>
    </div>
  );
}