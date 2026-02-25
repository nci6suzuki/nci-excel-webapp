import { getDb } from '../../lib/db.js';
import StatusCell from '../../lib/ui/StatusCell.js';
import PipelineRowForm from '../../lib/ui/PipelineRowForm.js';
import { computeFiscalMonths, statusLabel } from '../../lib/pipeline.js';

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

export default function PipelinePage({ searchParams }) {
  const db = getDb();
  const months = computeFiscalMonths(new Date());
  const branches = db.prepare(`SELECT DISTINCT branch FROM jin_date_rows ORDER BY branch`).all().map((r) => r.branch);
  const month = searchParams?.month || months[0];
  const branch = searchParams?.branch || branches[0] || '未設定';

  const rows = db.prepare(`
    SELECT *
    FROM jin_date_rows
    WHERE target_month=? AND branch=?
    ORDER BY manager_name, client_name, staff_name
  `).all(month, branch);
  const sec = groupBySection(rows);

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
    { key: 'hope', label: '希望' },
    { key: 'tour_date', label: '見学日' },
    { key: 'manager_name', label: '担当' },
    { key: 'selection', label: '人選' },
    { key: 'memo', label: '備考' },
  ];
  const seekerCols = [
    { key: 'staff_name', label: '氏名' },
    { key: 'hope', label: '希望' },
    { key: 'manager_name', label: '担当' },
    { key: 'memo', label: '備考' },
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>陣立て（月タブ）</h1>
        <form className="filters" action="/pipeline" method="get">
          <label style={{ fontWeight: 800 }}>月タブ</label>
          <select name="month" defaultValue={month}>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <label style={{ fontWeight: 800 }}>支店</label>
          <select name="branch" defaultValue={branch}>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select>
          <button>表示</button>
        </form>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>陣立て表 入力</h2>
        <PipelineRowForm
          months={months}
          branches={branches}
          defaultMonth={month}
          defaultBranch={branch}
        />
      </section>

      <section className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <article className="panel" style={{ padding: 12 }}>
          <h3 className="section-title">A. 入職確定</h3>
          {renderRows(sec.join_confirmed || [], joinCols, month)}
        </article>
        <article className="panel" style={{ padding: 12 }}>
          <h3 className="section-title">A. 退職者（予定者含む）</h3>
          {renderRows(sec.leave || [], leaveCols, month)}
        </article>
      </section>

      <section className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <article className="panel" style={{ padding: 12 }}>
          <h3 className="section-title">B. 見込み案件</h3>
          {renderRows(sec.prospect_current || [], prospectCols, month)}
        </article>
        <article className="panel" style={{ padding: 12 }}>
          <h3 className="section-title">B. 求職者</h3>
          {renderRows(sec.jobseeker || [], seekerCols, month)}
        </article>
      </section>

      <section className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <article className="panel" style={{ padding: 12 }}>
          <h3 className="section-title">C. 次月見込み案件</h3>
          {renderRows(sec.prospect_next || [], prospectCols, month)}
        </article>
        <article className="panel" style={{ padding: 12 }}>
          <h3 className="section-title">C. 次月退職者</h3>
          {renderRows(sec.leave_next || [], leaveCols, month)}
        </article>
      </section>

      <p className="note">連動ルール: 見込み→入職確定で自動的に「入職確定セクション」、退職予定/確定で退職系セクションに移動します（status更新時にsection再計算）。</p>
    </div>
  );
}