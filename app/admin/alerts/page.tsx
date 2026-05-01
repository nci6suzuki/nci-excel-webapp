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

type Branch = {
  id: string
  branch_name: string
}

type SalesUser = {
  id: string
  name: string
  branch_id: string | null
  is_active: boolean | null
  branches?: {
    branch_name: string
  } | null
}

type MonthlyPlan = {
  id: string
  branch_id: string | null
  sales_user_id: string | null
  target_month: string
  headcount_plan: number | null
  start_headcount: number | null
}

type EntryPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  company_id: string | null
  tour_date: string | null
  selection_status: string | null
  entry_date: string | null
  certainty_rank: string | null
  status: string | null
  memo: string | null
  companies?: {
    company_name: string
  } | null
  sales_users?: {
    name: string
  } | null
  branches?: {
    branch_name: string
  } | null
}

type ExitPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  company_id: string | null
  exit_date: string | null
  exit_reason: string | null
  reemployment_status: string | null
  next_job: string | null
  status: string | null
  memo: string | null
  companies?: {
    company_name: string
  } | null
  sales_users?: {
    name: string
  } | null
  branches?: {
    branch_name: string
  } | null
}

type DailyResult = {
  id: string
  result_date: string
  branch_id: string | null
  sales_user_id: string | null
  status: string | null
}

function getCurrentDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getCurrentMonth() {
  const today = getCurrentDate()
  return today.slice(0, 7)
}

