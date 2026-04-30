'use client'

import Link from 'next/link'

const menuItems = [
  { title: '月次入力', description: '入職予定・退職予定・日次実績を登録します。', href: '/admin/monthly-headcount', accent: 'bg-blue-600' },
  { title: '支店別ダッシュボード', description: '全支店のPLAN差・着地見込み・実績を確認します。', href: '/admin/monthly-headcount/dashboard', accent: 'bg-indigo-600' },
  { title: '集計・実績', description: '陣立て表、個人別実績、稼働人員変動表を確認します。', href: '/admin/monthly-headcount/report', accent: 'bg-emerald-600' },
  { title: '一覧・編集', description: '入職・退職・日次実績の確認、編集、取消を行います。', href: '/admin/monthly-headcount/list', accent: 'bg-slate-700' },
  { title: '支店マスタ', description: '支店名、表示順、有効状態を管理します。', href: '/admin/masters/branches', accent: 'bg-cyan-600' },
  { title: '担当者マスタ', description: '営業担当者と所属支店を管理します。', href: '/admin/masters/sales-users', accent: 'bg-orange-500' },
  { title: '企業マスタ', description: '派遣先企業と支店・主担当を管理します。', href: '/admin/masters/companies', accent: 'bg-violet-600' },
  { title: 'ユーザー管理', description: 'ログインユーザーの権限、支店、担当者紐づけを管理します。', href: '/admin/users', accent: 'bg-rose-600' },
]

export default function AdminTopPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">Admin Console</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">管理者トップページ</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">月次人員管理、支店別ダッシュボード、各種マスタ、ユーザー管理など、運用に必要なメニューをここから確認できます。</p>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 className="text-lg font-bold text-slate-900">メニュー</h2><p className="text-sm text-slate-500">よく使う管理機能をまとめています。</p></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {menuItems.map((item) => <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className={`mb-4 h-2 w-16 rounded-full ${item.accent}`} /><h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p><div className="mt-4 text-sm font-bold text-blue-600">開く →</div></Link>)}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 className="text-lg font-bold text-slate-900">運用チェック</h2><p className="text-sm text-slate-500">月次運用時に確認しておきたい項目です。</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><ChecklistCard title="月初" text="支店・担当者・企業マスタを確認し、PLANと月初人数を登録" /><ChecklistCard title="日次" text="入職・退職・日次実績を入力" /><ChecklistCard title="週次" text="A+B着地とPLAN差を確認" /><ChecklistCard title="月末" text="Excel出力して会議資料へ反映" /></div>
        </section>
      </div>
    </div>
  )
}
function ChecklistCard({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black text-slate-900">{title}</p><p className="mt-1 text-sm text-slate-600">{text}</p></div> }
