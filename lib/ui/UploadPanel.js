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
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <input type="file" name="files" multiple accept=".xlsx" disabled={busy} />
      <button disabled={busy}>{busy ? '取り込み中…' : 'Excelを取り込む'}</button>
      <div style={{ minHeight: 20, fontWeight: 700, color: '#334155' }}>{status}</div>
      <div className="note" style={{ marginTop: 0 }}>
        推奨ファイル：マップ図（入退社） / 稼働人員変動表 / 個人別実績管理表
      </div>
    </form>
  );
}
