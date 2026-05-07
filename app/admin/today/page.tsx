'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

type CurrentUserRole = {
  user_id: string
  name: string | null
  role: 'admin' | 'manager' | 'user'
  branch_id: string | null
  sales_user_id: string | null
}

type Branch = { id: string; branch_name: string }
type SalesUser = { id: string; name: string; branch_id: string | null; branches?: { branch_name: string } | null }
type MonthlyPlan = { id: string; branch_id: string | null; sales_user_id: string | null; target_month: string }

type EntryPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  tour_date: string | null
  selection_status: string | null
  entry_date: string | null
  certainty_rank: string | null
  status: string | null
  companies?: { company_name: string } | null
  sales_users?: { name: string } | null
  branches?: { branch_name: string } | null
}

type ExitPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  exit_date: string | null
  reemployment_status: string | null
  status: string | null
  companies?: { company_name: string } | null
  sales_users?: { name: string } | null
  branches?: { branch_name: string } | null
}

type DailyResult = {
  id: string
  result_date: string
  branch_id: string | null
  sales_user_id: string | null
  new_count: number | null
  increase_count: number | null
  exit_count: number | null
  transaction_count: number | null
  status: string | null
}

function getToday() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').normalize('NFKC').trim()
}

function isActive(status: string | null | undefined) {
  return normalize(status) !== '取消'
}

