export const metadata = {
  title: 'NCI 人員マップ Web',
  description: 'Excel（マップ図/入退社/個人別実績/稼働人員変動）を崩さずに連動させてWeb表示するMVP',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans JP", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif', margin: 0 }}>
        <div style={{ borderBottom: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/" style={{ textDecoration: 'none', color: '#111827', fontWeight: 800 }}>NCI 人員マップ Web</a>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <a href="/map" style={{ textDecoration: 'none', color: '#111827' }}>マップ</a>
            <a href="/performance" style={{ textDecoration: 'none', color: '#111827' }}>個人実績</a>
          </div>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}
