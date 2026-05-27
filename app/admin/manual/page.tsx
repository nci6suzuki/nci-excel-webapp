'use client'

import Link from 'next/link'

const dailyFlow = [
  '本日確認で未入力・要対応を確認',
  '月次入力で入職・退職・日次実績を登録',
  'スタッフ反映で入職確定・退職確定をスタッフへ反映',
  'マップ図で企業別の配置を確認',
  '必要に応じて配置変更を実施',
  'スタッフ出力で配置表をExcel出力',
]

const sections = [
  {
    title: 'ログイン・初期表示',
    items: [
      ['ログイン', 'メールアドレスとパスワードを入力してログインします。', '/login'],
      ['管理トップ', 'ログイン後は管理トップから各機能へ移動できます。', '/admin'],
    ],
  },
  {
    title: '月次人員管理',
    items: [
      ['月次入力', '入職予定、退職予定、日次実績を登録します。', '/admin/monthly-headcount'],
      ['一覧・編集', '登録済みデータを確認・修正します。', '/admin/monthly-headcount/list'],
      ['集計', '陣立て表、個人別実績、支店別状況を確認します。', '/admin/monthly-headcount/report'],
    ],
  },
  {
    title: 'スタッフ・マップ図',
    items: [
      ['就業中スタッフ', 'マップ図に表示されるスタッフを個別登録・編集します。', '/admin/staff/current'],
      ['スタッフ取込', 'CSVでスタッフを一括登録します。', '/admin/staff/import'],
      ['スタッフ反映', '入職確定者・退職確定者をスタッフ情報へ反映します。', '/admin/staff/sync'],
      ['マップ図', '企業別にスタッフ配置を確認します。', '/admin/map'],
      ['配置変更', 'スタッフの就業先や担当者を変更します。', '/admin/staff/transfer'],
      ['スタッフ出力', 'スタッフ配置表をExcel出力します。', '/admin/staff/export'],
    ],
  },
  {
    title: 'マスタ・ユーザー管理',
    items: [
      ['支店マスタ', '支店情報を登録・編集します。', '/admin/masters/branches'],
      ['担当者マスタ', '営業担当者を登録・編集します。', '/admin/masters/sales-users'],
      ['企業マスタ', '派遣先企業を登録・編集します。', '/admin/masters/companies'],
      ['ユーザー管理', '権限・支店・担当者を設定します。', '/admin/users'],
    ],
  },
  {
    title: 'チェック・公開前確認',
    items: [
      ['運用チェック', '権限・RLS・不要機能を確認します。', '/admin/system-check'],
      ['公開前チェック', '環境変数・デプロイ前確認を行います。', '/admin/deploy-check'],
    ],
  },
]

const troubleItems = [
  ['ログインできない', 'Supabase Authenticationにユーザーがあるか、/admin/usersで有効になっているか確認してください。'],
  ['メニューが表示されない', '/admin/usersでrole、branch_id、sales_user_idが正しく設定されているか確認してください。'],
  ['403 Forbiddenが出る', 'SupabaseのRLSで拒否されています。開発中は該当テーブルのRLSを確認してください。'],
  ['マップ図にスタッフが出ない', 'スタッフのis_active、employment_status、company_idを確認してください。'],
  ['Excel出力できない', 'package.jsonにxlsxが入っているか確認してください。'],
]

export default function OperationManualPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">Operation Manual</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">運用マニュアル</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            管理システムの使い方、日次運用の流れ、トラブル時の確認ポイントをまとめています。
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {dailyFlow.map((item, index) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                {index + 1}
              </div>
              <p className="text-sm font-bold leading-6 text-slate-700">{item}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-black text-slate-900">{section.title}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {section.items.map(([title, text, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <h3 className="text-sm font-black text-slate-900">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                      <p className="mt-3 text-xs font-bold text-blue-600">開く →</p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">よく使うページ</h2>
              <div className="mt-4 grid gap-2">
                <QuickLink href="/admin/today" label="本日確認" />
                <QuickLink href="/admin/monthly-headcount" label="月次入力" />
                <QuickLink href="/admin/map" label="マップ図" />
                <QuickLink href="/admin/staff/sync" label="スタッフ反映" />
                <QuickLink href="/admin/staff/transfer" label="配置変更" />
                <QuickLink href="/admin/staff/export" label="スタッフ出力" />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">トラブル時の確認</h2>
              <div className="mt-4 space-y-3">
                {troubleItems.map(([title, text]) => (
                  <details key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-black text-slate-800">{title}</summary>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                  </details>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100">
      {label}
    </Link>
  )
}
