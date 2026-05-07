'use client'

import Link from 'next/link'

const sections = [
  {
    title: '本日確認',
    description: '朝一番で確認する画面です。',
    items: [
      {
        title: '本日確認',
        href: '/admin/today',
        description: '本日の入退職・未入力・要対応を確認',
        accent: 'bg-blue-600',
      },
      {
        title: '要対応',
        href: '/admin/alerts',
        description: '見学後未処理、退職予定、PLAN未設定を確認',
        accent: 'bg-red-600',
      },
    ],
  },
  {
    title: '月次人員管理',
    description: '人員PLAN、入職予定、退職予定、日次実績を管理します。',
    items: [
      {
        title: '月次入力',
        href: '/admin/monthly-headcount',
        description: '入職・退職・日次実績を登録',
        accent: 'bg-blue-600',
      },
      {
        title: '支店別',
        href: '/admin/monthly-headcount/dashboard',
        description: '支店別の着地状況を確認',
        accent: 'bg-indigo-600',
      },
      {
        title: '集計',
        href: '/admin/monthly-headcount/report',
        description: '陣立て表・個人別実績を確認',
        accent: 'bg-emerald-600',
      },
      {
        title: '一覧・編集',
        href: '/admin/monthly-headcount/list',
        description: '登録内容の確認・修正',
        accent: 'bg-slate-700',
      },
    ],
  },
  {
    title: 'スタッフ・マップ図',
    description: '就業中スタッフ、配置変更、マップ図を管理します。',
    items: [
      {
        title: 'マップ図',
        href: '/admin/map',
        description: '企業別スタッフ配置を確認',
        accent: 'bg-violet-600',
      },
      {
        title: 'スタッフ検索',
        href: '/admin/staff',
        description: 'スタッフ一覧・詳細を確認',
        accent: 'bg-cyan-600',
      },
      {
        title: '就業中スタッフ',
        href: '/admin/staff/current',
        description: 'スタッフを個別登録・編集',
        accent: 'bg-blue-500',
      },
      {
        title: 'スタッフ取込',
        href: '/admin/staff/import',
        description: 'CSVで一括取込',
        accent: 'bg-orange-500',
      },
      {
        title: 'スタッフ反映',
        href: '/admin/staff/sync',
        description: '入退職予定から反映',
        accent: 'bg-rose-600',
      },
      {
        title: '配置変更',
        href: '/admin/staff/transfer',
        description: 'スタッフ異動・配置履歴',
        accent: 'bg-sky-600',
      },
      {
        title: 'スタッフ出力',
        href: '/admin/staff/export',
        description: '配置表・履歴をExcel出力',
        accent: 'bg-emerald-700',
      },
    ],
  },
  {
    title: 'マスタ管理',
    description: '支店・担当者・企業・ユーザーを管理します。',
    items: [
      {
        title: '支店マスタ',
        href: '/admin/masters/branches',
        description: '支店の登録・編集',
        accent: 'bg-cyan-700',
      },
      {
        title: '担当者マスタ',
        href: '/admin/masters/sales-users',
        description: '営業担当者の登録・編集',
        accent: 'bg-orange-600',
      },
      {
        title: '企業マスタ',
        href: '/admin/masters/companies',
        description: '派遣先企業の登録・編集',
        accent: 'bg-violet-700',
      },
      {
        title: 'マスタ取込',
        href: '/admin/masters/import',
        description: '支店・担当者・企業をCSV取込',
        accent: 'bg-lime-600',
      },
      {
        title: 'ユーザー管理',
        href: '/admin/users',
        description: 'ログイン権限・支店・担当者設定',
        accent: 'bg-rose-700',
      },
    ],
  },
]

export default function AdminTopPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">
            Admin Console
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            管理者トップページ
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
            月次人員管理、スタッフ配置、マップ図、マスタ管理を目的別に整理しました。
          </p>
        </section>

        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {section.title}
              </h2>
              <p className="text-sm text-slate-500">
                {section.description}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div className={`mb-4 h-2 w-16 rounded-full ${item.accent}`} />
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                  <div className="mt-4 text-sm font-bold text-blue-600">
                    開く →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
