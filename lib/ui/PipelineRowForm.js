'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const statusOptions = [
  ['prospect', '見込み'],
  ['proposing', '提案中'],
  ['tour_scheduled', '見学設定済'],
  ['offer', '入職確定'],
  ['active', '稼働中'],
  ['leave_notice', '退職予定'],
  ['left', '退職確定'],
  ['invalid', '失注/無効'],
];

const caseTypeOptions = ['新規案件', '再稼働案件', '見込みになっていない提案中の方'];

export default function PipelineRowForm({ months, branches, defaultMonth, defaultBranch }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    target_month: defaultMonth,
    branch: defaultBranch,
    staff_name: '',
    client_name: '',
    manager_name: '',
    status: 'prospect',
    case_type: caseTypeOptions[0],
    rank: '',
    hope: '',
    tour_date: '',
    start_date: '',
    leave_date: '',
    selection: '',
    memo: '',
  });

  const orderedBranches = useMemo(() => {
    if (branches.includes(defaultBranch)) return branches;
    return [defaultBranch, ...branches];
  }, [branches, defaultBranch]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('保存中…');
    const res = await fetch('/api/pipeline/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json?.error || '保存に失敗しました。');
      setSaving(false);
      return;
    }

    setMessage('追加しました。');
    setForm((prev) => ({
      ...prev,
      staff_name: '',
      client_name: '',
      manager_name: '',
      rank: '',
      hope: '',
      tour_date: '',
      start_date: '',
      leave_date: '',
      selection: '',
      memo: '',
    }));
    router.replace(`/pipeline?month=${encodeURIComponent(form.target_month)}&branch=${encodeURIComponent(form.branch)}`);
    router.refresh();
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(170px, 1fr))' }}>
        <label>月タブ<input value={form.target_month} onChange={(e) => setField('target_month', e.target.value)} list="month-options" required /></label>
        <label>支店<select value={form.branch} onChange={(e) => setField('branch', e.target.value)}>{orderedBranches.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
        <label>状態<select value={form.status} onChange={(e) => setField('status', e.target.value)}>{statusOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label>案件区分<select value={form.case_type} onChange={(e) => setField('case_type', e.target.value)}>{caseTypeOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label>氏名<input value={form.staff_name} onChange={(e) => setField('staff_name', e.target.value)} required /></label>
        <label>クライアント<input value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} /></label>
        <label>担当<input value={form.manager_name} onChange={(e) => setField('manager_name', e.target.value)} /></label>
        <label>ランク<input value={form.rank} onChange={(e) => setField('rank', e.target.value)} placeholder="A/B/C" /></label>
        <label>希望<input value={form.hope} onChange={(e) => setField('hope', e.target.value)} /></label>
        <label>見学日<input type="date" value={form.tour_date} onChange={(e) => setField('tour_date', e.target.value)} /></label>
        <label>入職日<input type="date" value={form.start_date} onChange={(e) => setField('start_date', e.target.value)} /></label>
        <label>退職日<input type="date" value={form.leave_date} onChange={(e) => setField('leave_date', e.target.value)} /></label>
      </div>
      <label>人選<input value={form.selection} onChange={(e) => setField('selection', e.target.value)} /></label>
      <label>備考<textarea value={form.memo} onChange={(e) => setField('memo', e.target.value)} rows={2} /></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button disabled={saving}>{saving ? '保存中…' : '陣立て表に追加'}</button>
        <span style={{ color: '#64748b', fontSize: 12 }}>{message}</span>
      </div>
      <datalist id="month-options">{months.map((m) => <option key={m} value={m} />)}</datalist>
    </form>
  );
}