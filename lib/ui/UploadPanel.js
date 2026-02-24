'use client';

import { useState } from 'react';

export default function UploadPanel() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input[type=file]');
    if (!input.files?.length) return;

    setBusy(true);
    setStatus('アップロード中…');

    const fd = new FormData();
    for (const f of input.files) fd.append('files', f);

    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(`失敗: ${json?.error ?? res.statusText}`);
      return;
    }
    setStatus(`完了: ${json.summary}`);
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: 'grid', gap: 10 }}>
        <input type="file" name="files" multiple accept=".xlsx" disabled={busy} />
        <button disabled={busy} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #111827', background: '#111827', color: 'white', fontWeight: 700 }}>
          取り込み
        </button>
        <div style={{ minHeight: 20, color: '#374151' }}>{status}</div>
        <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
          推奨：<br />
          ・マップ図（入退社シート含む）<br />
          ・稼働人員変動表（15期）<br />
          ・個人別実績管理表（各支店）<br />
        </div>
      </div>
    </form>
  );
}
