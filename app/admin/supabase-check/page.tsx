'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

type CheckResult = {
  key: string
  label: string
  table: string
  count: number | null
  status: 'ok' | 'warning' | 'error'
  message: string
}

const checkTargets = [
  {
    key: 'branches',
    label: '支店マスタ',
    table: 'branches',
    required: true,
  },
  {
    key: 'sales_users',
    label: '担当者マスタ',
    table: 'sales_users',
    required: true,
  },
  {
    key: 'companies',
    label: '企業マスタ',
    table: 'companies',
    required: true,
  },
  {
    key: 'user_roles',
    label: 'ユーザー権限',
    table: 'user_roles',
    required: true,
  },
  {
    key: 'monthly_plans',
    label: '月次PLAN',
    table: 'monthly_plans',
    required: false,
  },
  {
    key: 'entry_plans',
    label: '入職予定',
    table: 'entry_plans',
    required: false,
  },
  {
    key: 'exit_plans',
    label: '退職予定',
    table: 'exit_plans',
    required: false,
  },
  {
    key: 'daily_results',
    label: '日次実績',
    table: 'daily_results',
    required: false,
  },
  {
    key: 'current_staff_assignments',
    label: '就業中スタッフ',
    table: 'current_staff_assignments',
    required: false,
  },
  {
    key: 'staff_assignment_histories',
    label: '配置変更履歴',
    table: 'staff_assignment_histories',
    required: false,
  },
]

const manualChecks = [
  {
    title: 'Supabase Auth ユーザー',
    checks: [
      'admin用ユーザーがAuthenticationに存在する',
      'manager用ユーザーがAuthenticationに存在する',
      'user用ユーザーがAuthenticationに存在する',
      'それぞれのメールアドレスでログインできる',
    ],
  },
  {
    title: 'user_roles',
    checks: [
      'adminユーザーのroleがadminになっている',
      'managerユーザーにbranch_idが設定されている',
      'userユーザーにbranch_idとsales_user_idが設定されている',
      'is_activeがtrueになっている',
    ],
  },
  {
    title: 'RLS',
    checks: [
      '本番公開前にRLS方針を決めている',
      'current_staff_assignmentsのRLSを確認した',
      'staff_assignment_historiesのRLSを確認した',
      'manager/userで他支店・他担当者データが見えないことを確認した',
    ],
  },
  {
    title: 'Authentication URL',
    checks: [
      'Site URLに本番URLを設定した',
      'Redirect URLsに本番URLを設定した',
      'ローカル検証用にhttp://localhost:3000/**を設定した',
    ],
  },
]

export default function SupabaseCheckPage() {
  const [results, setResults] = useState<CheckResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [manualChecked, setManualChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    runChecks()
  }, [])

  async function runChecks() {
    setLoading(true)
    setMessage('')

    const nextResults: CheckResult[] = []

    for (const target of checkTargets) {
      const { count, error } = await supabase
        .from(target.table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        nextResults.push({
          key: target.key,
          label: target.label,
          table: target.table,
          count: null,
          status: 'error',
          message: error.message,
        })
        continue
      }

      const actualCount = count ?? 0

      if (target.required && actualCount === 0) {
        nextResults.push({
          key: target.key,
          label: target.label,
          table: target.table,
          count: actualCount,
          status: 'warning',
          message: '必須マスタですが、データが0件です。',
        })
        continue
      }

      nextResults.push({
        key: target.key,
        label: target.label,
        table: target.table,
        count: actualCount,
        status: 'ok',
        message: '取得OK',
      })
    }

    setResults(nextResults)
    setLoading(false)
  }

  const summary = useMemo(() => {
    return {
      ok: results.filter((item) => item.status === 'ok').length,
      warning: results.filter((item) => item.status === 'warning').length,
      error: results.filter((item) => item.status === 'error').length,
      total: results.length,
    }
  }, [results])

  const manualProgress = useMemo(() => {
    const all = manualChecks.flatMap((group) => group.checks)
    const checked = all.filter((item) => manualChecked[item]).length

    return {
      total: all.length,
      checked,
      percent: all.length === 0 ? 0 : Math.round((checked / all.length) * 100),
    }
  }, [manualChecked])

  function toggleManual(item: string) {
    setManualChecked((prev) => ({
      ...prev,
      [item]: !prev[item],
    }))
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-emerald-100">
            Supabase Final Check
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            Supabase最終確認
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
            本番公開前に、主要テーブルの取得可否・件数・Auth設定・RLS設定を確認します。
          </p>
        </section>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="確認対象" value={`${summary.total}件`} />
          <SummaryCard label="OK" value={`${summary.ok}件`} tone="ok" />
          <SummaryCard label="注意" value={`${summary.warning}件`} tone="warning" />
          <SummaryCard label="エラー" value={`${summary.error}件`} tone="error" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                主要テーブル確認
              </h2>
              <p className="text-sm text-slate-500">
                Supabaseから各テーブルの件数を取得します。RLSで拒否される場合はエラーになります。
              </p>
            </div>

            <button
              onClick={runChecks}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              {loading ? '確認中...' : '再確認'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-3 py-2">状態</th>
                  <th className="px-3 py-2">名称</th>
                  <th className="px-3 py-2">テーブル</th>
                  <th className="px-3 py-2 text-right">件数</th>
                  <th className="px-3 py-2">メッセージ</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.key} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-900">
                      {item.label}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {item.table}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {item.count === null ? '-' : item.count}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {item.message}
                    </td>
                  </tr>
                ))}

                {results.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      まだ確認していません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {manualChecks.map((group) => (
              <section key={group.title} className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  {group.title}
                </h2>

                <div className="space-y-2">
                  {group.checks.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={!!manualChecked[item]}
                        onChange={() => toggleManual(item)}
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
                手動確認進捗
              </h2>
              <p className="mt-2 text-3xl font-black text-slate-900">
                {manualProgress.percent}%
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {manualProgress.checked}/{manualProgress.total} 件確認済み
              </p>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                関連ページ
              </h2>

              <div className="mt-4 grid gap-2">
                <QuickLink href="/admin/users" label="ユーザー管理" />
                <QuickLink href="/admin/system-check" label="運用チェック" />
                <QuickLink href="/admin/deploy-check" label="公開前チェック" />
                <QuickLink href="/admin/backup" label="バックアップ" />
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-black text-amber-900">
                RLS注意
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                開発中にRLSを無効化した場合、本番前に必ずテスト環境で権限制御を確認してください。
              </p>
            </section>
          </aside>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'ok' | 'warning' | 'error'
}) {
  const color =
    tone === 'ok'
      ? 'text-emerald-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : tone === 'error'
          ? 'text-red-700'
          : 'text-slate-900'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black ${color}`}>
        {value}
      </p>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: 'ok' | 'warning' | 'error'
}) {
  if (status === 'ok') {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700">
        OK
      </span>
    )
  }

  if (status === 'warning') {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">
        注意
      </span>
    )
  }

  return (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-black text-red-700">
      エラー
    </span>
  )
}

function QuickLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
    >
      {label}
    </Link>
  )
}
