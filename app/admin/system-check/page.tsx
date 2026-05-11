'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

type CurrentUserRole = {
  user_id: string
  name: string | null
  email: string | null
  role: 'admin' | 'manager' | 'user'
  branch_id: string | null
  sales_user_id: string | null
  branches?: {
    branch_name: string
  } | null
}

type CheckItem = {
  category: string
  title: string
  admin: boolean
  manager: boolean
  user: boolean
  note: string
}

const permissionChecks: CheckItem[] = [
  {
    category: '本日確認',
    title: '本日確認ダッシュボード',
    admin: true,
    manager: true,
    user: true,
    note: '全ロールで表示。ただし表示データは権限で絞る。',
  },
  {
    category: '本日確認',
    title: '要対応アラート',
    admin: true,
    manager: true,
    user: true,
    note: '全ロールで表示。ただし表示データは権限で絞る。',
  },
  {
    category: '月次人員管理',
    title: '月次入力',
    admin: true,
    manager: true,
    user: true,
    note: 'userは自分の担当者分のみ。',
  },
  {
    category: '月次人員管理',
    title: '支店別ダッシュボード',
    admin: true,
    manager: true,
    user: false,
    note: 'userには非表示推奨。',
  },
  {
    category: '月次人員管理',
    title: '集計・一覧',
    admin: true,
    manager: true,
    user: true,
    note: 'userは自分の担当者分のみ。',
  },
  {
    category: 'スタッフ・マップ図',
    title: 'マップ図',
    admin: true,
    manager: true,
    user: true,
    note: 'userは自分の担当企業・スタッフのみ。',
  },
  {
    category: 'スタッフ・マップ図',
    title: 'スタッフ検索・詳細',
    admin: true,
    manager: true,
    user: true,
    note: 'userは自分の担当者分のみ。',
  },
  {
    category: 'スタッフ・マップ図',
    title: 'スタッフ取込・反映・配置変更・出力',
    admin: true,
    manager: true,
    user: true,
    note: 'userに操作させない場合は後でrolesから外す。',
  },
  {
    category: 'マスタ管理',
    title: '支店マスタ',
    admin: true,
    manager: false,
    user: false,
    note: 'adminのみ。',
  },
  {
    category: 'マスタ管理',
    title: '担当者マスタ',
    admin: true,
    manager: true,
    user: false,
    note: 'managerは自支店のみ。',
  },
  {
    category: 'マスタ管理',
    title: '企業マスタ',
    admin: true,
    manager: true,
    user: false,
    note: 'managerは自支店のみ。',
  },
  {
    category: '管理者設定',
    title: 'ユーザー管理',
    admin: true,
    manager: false,
    user: false,
    note: 'adminのみ。',
  },
]

const cleanupItems = [
  {
    path: '/admin/staff/exit',
    status: '削除または非表示推奨',
    reason: '終了処理は /admin/staff/sync に統合済みです。',
  },
  {
    path: '/admin/data-quality',
    status: '不要なら削除',
    reason: '重複防止を使わない方針なら運用から外してOKです。',
  },
  {
    path: 'company_monthly_headcounts',
    status: '任意',
    reason: '企業別PLANを使わないマップ図に変更したため、今後使わなければ不要です。',
  },
]

const operationChecks = [
  'adminで全支店が見える',
  'managerで自支店のみ見える',
  'userで自分の担当者分のみ見える',
  'スタッフ名クリックで詳細ページへ遷移できる',
  'スタッフ反映で入職確定者を就業中に追加できる',
  'スタッフ反映で退職確定者を退職予定にできる',
  'スタッフ反映で退職予定者を終了処理できる',
  '配置変更で異動履歴が保存される',
  'マップ図に配置変更後の企業が反映される',
  'Excel出力ができる',
  'スマホでメニューが開閉できる',
  'Supabaseのservice_role keyをフロントに置いていない',
]

