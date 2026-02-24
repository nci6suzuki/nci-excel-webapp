import UploadPanel from '../lib/ui/UploadPanel.js';

export default function HomePage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '8px 0 6px' }}>Excelを崩さずに“連動”させる Webアプリ（MVP）</h1>
      <p style={{ color: '#374151', lineHeight: 1.6 }}>
        このMVPは、既存のExcel（マップ図/入退社/個人別実績/稼働人員変動）をそのまま入力源として取り込み、
        Web上で「支店→担当→クライアント→スタッフ」「個人別実績」を閲覧できる形にします。
        <br />
        まずは <b>“入退社が正”</b> の考え方でDBに取り込み、他の表はID/氏名で突合します（シートの形は維持）。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>① 取り込み（Excelアップロード）</h2>
          <UploadPanel />
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>② 使い方</h2>
          <ol style={{ color: '#374151', lineHeight: 1.8 }}>
            <li>このプロジェクトをPCに置き、<code>npm i</code> → <code>npm run dev</code></li>
            <li>この画面からExcelをアップロード（複数OK）</li>
            <li><b>マップ</b>：支店を選ぶ → 担当固定枠順に階層表示</li>
            <li><b>個人実績</b>：支店/担当/月で検索</li>
          </ol>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
            ※ 既存Excelの「書き方」を変えない前提なので、取り込みは“列名ゆれ”に強い推定ロジック＋設定ファイルで吸収します。
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>このMVPで“連動”がどう実現されるか</h2>
        <ul style={{ color: '#374151', lineHeight: 1.8 }}>
          <li><b>入退社</b>（マップ図内の入退社シート）を取り込み → <b>staff_id</b> を自動生成/維持（氏名+支店+入社日ベース）</li>
          <li><b>個人別実績</b>は「氏名」「担当者名」等の列を推定して取り込み → staff_id で突合</li>
          <li>Web表示は常にDBから生成するので、Excel側を更新して取り込み直せばWeb側も自動更新</li>
        </ul>
      </div>
    </div>
  );
}