export default function TodayCheckPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [targetDate, setTargetDate] = useState(getToday())
  const [targetMonth, setTargetMonth] = useState(getToday().slice(0, 7))
  const [branches, setBranches] = useState<Branch[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([])
  const [entryPlans, setEntryPlans] = useState<EntryPlan[]>([])
  const [exitPlans, setExitPlans] = useState<ExitPlan[]>([])
  const [dailyResults, setDailyResults] = useState<DailyResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!currentRole) return
    fetchTodayData()
  }, [currentRole, targetDate, targetMonth])

  async function initialize() {
    setLoading(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      setMessage(`ログイン情報の取得に失敗しました：${authError.message}`)
      setLoading(false)
      return
    }
    if (!user) {
      setMessage('ログインユーザーが確認できません。')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, name, role, branch_id, sales_user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      setMessage(`権限情報の取得に失敗しました：${error.message}`)
      setLoading(false)
      return
    }
    setCurrentRole(data as CurrentUserRole)
    setLoading(false)
  }

  async function fetchTodayData() {
    if (!currentRole) return
    setLoading(true)
    setMessage('')

    const { start, end } = getMonthRange(targetMonth)
    const entryLimitDate = addDays(targetDate, 3)
    const exitLimitDate = addDays(targetDate, 7)

    let branchQuery = supabase.from('branches').select('id, branch_name').eq('is_active', true).order('display_order', { ascending: true })
    let salesUserQuery = supabase.from('sales_users').select('id, name, branch_id, branches(branch_name)').eq('is_active', true).order('display_order', { ascending: true })
    let monthlyPlanQuery = supabase.from('monthly_plans').select('id, branch_id, sales_user_id, target_month').eq('target_month', `${targetMonth}-01`)
    let entryQuery = supabase.from('entry_plans').select(`id, worker_name, branch_id, sales_user_id, tour_date, selection_status, entry_date, certainty_rank, status, companies(company_name), sales_users(name), branches(branch_name)`).or(`and(entry_date.gte.${start},entry_date.lt.${end}),and(tour_date.gte.${start},tour_date.lt.${end})`)
    let exitQuery = supabase.from('exit_plans').select(`id, worker_name, branch_id, sales_user_id, exit_date, reemployment_status, status, companies(company_name), sales_users(name), branches(branch_name)`).gte('exit_date', targetDate).lte('exit_date', exitLimitDate)
    let dailyQuery = supabase.from('daily_results').select('id, result_date, branch_id, sales_user_id, new_count, increase_count, exit_count, transaction_count, status').gte('result_date', start).lt('result_date', end)

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      branchQuery = branchQuery.eq('id', currentRole.branch_id)
      salesUserQuery = salesUserQuery.eq('branch_id', currentRole.branch_id)
      monthlyPlanQuery = monthlyPlanQuery.eq('branch_id', currentRole.branch_id)
      entryQuery = entryQuery.eq('branch_id', currentRole.branch_id)
      exitQuery = exitQuery.eq('branch_id', currentRole.branch_id)
      dailyQuery = dailyQuery.eq('branch_id', currentRole.branch_id)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      salesUserQuery = salesUserQuery.eq('id', currentRole.sales_user_id)
      monthlyPlanQuery = monthlyPlanQuery.eq('sales_user_id', currentRole.sales_user_id)
      entryQuery = entryQuery.eq('sales_user_id', currentRole.sales_user_id)
      exitQuery = exitQuery.eq('sales_user_id', currentRole.sales_user_id)
      dailyQuery = dailyQuery.eq('sales_user_id', currentRole.sales_user_id)
    }

    const [branchResult, salesUserResult, monthlyPlanResult, entryResult, exitResult, dailyResult] = await Promise.all([
      branchQuery,
      salesUserQuery,
      monthlyPlanQuery,
      entryQuery,
      exitQuery,
      dailyQuery,
    ])

    const firstError = branchResult.error || salesUserResult.error || monthlyPlanResult.error || entryResult.error || exitResult.error || dailyResult.error
    if (firstError) {
      setMessage(`本日の確認データの取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

setBranches((branchResult.data ?? []) as Branch[])
setSalesUsers((salesUserResult.data ?? []) as unknown as SalesUser[])
setMonthlyPlans((monthlyPlanResult.data ?? []) as MonthlyPlan[])
setEntryPlans((entryResult.data ?? []) as unknown as EntryPlan[])
setExitPlans((exitResult.data ?? []) as unknown as ExitPlan[])
setDailyResults((dailyResult.data ?? []) as unknown as DailyResult[])
    setLoading(false)
  }

  const todaySummary = useMemo(() => {
    const activeEntries = entryPlans.filter((item) => isActive(item.status))
    const activeExits = exitPlans.filter((item) => isActive(item.status))
    const activeDailyResults = dailyResults.filter((item) => isActive(item.status))
    const entryLimitDate = addDays(targetDate, 3)

    const unresolvedTours = activeEntries.filter((item) => {
      if (!item.tour_date) return false
      const selection = normalize(item.selection_status)
      const status = normalize(item.status)
      return item.tour_date < targetDate && !['採用', '不採用', '辞退', '保留'].includes(selection) && !['確定', '入職済み'].includes(status)
    })

    const todayEntries = activeEntries.filter((item) => item.entry_date === targetDate)
    const upcomingEntries = activeEntries.filter((item) => item.entry_date && item.entry_date >= targetDate && item.entry_date <= entryLimitDate)
    const todayExits = activeExits.filter((item) => item.exit_date === targetDate)
    const reemploymentUndecided = activeExits.filter((item) => {
      const reemployment = normalize(item.reemployment_status)
      return item.exit_date && item.exit_date >= targetDate && (reemployment === '未定' || reemployment === '')
    })

    const branchPlansMissing = branches.filter((branch) => !monthlyPlans.some((plan) => plan.branch_id === branch.id && !plan.sales_user_id))
    const salesUserPlansMissing = salesUsers.filter((user) => !monthlyPlans.some((plan) => plan.sales_user_id === user.id))
    const todayDailyResults = activeDailyResults.filter((item) => item.result_date === targetDate)
    const dailyResultsMissing = salesUsers.filter((user) => !todayDailyResults.some((item) => item.sales_user_id === user.id))

    const todayNewCount = todayDailyResults.reduce((sum, item) => sum + Number(item.new_count ?? 0), 0)
    const todayIncreaseCount = todayDailyResults.reduce((sum, item) => sum + Number(item.increase_count ?? 0), 0)
    const todayExitCount = todayDailyResults.reduce((sum, item) => sum + Number(item.exit_count ?? 0), 0)
    const todayTransactionCount = todayDailyResults.reduce((sum, item) => sum + Number(item.transaction_count ?? 0), 0)

    const totalAlertCount = unresolvedTours.length + upcomingEntries.length + reemploymentUndecided.length + branchPlansMissing.length + salesUserPlansMissing.length + dailyResultsMissing.length

    return { unresolvedTours, todayEntries, upcomingEntries, todayExits, reemploymentUndecided, branchPlansMissing, salesUserPlansMissing, dailyResultsMissing, todayNewCount, todayIncreaseCount, todayExitCount, todayTransactionCount, totalAlertCount }
  }, [branches, salesUsers, monthlyPlans, entryPlans, exitPlans, dailyResults, targetDate])

  const todayMessage = todaySummary.totalAlertCount === 0
    ? '本日の要対応はありません。通常通り、日次実績の入力と入退職予定の確認を進めてください。'
    : `本日は ${todaySummary.totalAlertCount} 件の要対応があります。見学後未処理・入退職予定・日次実績未入力を優先して確認してください。`

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-blue-200">Today Check</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">本日の確認ダッシュボード</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">朝の確認用に、要対応アラート・本日の入退職予定・日次実績状況をまとめて表示します。</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold text-blue-100">確認メッセージ</p>
              <p className="mt-2 text-sm font-bold leading-6">{todayMessage}</p>
            </div>
          </div>
        </section>

        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px] md:items-end">
            <div>
              <h2 className="text-lg font-bold text-slate-900">確認条件</h2>
              <p className="text-sm text-slate-500">基準日を変更すると、本日扱いで確認する対象日が変わります。</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">対象月</label>
              <input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">基準日</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="総アラート" value={todaySummary.totalAlertCount} suffix="件" danger={todaySummary.totalAlertCount > 0} />
          <MetricCard label="本日入職予定" value={todaySummary.todayEntries.length} suffix="名" />
          <MetricCard label="本日退職予定" value={todaySummary.todayExits.length} suffix="名" />
          <MetricCard label="日次未入力" value={todaySummary.dailyResultsMissing.length} suffix="名" danger={todaySummary.dailyResultsMissing.length > 0} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="新規" value={todaySummary.todayNewCount} suffix="件" />
          <MetricCard label="増員" value={todaySummary.todayIncreaseCount} suffix="件" />
          <MetricCard label="退社" value={todaySummary.todayExitCount} suffix="件" />
          <MetricCard label="取引件数" value={todaySummary.todayTransactionCount} suffix="件" />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <TodayListCard title="本日の入職予定" count={todaySummary.todayEntries.length} emptyText="本日の入職予定はありません。"><EntryMiniTable rows={todaySummary.todayEntries} /></TodayListCard>
          <TodayListCard title="本日の退職予定" count={todaySummary.todayExits.length} emptyText="本日の退職予定はありません。"><ExitMiniTable rows={todaySummary.todayExits} /></TodayListCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <TodayListCard title="見学後未処理" count={todaySummary.unresolvedTours.length} emptyText="見学後未処理はありません。" danger><EntryMiniTable rows={todaySummary.unresolvedTours} /></TodayListCard>
          <TodayListCard title="退職7日以内・再稼働未定" count={todaySummary.reemploymentUndecided.length} emptyText="再稼働未定の退職予定はありません。" danger><ExitMiniTable rows={todaySummary.reemploymentUndecided} /></TodayListCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <SimpleListCard title="日次実績未入力" items={todaySummary.dailyResultsMissing.map((user) => `${user.branches?.branch_name ?? '-'} / ${user.name}`)} emptyText="日次実績未入力はありません。" />
          <SimpleListCard title="PLAN未設定" items={[...todaySummary.branchPlansMissing.map((branch) => `支店PLAN：${branch.branch_name}`), ...todaySummary.salesUserPlansMissing.map((user) => `担当者PLAN：${user.branches?.branch_name ?? '-'} / ${user.name}`)]} emptyText="PLAN未設定はありません。" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">次に行うこと</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Link href="/admin/monthly-headcount" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100">入力ページへ</Link>
            <Link href="/admin/monthly-headcount/list" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100">一覧・編集ページへ</Link>
            <Link href="/admin/alerts" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100">要対応アラートへ</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ label, value, suffix, danger = false }: { label: string; value: number; suffix?: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={['mt-2 text-3xl font-black', danger ? 'text-red-600' : 'text-slate-900'].join(' ')}>{value}{suffix && <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span>}</p>
    </div>
  )
}

function TodayListCard({ title, count, emptyText, danger = false, children }: { title: string; count: number; emptyText: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <span className={['rounded-full px-3 py-1 text-xs font-bold', danger && count > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'].join(' ')}>{count}件</span>
      </div>
      {count === 0 ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{emptyText}</div> : children}
    </section>
  )
}

function EntryMiniTable({ rows }: { rows: EntryPlan[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b bg-slate-100 text-left"><th className="px-3 py-2">支店</th><th className="px-3 py-2">氏名</th><th className="px-3 py-2">企業</th><th className="px-3 py-2">担当</th><th className="px-3 py-2">見学日</th><th className="px-3 py-2">入職日</th><th className="px-3 py-2">状態</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2">{row.branches?.branch_name ?? '-'}</td><td className="px-3 py-2 font-bold text-slate-900">{row.worker_name ?? '-'}</td><td className="px-3 py-2">{row.companies?.company_name ?? '-'}</td><td className="px-3 py-2">{row.sales_users?.name ?? '-'}</td><td className="px-3 py-2">{row.tour_date ?? '-'}</td><td className="px-3 py-2">{row.entry_date ?? '-'}</td><td className="px-3 py-2">{row.status ?? '-'}</td></tr>)}</tbody></table>
    </div>
  )
}

function ExitMiniTable({ rows }: { rows: ExitPlan[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b bg-slate-100 text-left"><th className="px-3 py-2">支店</th><th className="px-3 py-2">氏名</th><th className="px-3 py-2">企業</th><th className="px-3 py-2">担当</th><th className="px-3 py-2">退職日</th><th className="px-3 py-2">再稼働</th><th className="px-3 py-2">状態</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2">{row.branches?.branch_name ?? '-'}</td><td className="px-3 py-2 font-bold text-slate-900">{row.worker_name ?? '-'}</td><td className="px-3 py-2">{row.companies?.company_name ?? '-'}</td><td className="px-3 py-2">{row.sales_users?.name ?? '-'}</td><td className="px-3 py-2">{row.exit_date ?? '-'}</td><td className="px-3 py-2">{row.reemployment_status ?? '-'}</td><td className="px-3 py-2">{row.status ?? '-'}</td></tr>)}</tbody></table>
    </div>
  )
}

function SimpleListCard({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4"><h2 className="text-lg font-bold text-slate-900">{title}</h2><span className={['rounded-full px-3 py-1 text-xs font-bold', items.length > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'].join(' ')}>{items.length}件</span></div>
      {items.length === 0 ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{emptyText}</div> : <div className="grid gap-2 md:grid-cols-2">{items.map((item) => <div key={item} className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{item}</div>)}</div>}
    </section>
  )
}