export default function SystemCheckPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [message, setMessage] = useState('')
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchCurrentRole()
  }, [])

  async function fetchCurrentRole() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setMessage(`ログイン情報の取得に失敗しました：${authError.message}`)
      return
    }

    if (!user) {
      setMessage('ログインユーザーが確認できません。')
      return
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        name,
        email,
        role,
        branch_id,
        sales_user_id,
        branches (
          branch_name
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      setMessage(`権限情報の取得に失敗しました：${error.message}`)
      return
    }

    setCurrentRole((data as unknown as CurrentUserRole | null) ?? null)
  }

  const groupedPermissionChecks = useMemo(() => {
    return permissionChecks.reduce<Record<string, CheckItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = []
      acc[item.category].push(item)
      return acc
    }, {})
  }, [])

  const progress = useMemo(() => {
    const total = operationChecks.length
    const checked = operationChecks.filter((item) => checkedItems[item]).length
    return {
      total,
      checked,
      percent: total === 0 ? 0 : Math.round((checked / total) * 100),
    }
  }, [checkedItems])

  function toggleCheck(item: string) {
    setCheckedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }))
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">
            Final Operation Check
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            最終運用チェック
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            実運用前に、権限別表示・不要ページ・RLS・主要機能の動作を確認します。
          </p>
        </section>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="ログイン権限" value={currentRole?.role ?? '-'} />
          <SummaryCard label="所属支店" value={currentRole?.branches?.branch_name ?? '-'} />
          <SummaryCard label="チェック進捗" value={`${progress.checked}/${progress.total}`} />
          <SummaryCard label="進捗率" value={`${progress.percent}%`} />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              権限別表示確認
            </h2>
            <p className="text-sm text-slate-500">
              各ロールで表示すべき画面を確認します。
            </p>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedPermissionChecks).map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-2 text-sm font-black text-slate-700">
                  {category}
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b bg-slate-100 text-left">
                        <th className="px-3 py-2">機能</th>
                        <th className="px-3 py-2 text-center">admin</th>
                        <th className="px-3 py-2 text-center">manager</th>
                        <th className="px-3 py-2 text-center">user</th>
                        <th className="px-3 py-2">確認メモ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={`${category}-${item.title}`} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-900">
                            {item.title}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Mark ok={item.admin} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Mark ok={item.manager} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Mark ok={item.user} />
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {item.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              動作確認チェックリスト
            </h2>
            <p className="text-sm text-slate-500">
              ブラウザ上で確認しながらチェックできます。
            </p>
          </div>

          <div className="space-y-2">
            {operationChecks.map((item) => (
              <label
                key={item}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                <input
                  type="checkbox"
                  checked={!!checkedItems[item]}
                  onChange={() => toggleCheck(item)}
                  className="h-4 w-4"
                />
                {item}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              不要ページ・重複機能の整理
            </h2>
            <p className="text-sm text-slate-500">
              運用に不要なページはサイドバーから外すか、ファイル削除を検討します。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-3 py-2">対象</th>
                  <th className="px-3 py-2">対応</th>
                  <th className="px-3 py-2">理由</th>
                </tr>
              </thead>
              <tbody>
                {cleanupItems.map((item) => (
                  <tr key={item.path} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-900">
                      {item.path}
                    </td>
                    <td className="px-3 py-2">
                      {item.status}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {item.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              本番前に確認するSQL
            </h2>
            <p className="text-sm text-slate-500">
              ZIP内のSQLをSupabase SQL Editorで確認し、必要に応じて本番用RLSへ切り替えます。
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <p className="font-bold">
              開発中にRLSを無効化したテーブルがあります。
            </p>
            <p className="mt-1">
              本番前は <code>sql/final-production-rls-template.sql</code> を確認し、テスト環境で権限制御を検証してください。
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Link
            href="/admin"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            管理トップへ
          </Link>

          <Link
            href="/admin/map"
            className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-100"
          >
            マップ図確認へ
          </Link>

          <Link
            href="/admin/staff/sync"
            className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-sm hover:bg-rose-100"
          >
            スタッフ反映確認へ
          </Link>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-slate-900">
        {value}
      </p>
    </div>
  )
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <span
      className={[
        'inline-flex rounded-full px-2 py-0.5 text-xs font-black',
        ok ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400',
      ].join(' ')}
    >
      {ok ? '表示' : '非表示'}
    </span>
  )
}