function getMonthRange(month: string) {
  const start = `${month}-01`
  const startDate = new Date(`${month}-01T00:00:00`)
  const nextMonth = new Date(startDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const yyyy = nextMonth.getFullYear()
  const mm = String(nextMonth.getMonth() + 1).padStart(2, '0')
  const end = `${yyyy}-${mm}-01`

  return { start, end }
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').normalize('NFKC').trim()
}

function isActiveStatus(status: string | null | undefined) {
  return normalizeText(status) !== '取消'
}

export default function AlertsPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [targetMonth, setTargetMonth] = useState(getCurrentMonth())
  const [baseDate, setBaseDate] = useState(getCurrentDate())

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
    fetchAlertData()
  }, [currentRole, targetMonth, baseDate])

  async function initialize() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

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

    if (!data) {
      setMessage('このユーザーの権限情報が登録されていません。')
      setLoading(false)
      return
    }

    setCurrentRole(data as CurrentUserRole)
    setLoading(false)
  }

  async function fetchAlertData() {
    if (!currentRole) return

    setLoading(true)
    setMessage('')

    const { start, end } = getMonthRange(targetMonth)
    const today = baseDate
    const entryLimitDate = addDays(today, 3)
    const exitLimitDate = addDays(today, 7)

    let branchQuery = supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    let salesUserQuery = supabase
      .from('sales_users')
      .select('id, name, branch_id, is_active, branches(branch_name)')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    let monthlyPlanQuery = supabase
      .from('monthly_plans')
      .select('id, branch_id, sales_user_id, target_month, headcount_plan, start_headcount')
      .eq('target_month', `${targetMonth}-01`)

    let entryQuery = supabase
      .from('entry_plans')
      .select(`
        id,
        worker_name,
        branch_id,
        sales_user_id,
        company_id,
        tour_date,
        selection_status,
        entry_date,
        certainty_rank,
        status,
        memo,
        companies(company_name),
        sales_users(name),
        branches(branch_name)
      `)
      .or(
        `and(entry_date.gte.${start},entry_date.lt.${end}),and(tour_date.gte.${start},tour_date.lt.${end})`
      )

    let exitQuery = supabase
      .from('exit_plans')
      .select(`
        id,
        worker_name,
        branch_id,
        sales_user_id,
        company_id,
        exit_date,
        exit_reason,
        reemployment_status,
        next_job,
        status,
        memo,
        companies(company_name),
        sales_users(name),
        branches(branch_name)
      `)
      .gte('exit_date', today)
      .lte('exit_date', exitLimitDate)

    let dailyResultQuery = supabase
      .from('daily_results')
      .select('id, result_date, branch_id, sales_user_id, status')
      .gte('result_date', start)
      .lt('result_date', end)

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      branchQuery = branchQuery.eq('id', currentRole.branch_id)
      salesUserQuery = salesUserQuery.eq('branch_id', currentRole.branch_id)
      monthlyPlanQuery = monthlyPlanQuery.eq('branch_id', currentRole.branch_id)
      entryQuery = entryQuery.eq('branch_id', currentRole.branch_id)
      exitQuery = exitQuery.eq('branch_id', currentRole.branch_id)
      dailyResultQuery = dailyResultQuery.eq('branch_id', currentRole.branch_id)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      salesUserQuery = salesUserQuery.eq('id', currentRole.sales_user_id)
      monthlyPlanQuery = monthlyPlanQuery.eq('sales_user_id', currentRole.sales_user_id)
      entryQuery = entryQuery.eq('sales_user_id', currentRole.sales_user_id)
      exitQuery = exitQuery.eq('sales_user_id', currentRole.sales_user_id)
      dailyResultQuery = dailyResultQuery.eq('sales_user_id', currentRole.sales_user_id)
    }

    const [
      branchResult,
      salesUserResult,
      monthlyPlanResult,
      entryResult,
      exitResult,
      dailyResult,
    ] = await Promise.all([
      branchQuery,
      salesUserQuery,
      monthlyPlanQuery,
      entryQuery,
      exitQuery,
      dailyResultQuery,
    ])

    const firstError =
      branchResult.error ||
      salesUserResult.error ||
      monthlyPlanResult.error ||
      entryResult.error ||
      exitResult.error ||
      dailyResult.error

    if (firstError) {
      setMessage(`アラートデータの取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    setBranches((branchResult.data ?? []) as Branch[])
    setSalesUsers((salesUserResult.data ?? []) as SalesUser[])
    setMonthlyPlans((monthlyPlanResult.data ?? []) as MonthlyPlan[])
    setEntryPlans((entryResult.data ?? []) as EntryPlan[])
    setExitPlans((exitResult.data ?? []) as ExitPlan[])
    setDailyResults((dailyResult.data ?? []) as DailyResult[])

    setLoading(false)
  }

  const alerts = useMemo(() => {
    const today = baseDate
    const entryLimitDate = addDays(today, 3)
    const exitLimitDate = addDays(today, 7)

    const activeEntries = entryPlans.filter((item) => isActiveStatus(item.status))
    const activeExits = exitPlans.filter((item) => isActiveStatus(item.status))
    const activeDailyResults = dailyResults.filter((item) => isActiveStatus(item.status))

    const unresolvedTours = activeEntries.filter((item) => {
      const tourDate = item.tour_date
      if (!tourDate) return false

      const selection = normalizeText(item.selection_status)
      const status = normalizeText(item.status)

      return (
        tourDate < today &&
        !['採用', '不採用', '辞退', '保留'].includes(selection) &&
        !['確定', '入職済み'].includes(status)
      )
    })

    const upcomingEntries = activeEntries.filter((item) => {
      const entryDate = item.entry_date
      if (!entryDate) return false

      return entryDate >= today && entryDate <= entryLimitDate
    })

    const upcomingExits = activeExits.filter((item) => {
      const exitDate = item.exit_date
      if (!exitDate) return false

      return exitDate >= today && exitDate <= exitLimitDate
    })

    const reemploymentUndecided = activeExits.filter((item) => {
      const reemployment = normalizeText(item.reemployment_status)
      return item.exit_date && item.exit_date >= today && (reemployment === '未定' || reemployment === '')
    })

    const branchPlansMissing = branches.filter((branch) => {
      return !monthlyPlans.some((plan) => {
        return plan.branch_id === branch.id && !plan.sales_user_id
      })
    })

    const salesUserPlansMissing = salesUsers.filter((user) => {
      return !monthlyPlans.some((plan) => {
        return plan.sales_user_id === user.id
      })
    })

    const dailyResultsMissing = salesUsers.filter((user) => {
      return !activeDailyResults.some((item) => {
        return item.sales_user_id === user.id && item.result_date === today
      })
    })

    return {
      unresolvedTours,
      upcomingEntries,
      upcomingExits,
      reemploymentUndecided,
      branchPlansMissing,
      salesUserPlansMissing,
      dailyResultsMissing,
    }
  }, [baseDate, branches, salesUsers, monthlyPlans, entryPlans, exitPlans, dailyResults])

  const totalAlertCount =
    alerts.unresolvedTours.length +
    alerts.upcomingEntries.length +
    alerts.upcomingExits.length +
    alerts.reemploymentUndecided.length +
    alerts.branchPlansMissing.length +
    alerts.salesUserPlansMissing.length +
    alerts.dailyResultsMissing.length

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              要対応アラート
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              見学後フォロー、入退職予定、PLAN未設定、日次実績未入力をまとめて確認します。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                対象月
              </label>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                基準日
              </label>
              <input
                type="date"
                value={baseDate}
                onChange={(e) => setBaseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AlertCard label="総アラート" value={totalAlertCount} tone={totalAlertCount > 0 ? 'danger' : 'normal'} />
          <AlertCard label="見学後未処理" value={alerts.unresolvedTours.length} tone={alerts.unresolvedTours.length > 0 ? 'danger' : 'normal'} />
          <AlertCard label="入職3日以内" value={alerts.upcomingEntries.length} />
          <AlertCard label="退職7日以内" value={alerts.upcomingExits.length} />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <AlertCard label="再稼働未定" value={alerts.reemploymentUndecided.length} tone={alerts.reemploymentUndecided.length > 0 ? 'danger' : 'normal'} />
          <AlertCard label="PLAN未設定" value={alerts.branchPlansMissing.length + alerts.salesUserPlansMissing.length} tone={(alerts.branchPlansMissing.length + alerts.salesUserPlansMissing.length) > 0 ? 'danger' : 'normal'} />
          <AlertCard label="日次実績未入力" value={alerts.dailyResultsMissing.length} tone={alerts.dailyResultsMissing.length > 0 ? 'danger' : 'normal'} />
        </section>

        <AlertSection
          title="見学後未処理"
          description="見学日を過ぎているが、採用・不採用・辞退・保留などの結果が未入力のデータです。"
          count={alerts.unresolvedTours.length}
        >
          <EntryAlertTable rows={alerts.unresolvedTours} />
        </AlertSection>

        <AlertSection
          title="入職3日以内"
          description="基準日から3日以内に入職予定日を迎えるデータです。"
          count={alerts.upcomingEntries.length}
        >
          <EntryAlertTable rows={alerts.upcomingEntries} />
        </AlertSection>

        <AlertSection
          title="退職7日以内"
          description="基準日から7日以内に退職予定日を迎えるデータです。"
          count={alerts.upcomingExits.length}
        >
          <ExitAlertTable rows={alerts.upcomingExits} />
        </AlertSection>

        <AlertSection
          title="再稼働未定"
          description="退職予定があるが、再稼働が未定または未入力のデータです。"
          count={alerts.reemploymentUndecided.length}
        >
          <ExitAlertTable rows={alerts.reemploymentUndecided} />
        </AlertSection>

        <section className="grid gap-6 xl:grid-cols-2">
          <SimpleAlertList
            title="支店PLAN未設定"
            description="対象月の支店全体PLANが未登録の支店です。"
            items={alerts.branchPlansMissing.map((branch) => branch.branch_name)}
            emptyText="支店PLAN未設定はありません。"
          />

          <SimpleAlertList
            title="担当者PLAN未設定"
            description="対象月の個人PLANが未登録の担当者です。"
            items={alerts.salesUserPlansMissing.map((user) => `${user.branches?.branch_name ?? '-'} / ${user.name}`)}
            emptyText="担当者PLAN未設定はありません。"
          />
        </section>

        <SimpleAlertList
          title="日次実績未入力"
          description="基準日に日次実績が登録されていない担当者です。"
          items={alerts.dailyResultsMissing.map((user) => `${user.branches?.branch_name ?? '-'} / ${user.name}`)}
          emptyText="日次実績未入力はありません。"
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            次の対応
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            見学後未処理・入職直前・退職直前のアラートは、一覧・編集ページから状態や備考を更新してください。
          </p>
          <div className="mt-4">
            <Link
              href="/admin/monthly-headcount/list"
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
            >
              一覧・編集ページへ
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertCard({
  label,
  value,
  tone = 'normal',
}: {
  label: string
  value: number
  tone?: 'normal' | 'danger'
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>
      <p className={['mt-2 text-3xl font-black', tone === 'danger' ? 'text-red-600' : 'text-slate-900'].join(' ')}>
        {value}
        <span className="ml-1 text-sm font-bold text-slate-500">件</span>
      </p>
    </div>
  )
}

function AlertSection({
  title,
  description,
  count,
  children,
}: {
  title: string
  description: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <span className={['rounded-full px-3 py-1 text-xs font-bold', count > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'].join(' ')}>
          {count}件
        </span>
      </div>

      {count === 0 ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          対応が必要なデータはありません。
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function EntryAlertTable({ rows }: { rows: EntryPlan[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-slate-100 text-left">
            <th className="px-3 py-2">支店</th>
            <th className="px-3 py-2">氏名</th>
            <th className="px-3 py-2">企業</th>
            <th className="px-3 py-2">担当</th>
            <th className="px-3 py-2">見学日</th>
            <th className="px-3 py-2">入職日</th>
            <th className="px-3 py-2">人選状況</th>
            <th className="px-3 py-2">確度</th>
            <th className="px-3 py-2">状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-slate-50">
              <td className="px-3 py-2">{row.branches?.branch_name ?? '-'}</td>
              <td className="px-3 py-2 font-bold text-slate-900">{row.worker_name ?? '-'}</td>
              <td className="px-3 py-2">{row.companies?.company_name ?? '-'}</td>
              <td className="px-3 py-2">{row.sales_users?.name ?? '-'}</td>
              <td className="px-3 py-2">{row.tour_date ?? '-'}</td>
              <td className="px-3 py-2">{row.entry_date ?? '-'}</td>
              <td className="px-3 py-2">{row.selection_status ?? '-'}</td>
              <td className="px-3 py-2">{row.certainty_rank ?? '-'}</td>
              <td className="px-3 py-2">{row.status ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExitAlertTable({ rows }: { rows: ExitPlan[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-slate-100 text-left">
            <th className="px-3 py-2">支店</th>
            <th className="px-3 py-2">氏名</th>
            <th className="px-3 py-2">企業</th>
            <th className="px-3 py-2">担当</th>
            <th className="px-3 py-2">退職日</th>
            <th className="px-3 py-2">再稼働</th>
            <th className="px-3 py-2">理由</th>
            <th className="px-3 py-2">状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-slate-50">
              <td className="px-3 py-2">{row.branches?.branch_name ?? '-'}</td>
              <td className="px-3 py-2 font-bold text-slate-900">{row.worker_name ?? '-'}</td>
              <td className="px-3 py-2">{row.companies?.company_name ?? '-'}</td>
              <td className="px-3 py-2">{row.sales_users?.name ?? '-'}</td>
              <td className="px-3 py-2">{row.exit_date ?? '-'}</td>
              <td className="px-3 py-2">{row.reemployment_status ?? '-'}</td>
              <td className="px-3 py-2">{row.exit_reason ?? '-'}</td>
              <td className="px-3 py-2">{row.status ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SimpleAlertList({
  title,
  description,
  items,
  emptyText,
}: {
  title: string
  description: string
  items: string[]
  emptyText: string
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <span className={['rounded-full px-3 py-1 text-xs font-bold', items.length > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'].join(' ')}>
          {items.length}件
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
