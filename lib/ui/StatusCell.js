'use client';

import { useState } from 'react';

const options = [
  ['prospect', '見込み'],
  ['proposing', '提案中'],
  ['tour_scheduled', '見学設定済'],
  ['offer', '入職確定'],
  ['active', '稼働中'],
  ['leave_notice', '退職予定'],
  ['left', '退職確定'],
  ['invalid', '失注/無効'],
];

export default function StatusCell({ id, status, month }) {
  const [value, setValue] = useState(status);
  const [msg, setMsg] = useState('');

  async function save(next) {
    setValue(next);
    setMsg('更新中…');
    const res = await fetch('/api/pipeline/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next, target_month: month, updated_by: 'web-user' }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json?.error || '更新失敗');
      return;
    }
    setMsg('保存済');
  }

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <select value={value} onChange={(e) => save(e.target.value)} style={{ minWidth: 140 }}>
        {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <span style={{ color: '#64748b', fontSize: 11 }}>{msg}</span>
    </div>
  );
}