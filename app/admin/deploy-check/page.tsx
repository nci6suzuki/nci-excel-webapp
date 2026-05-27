'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

const checkGroups = [
  {
    title: '環境変数',
    checks: [
      'NEXT_PUBLIC_SUPABASE_URL が設定されている',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されている',
      'service_role key をフロントに置いていない',
      '.env.local をGitHubにアップしていない',
    ],
  },
  {
    title: 'ログイン・権限',
    checks: [
      'adminユーザーでログインできる',
      'managerユーザーでログインできる',
      'userユーザーでログインできる',
      'managerで自支店のみ見える',
      'userで自分の担当者分のみ見える',
    ],
  },
  {
    title: '主要機能',
    checks: [
      '月次入力ができる',
      'マップ図が表示される',
      'スタッフ詳細に遷移できる',
      'スタッフ反映ができる',
      '配置変更ができる',
      'Excel出力ができる',
    ],
  },
  {
    title: '本番デプロイ',
    checks: [
      'npm run build が成功する',
      'Vercelに環境変数を設定した',
      'SupabaseのSite URLを本番URLに設定した',
      '本番URLでログインできる',
      'スマホでメニューが使える',
    ],
  },
]

export default function DeployCheckPage() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  const flatChecks = checkGroups.flatMap((group) => group.checks)

  const progress = useMemo(() => {
    const total = flatChecks.length
    const checked = flatChecks.filter((item) => checkedItems[item]).length
    return {
      total,
      checked,
      percent: total === 0 ? 0 : Math.round((checked / total) * 100),
    }
  }, [checkedItems, flatChecks])

  function toggle(item: string) {
    setCheckedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }))
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-emerald-100">
            Production Readiness
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            本番公開前チェック
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
            デプロイ前に、環境変数・権限・主要機能・Supabase設定を確認します。
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="確認済み" value={`${progress.checked}/${progress.total}`} />
          <SummaryCard label="進捗率" value={`${progress.percent}%`} />
          <SummaryCard label="状態" value={progress.percent === 100 ? '公開可能' : '確認中'} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {checkGroups.map((group) => (
              <section key={group.title} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {group.title}
                  </h2>
                </div>

                <div className="space-y-2">
                  {group.checks.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={!!checkedItems[item]}
                        onChange={() => toggle(item)}
                        className="h-4 w-4"
                      />
                      {item}
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                確認コマンド
              </h2>
              <div className="mt-4 space-y-3">
                <CommandBlock command="npm run build" />
                <CommandBlock command="npm run dev" />
                <CommandBlock command="git status" />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                確認ページ
              </h2>
              <div className="mt-4 grid gap-2">
                <QuickLink href="/login" label="ログイン画面" />
                <QuickLink href="/admin" label="管理トップ" />
                <QuickLink href="/admin/system-check" label="運用チェック" />
                <QuickLink href="/admin/map" label="マップ図" />
                <QuickLink href="/admin/staff/export" label="スタッフ出力" />
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-black text-amber-900">
                注意
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                本番公開前にRLSを有効化する場合は、必ずテスト環境で manager/user の表示範囲を確認してください。
              </p>
            </section>
          </aside>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  )
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="rounded-xl bg-slate-900 px-4 py-3 font-mono text-xs font-bold text-white">
      {command}
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
    >
      {label}
    </Link>
  )
}
