import { getDb } from '../../lib/db.js';
import UploadPanel from '../../lib/ui/UploadPanel.js';

export default function IoPage() {
  const db = getDb();
  const imports = db.prepare('SELECT filename, kind, imported_at FROM imports ORDER BY id DESC LIMIT 100').all();

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>取込 / 出力</h1>
        <p className="note" style={{ marginTop: 8 }}>MVPはExcel取り込み履歴を提供。帳票出力（Excel/PDF）は次フェーズでテンプレート固定生成に対応。</p>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h2 className="section-title">Excel取込</h2>
        <UploadPanel />
      </section>

      <section className="table-wrap">
        <table className="table">
          <thead><tr><th>日時</th><th>種別</th><th>ファイル名</th></tr></thead>
          <tbody>
            {imports.map((r, i) => <tr key={`${r.filename}-${i}`}><td>{r.imported_at}</td><td>{r.kind}</td><td>{r.filename}</td></tr>)}
          </tbody>
        </table>
      </section>
    </div>
  );
}