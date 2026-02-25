import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'NCI 人員マップ Web',
  description: '陣立て表ドリブン 人員マップ＆個人実績 Webアプリ',
};

const navItems = [
  ['/', 'ダッシュボード'],
  ['/pipeline', '陣立て表'],
  ['/map', 'マップ図'],
  ['/ledger', '入退社台帳'],
  ['/performance', '個人実績'],
  ['/headcount', '稼働人員変動'],
  ['/masters', 'マスタ'],
  ['/io', '取込/出力'],
];

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">NCI 人員マップ Web</Link>
            <nav className="nav">
              {navItems.map(([href, label]) => (
                <Link key={href} href={href}>{label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
