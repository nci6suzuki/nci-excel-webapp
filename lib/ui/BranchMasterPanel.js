'use client';

import { useMemo, useState } from 'react';

export default function BranchMasterPanel({ initialBranches }) {
  const [branches, setBranches] = useState(initialBranches);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const normalized = useMemo(() => name.trim(), [name]);

  async function addBranch(e) {
    e.preventDefault();
    if (!normalized) {
      setMessage('支店名を入力してください。');
      return;
    }

    setSaving(true);
    setMessage('保存中…');

    const res = await fetch('/api/masters/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: normalized }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(json?.error || '保存に失敗しました。');
      setSaving(false);
      return;
    }

    setBranches(json.branches || []);
    setName('');
    setMessage('追加しました。');
    setSaving(false);
  }

  async function deleteBranch(target) {
    if (!window.confirm(`「${target}」を削除しますか？`)) return;

    setSaving(true);
    setMessage('削除中…');

    const res = await fetch('/api/masters/branches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: target }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(json?.error || '削除に失敗しました。');
      setSaving(false);
      return;
    }

    setBranches(json.branches || []);
    setMessage('削除しました。');
    setSaving(false);
  }

  return (
    <article className="panel" style={{ padding: 14, display: 'grid', gap: 10 }}>
      <h3 className="section-title">支店マスタ</h3>
      <form onSubmit={addBranch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 東京支店"
          style={{ minWidth: 180 }}
          disabled={saving}
        />
        <button disabled={saving}>追加</button>
      </form>
      <div style={{ color: '#64748b', fontSize: 12 }}>{message}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {branches.map((branch) => (
          <div key={branch} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <span>{branch}</span>
            <button type="button" onClick={() => deleteBranch(branch)} disabled={saving}>削除</button>
          </div>
        ))}
      </div>
    </article>
  );
}