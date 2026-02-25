import Link from 'next/link';
import UploadPanel from '../lib/ui/UploadPanel.js';
import { getDb } from '../lib/db.js';

export default function HomePage() {
  const db = getDb();
  const kpis = {
    staff: db.prepare(`SELECT COUNT(*) AS c FROM staff WHERE leave_date IS NULL OR leave_date=''`).get().c,
    prospects: db.prepare(`SELECT COUNT(*) AS c FROM staff WHERE join_date IS NOT NULL AND join_date <> '' AND (leave_date IS NULL OR leave_date='')`).get().c,
    managers: db.prepare(`SELECT COUNT(DISTINCT sales_name) AS c FROM staff WHERE sales_name IS NOT NULL AND sales_name <> ''`).get().c,
    clients: db.prepare(`SELECT COUNT(DISTINCT client_name) AS c FROM assignments WHERE client_name IS NOT NULL AND client_name <> ''`).get().c,
  };

  const pageLinks = [
    ['/pipeline', '陣立て表', '見込み/入社確定/退社確定の更新をこの画面で管理（MVPは表示中心）'],
    ['/map', 'マップ図', '支店→担当→クライアント→スタッフを固定枠イメージで閲覧'],
    ['/ledger', '入退社台帳', '入社確定・退社確定のイベントを時系列で確認'],
    ['/performance', '個人実績', '担当・月ごとに個人実績を集計して一覧表示'],
    ['/headcount', '稼働人員変動', '当月入社/退社/純増減/在籍を自動集計して可視化'],
    ['/masters', 'マスタ管理', '担当固定枠・支店・担当・クライアント辞書の整備状況を確認'],
    ['/io', '取込/出力', 'Excel取り込みと帳票出力（MVPは取込済データ確認）'],
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="panel hero">
        <h1 style={{ margin: 0, fontSize: 28 }}>要件定義対応ダッシュボード</h1>
        <p style={{ margin: '10px 0 0', lineHeight: 1.7, opacity: 0.95 }}>
          陣立て表を基準とした入力・自動連動・帳票化までをWebで完結するためのMVP画面です。
          各ページの見た目を統一し、運用担当が迷わない導線へ整理しました。
        </p>
      </section>

      <section className="kpi-grid">
        <div className="kpi"><div className="value">{kpis.staff}</div><div className="label">在籍スタッフ</div></div>
        <div className="kpi"><div className="value">{kpis.prospects}</div><div className="label">見込み/在籍候補</div></div>
        <div className="kpi"><div className="value">{kpis.managers}</div><div className="label">担当者数</div></div>
        <div className="kpi"><div className="value">{kpis.clients}</div><div className="label">クライアント数</div></div>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h2 className="section-title">機能ページ</h2>
        <div className="card-grid">
          {pageLinks.map(([href, title, desc]) => (
            <Link key={href} href={href} className="card-link">
              <div style={{ fontSize: 17, fontWeight: 900 }}>{title}</div>
              <div style={{ marginTop: 6, color: '#475569', lineHeight: 1.6 }}>{desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h2 className="section-title">Excel 取込</h2>
        <UploadPanel />
      </section>
    </div>
  );
}
