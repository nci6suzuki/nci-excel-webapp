'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    label: '入力',
    description: '入職・退職・日次実績を登録',
    href: '/admin/monthly-headcount',
  },
  {
    label: '集計',
    description: '陣立て表・個人別実績',
    href: '/admin/monthly-headcount/report',
  },
  {
    label: '一覧・編集',
    description: '登録済みデータの確認・修正',
    href: '/admin/monthly-headcount/list',
  },
  {
    label: '支店別',
    description: '全支店の着地見込みを確認',
    href: '/admin/monthly-headcount/dashboard',
  },
]

export default function MonthlyHeadcountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/90 px-4 py-5 shadow-sm lg:block">
          <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-md">
            <p className="text-xs font-semibold opacity-80">
              NCI Management
            </p>
            <h1 className="mt-1 text-xl font-bold">
              月次人員管理
            </h1>
            <p className="mt-2 text-xs leading-relaxed opacity-90">
              入職・退職・実績を一元管理し、陣立て表と個人別実績へ自動反映します。
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive =
                item.href === '/admin/monthly-headcount'
                  ? pathname === item.href
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'block rounded-xl border px-4 py-3 transition',
                    isActive
                      ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="text-sm font-bold">
                    {item.label}
                  </div>
                  <div
                    className={[
                      'mt-1 text-xs',
                      isActive ? 'text-blue-600' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {item.description}
                  </div>
                </Link>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
            <div className="mb-3">
              <p className="text-xs font-semibold text-blue-600">
                NCI Management
              </p>
              <h1 className="text-lg font-bold text-slate-900">
                月次人員管理
              </h1>
            </div>

            <nav className="grid grid-cols-4 gap-2">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/admin/monthly-headcount'
                    ? pathname === item.href
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'rounded-lg border px-2 py-2 text-center text-xs font-bold transition',
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </header>

          <header className="hidden border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur lg:block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600">
                  Monthly Headcount
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  月次人員管理システム
                </h2>
              </div>

              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                入力・集計・一覧・支店別ダッシュボード
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
