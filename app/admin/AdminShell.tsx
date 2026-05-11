'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

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

type NavItem = {
  label: string
  description: string
  href: string
  roles: Array<'admin' | 'manager' | 'user'>
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: '本日確認',
    items: [
      {
        label: '本日確認',
        description: '朝の確認ダッシュボード',
        href: '/admin/today',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: '要対応',
        description: '見学・入退職・実績アラート',
        href: '/admin/alerts',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: '管理トップ',
        description: '全体メニュー',
        href: '/admin',
        roles: ['admin', 'manager', 'user'],
      },
    ],
  },
  {
    title: '月次人員管理',
    items: [
      {
        label: '月次入力',
        description: '入職・退職・日次実績',
        href: '/admin/monthly-headcount',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: '支店別',
        description: '全支店ダッシュボード',
        href: '/admin/monthly-headcount/dashboard',
        roles: ['admin', 'manager'],
      },
      {
        label: '集計',
        description: '陣立て表・個人別実績',
        href: '/admin/monthly-headcount/report',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: '一覧・編集',
        description: '登録内容の確認・修正',
        href: '/admin/monthly-headcount/list',
        roles: ['admin', 'manager', 'user'],
      },
    ],
  },
  {
    title: 'スタッフ・マップ図',
    items: [
      {
        label: 'マップ図',
        description: '企業別スタッフ配置',
        href: '/admin/map',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: 'スタッフ検索',
        description: 'スタッフ一覧・詳細',
        href: '/admin/staff',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: '就業中スタッフ',
        description: '個別登録・編集',
        href: '/admin/staff/current',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: 'スタッフ取込',
        description: 'CSV一括取込',
        href: '/admin/staff/import',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: 'スタッフ反映',
        description: '入退職予定から反映',
        href: '/admin/staff/sync',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: '配置変更',
        description: '異動・配置履歴',
        href: '/admin/staff/transfer',
        roles: ['admin', 'manager', 'user'],
      },
      {
        label: 'スタッフ出力',
        description: '配置表Excel出力',
        href: '/admin/staff/export',
        roles: ['admin', 'manager', 'user'],
      },
    ],
  },
  {
    title: 'マスタ管理',
    items: [
      {
        label: '支店マスタ',
        description: '支店の登録・編集',
        href: '/admin/masters/branches',
        roles: ['admin'],
      },
      {
        label: '担当者マスタ',
        description: '営業担当者の登録・編集',
        href: '/admin/masters/sales-users',
        roles: ['admin', 'manager'],
      },
      {
        label: '企業マスタ',
        description: '派遣先企業の登録・編集',
        href: '/admin/masters/companies',
        roles: ['admin', 'manager'],
      },
      {
        label: 'マスタ取込',
        description: '支店・担当者・企業CSV取込',
        href: '/admin/masters/import',
        roles: ['admin', 'manager'],
      },
    ],
  },
  {
    title: '管理者設定',
    items: [
      {
        label: 'ユーザー管理',
        description: '権限・支店・担当者設定',
        href: '/admin/users',
        roles: ['admin'],
      },
      {
        label: '運用チェック',
        description: '権限・RLS・不要機能確認',
        href: '/admin/system-check',
        roles: ['admin'],
      },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetchCurrentRole()
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  async function fetchCurrentRole() {
    setLoadingRole(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoadingRole(false)
      return
    }

    const { data } = await supabase
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

    setCurrentRole((data as unknown as CurrentUserRole | null) ?? null)
    setLoadingRole(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const visibleNavGroups = useMemo(() => {
    const role = currentRole?.role ?? 'user'

    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.roles.includes(role)),
      }))
      .filter((group) => group.items.length > 0)
  }, [currentRole])

  const currentPageTitle = useMemo(() => {
    for (const group of visibleNavGroups) {
      const item = group.items.find((nav) => isActivePath(pathname, nav.href))
      if (item) return item.label
    }

    return 'NCI 管理メニュー'
  }, [pathname, visibleNavGroups])

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/95 px-4 py-5 shadow-sm lg:block">
          <Link
            href="/admin"
            className="mb-5 block rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-md"
          >
            <p className="text-xs font-semibold opacity-80">
              NCI Management
            </p>
            <h1 className="mt-1 text-xl font-bold">
              管理システム
            </h1>
            <p className="mt-2 text-xs leading-relaxed opacity-90">
              月次人員管理・スタッフ配置・マスタをまとめて管理します。
            </p>
          </Link>

          <nav className="max-h-[calc(100vh-310px)] space-y-5 overflow-y-auto pr-1">
            {visibleNavGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {group.title}
                </p>

                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const active = isActivePath(pathname, item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          'block rounded-xl border px-3 py-2.5 transition',
                          active
                            ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        <div className="text-sm font-bold">
                          {item.label}
                        </div>
                        <div
                          className={[
                            'mt-0.5 text-xs',
                            active ? 'text-blue-600' : 'text-slate-500',
                          ].join(' ')}
                        >
                          {item.description}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">
              ログイン中
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {loadingRole ? '確認中...' : currentRole?.name ?? '名称未設定'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                {currentRole?.role ?? '-'}
              </span>
              {currentRole?.branches?.branch_name && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                  {currentRole.branches.branch_name}
                </span>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              ログアウト
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-600">
                  NCI Management
                </p>
                <h1 className="text-lg font-bold text-slate-900">
                  {currentPageTitle}
                </h1>
              </div>

              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
              >
                {mobileMenuOpen ? '閉じる' : 'メニュー'}
              </button>
            </div>

            {mobileMenuOpen && (
              <nav className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {visibleNavGroups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 px-1 text-[11px] font-black text-slate-400">
                      {group.title}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const active = isActivePath(pathname, item.href)

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={[
                              'rounded-lg border px-2 py-2 text-center text-xs font-bold transition',
                              active
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600',
                            ].join(' ')}
                          >
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleLogout}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                >
                  ログアウト
                </button>
              </nav>
            )}
          </header>

          <header className="hidden border-b border-slate-200 bg-white/85 px-8 py-4 backdrop-blur lg:block">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-blue-600">
                  Admin Console
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  {currentPageTitle}
                </h2>
              </div>

              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                {currentRole?.role === 'admin'
                  ? '全支店管理者'
                  : currentRole?.role === 'manager'
                    ? '支店管理者'
                    : '営業担当者'}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
