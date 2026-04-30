'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type CurrentUserRole = {
  user_id: string
  name: string | null
  email: string | null
  role: 'admin' | 'manager' | 'user'
  branch_id: string | null
  sales_user_id: string | null
  branches?: { branch_name: string } | null
}

type MonthlyPlan = { headcount_plan: number | null; start_headcount: number | null }
type EntryPlan = { certainty_rank: string | null; status: string | null }
type ExitPlan = { status: string | null }
type DailyResult = {
  new_count: number | null
  increase_count: number | null
  exit_count: number | null
  transaction_count: number | null
  status: string | null
}

function getCurrentMonth() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getMonthRange(month: string) {
  const start = `${month}-01`
  const startDate = new Date(`${month}-01T00:00:00`)
  const nextMonth = new Date(startDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const yyyy = nextMonth.getFullYear()
  const mm = String(nextMonth.getMonth() + 1).padStart(2, '0')
  return { start, end: `${yyyy}-${mm}-01` }
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').normalize('NFKC').trim()
}

const menuItems = [
  { title: '月次入力', description: '入職予定・退職予定・日次実績を登録します。', href: '/admin/monthly-headcount', accent: 'bg-blue-600', roles: ['admin', 'manager', 'user'] },
  { title: '支店別ダッシュボード', description: '全支店のPLAN差・着地見込み・実績を確認します。', href: '/admin/monthly-headcount/dashboard', accent: 'bg-indigo-600', roles: ['admin', 'manager'] },
  { title: '集計・実績', description: '陣立て表サマリー、個人別実績、稼働人員変動表を確認します。', href: '/admin/monthly-headcount/report', accent: 'bg-emerald-600', roles: ['admin', 'manager', 'user'] },
  { title: '一覧・編集', description: '入職・退職・日次実績の確認、編集、取消を行います。', href: '/admin/monthly-headcount/list', accent: 'bg-slate-700', roles: ['admin', 'manager', 'user'] },
  { title: 'ユーザー管理', description: 'ログインユーザーの権限、支店、担当者紐づけを管理します。', href: '/admin/users', accent: 'bg-rose-600', roles: ['admin'] },
]

export default function AdminTopPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([])
  const [entryPlans, setEntryPlans] = useState<EntryPlan[]>([])
  const [exitPlans, setExitPlans] = useState<ExitPlan[]>([])
  const [dailyResults, setDailyResults] = useState<DailyResult[]>([])
  const [message, setMessage] = useState('')
  const targetMonth = getCurrentMonth()

  useEffect(() => {
    initialize()
  }, [])

  async function initialize() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: roleData } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        name,
        email,
        role,
        branch_id,
        sales_user_id,
        branches ( branch_name )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const role = (roleData as CurrentUserRole | null) ?? null
    setCurrentRole(role)
    await fetchDashboardData(role)
  }

  async function fetchDashboardData(role: CurrentUserRole | null) {
    setMessage('')
    const { start, end } = getMonthRange(targetMonth)
    const targetMonthDate = `${targetMonth}-01`

    let monthlyPlanQuery = supabase
      .from('monthly_plans')
      .select('headcount_plan, start_headcount')
      .eq('target_month', targetMonthDate)
      .is('sales_user_id', null)

    let entryQuery = supabase
      .from('entry_plans')
      .select('certainty_rank, status')
      .or(`and(entry_date.gte.${start},entry_date.lt.${end}),and(tour_date.gte.${start},tour_date.lt.${end})`)

    let exitQuery = supabase
      .from('exit_plans')
      .select('status')
      .gte('exit_date', start)
      .lt('exit_date', end)

    let dailyQuery = supabase
      .from('daily_results')
      .select('new_count, increase_count, exit_count, transaction_count, status')
      .gte('result_date', start)
      .lt('result_date', end)

    if (role?.role !== 'admin' && role?.branch_id) {
      monthlyPlanQuery = monthlyPlanQuery.eq('branch_id', role.branch_id)
      entryQuery = entryQuery.eq('branch_id', role.branch_id)
      exitQuery = exitQuery.eq('branch_id', role.branch_id)
      dailyQuery = dailyQuery.eq('branch_id', role.branch_id)
    }

    if (role?.role === 'user' && role.sales_user_id) {
      entryQuery = entryQuery.eq('sales_user_id', role.sales_user_id)
      exitQuery = exitQuery.eq('sales_user_id', role.sales_user_id)
      dailyQuery = dailyQuery.eq('sales_user_id', role.sales_user_id)
    }

    const [monthlyPlanResult, entryResult, exitResult, dailyResult] = await Promise.all([
      monthlyPlanQuery,
      entryQuery,
      exitQuery,
      dailyQuery,
    ])

    if (monthlyPlanResult.error) {
      setMessage(`月次PLANの取得に失敗しました：${monthlyPlanResult.error.message}`)
      return
    }
    if (entryResult.error) {
      setMessage(`入職予定の取得に失敗しました：${entryResult.error.message}`)
      return
    }
    if (exitResult.error) {
      setMessage(`退職予定の取得に失敗しました：${exitResult.error.message}`)
      return
    }
    if (dailyResult.error) {
      setMessage(`日次実績の取得に失敗しました：${dailyResult.error.message}`)
      return
    }

    setMonthlyPlans((monthlyPlanResult.data ?? []) as MonthlyPlan[])
    setEntryPlans((entryResult.data ?? []) as EntryPlan[])
    setExitPlans((exitResult.data ?? []) as ExitPlan[])
    setDailyResults((dailyResult.data ?? []) as DailyResult[])
  }

  const overview = useMemo(() => {
    const activeEntries = entryPlans.filter((item) => normalizeText(item.status) !== '取消')
    const activeExits = exitPlans.filter((item) => normalizeText(item.status) !== '取消')
    const activeDailyResults = dailyResults.filter((item) => normalizeText(item.status) !== '取消')

    const isEntryConfirmed = (item: EntryPlan) => {
      const certainty = normalizeText(item.certainty_rank)
      const status = normalizeText(item.status)
      return certainty === '確定' || status === '確定' || status === '入職済み'
    }

    const entryConfirmed = activeEntries.filter(isEntryConfirmed).length
    const exitConfirmed = activeExits.filter((item) => {
      const status = normalizeText(item.status)
      return status === '確定' || status === '退職済み'
    }).length

    const prospects = activeEntries.filter((item) => !isEntryConfirmed(item))
    const aCount = prospects.filter((item) => normalizeText(item.certainty_rank).includes('A')).length
    const bCount = prospects.filter((item) => normalizeText(item.certainty_rank).includes('B')).length
    const cCount = prospects.filter((item) => normalizeText(item.certainty_rank).includes('C')).length

    const plan = monthlyPlans.reduce((sum, item) => sum + Number(item.headcount_plan ?? 0), 0)
    const start = monthlyPlans.reduce((sum, item) => sum + Number(item.start_headcount ?? 0), 0)
    const landingWithAB = start + entryConfirmed - exitConfirmed + aCount + bCount
    const planDiff = landingWithAB - plan

    const newCount = activeDailyResults.reduce((sum, item) => sum + Number(item.new_count ?? 0), 0)
    const increaseCount = activeDailyResults.reduce((sum, item) => sum + Number(item.increase_count ?? 0), 0)
    const actualExitCount = activeDailyResults.reduce((sum, item) => sum + Number(item.exit_count ?? 0), 0)
    const transactionCount = activeDailyResults.reduce((sum, item) => sum + Number(item.transaction_count ?? 0), 0)

    return { plan, entryConfirmed, exitConfirmed, aCount, bCount, cCount, landingWithAB, planDiff, newCount, increaseCount, actualExitCount, transactionCount }
  }, [monthlyPlans, entryPlans, exitPlans, dailyResults])

  const visibleMenuItems = useMemo(() => {
    const role = currentRole?.role ?? 'user'
    return menuItems.filter((item) => item.roles.includes(role))
  }, [currentRole])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-blue-200">Admin Console</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">管理者トップページ</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
                月次人員管理、支店別ダッシュボード、ユーザー管理など、運用に必要なメニューをここから確認できます。
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold text-blue-100">ログイン中</p>
              <p className="mt-1 text-lg font-bold">{currentRole?.name ?? '名称未設定'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{currentRole?.role ?? '-'}</span>
                {currentRole?.branches?.branch_name && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{currentRole.branches.branch_name}</span>
                )}
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{targetMonth}</span>
              </div>
            </div>
          </div>
        </section>

        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TopMetric label="人員PLAN" value={overview.plan} suffix="名" />
          <TopMetric label="A+B着地" value={overview.landingWithAB} suffix="名" />
          <TopMetric label="PLAN差" value={overview.planDiff} suffix="名" signed />
          <TopMetric label="取引件数" value={overview.transactionCount} suffix="件" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TopMetric label="入職確定" value={overview.entryConfirmed} suffix="名" />
          <TopMetric label="退職確定" value={overview.exitConfirmed} suffix="名" />
          <TopMetric label="A/B/C見込み" value={`${overview.aCount}/${overview.bCount}/${overview.cCount}`} />
          <TopMetric label="新規・増員・退社" value={`${overview.newCount}/${overview.increaseCount}/${overview.actualExitCount}`} />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">メニュー</h2>
            <p className="text-sm text-slate-500">利用できる機能だけを権限に応じて表示しています。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleMenuItems.map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                <div className={`mb-4 h-2 w-16 rounded-full ${item.accent}`} />
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                <div className="mt-4 text-sm font-bold text-blue-600">開く →</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">運用チェック</h2>
            <p className="text-sm text-slate-500">月次運用時に確認しておきたい項目です。</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ChecklistCard title="月初" text="人員PLANと月初人数を登録" />
            <ChecklistCard title="日次" text="入職・退職・日次実績を入力" />
            <ChecklistCard title="週次" text="A+B着地とPLAN差を確認" />
            <ChecklistCard title="月末" text="Excel出力して会議資料へ反映" />
          </div>
        </section>
      </div>
    </div>
  )
}

function TopMetric({ label, value, suffix, signed = false }: { label: string; value: number | string; suffix?: string; signed?: boolean }) {
  const numericValue = typeof value === 'number' ? value : null
  const isMinus = numericValue !== null && numericValue < 0
  const isPlus = numericValue !== null && numericValue > 0
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <div className={[
        'mt-2 text-3xl font-black tracking-tight',
        signed && isMinus ? 'text-red-600' : '',
        signed && isPlus ? 'text-blue-600' : '',
        !signed ? 'text-slate-900' : '',
      ].join(' ')}>
        {signed && isPlus ? '+' : ''}{value}
        {suffix && <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

function ChecklistCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  )
}
