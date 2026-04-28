'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Branch = {
  id: string
  branch_name: string
  display_order?: number | null
}

type SalesUser = {
  id: string
  name: string
  branch_id: string | null
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
  branch_id: string | null
  sales_user_id: string | null
  tour_date: string | null
  entry_date: string | null
  certainty_rank: string | null
  status: string | null
}

type ExitPlan = {
  id: string
  branch_id: string | null
  sales_user_id: string | null
  exit_date: string | null
  status: string | null
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
  const end = `${yyyy}-${mm}-01`

  return { start, end }
}

function getTargetMonthDate(month: string) {
  return `${month}-01`
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').normalize('NFKC').trim()
}

export default function BranchDashboardPage() {
  const [targetMonth, setTargetMonth] = useState(getCurrentMonth())
  const [branches, setBranches] = useState<Branch[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([])
  const [entryPlans, setEntryPlans] = useState<EntryPlan[]>([])
  const [exitPlans, setExitPlans] = useState<ExitPlan[]>([])
  const [dailyResults, setDailyResults] = useState<DailyResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [targetMonth])

  async function fetchDashboardData() {
    setLoading(true)
    setMessage('')

    const { start, end } = getMonthRange(targetMonth)
    const targetMonthDate = getTargetMonthDate(targetMonth)

    const [branchResult, userResult, monthlyPlanResult, entryResult, exitResult, dailyResult] = await Promise.all([
      supabase
        .from('branches')
        .select('id, branch_name, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('sales_users')
        .select('id, name, branch_id')
        .eq('is_active', true),
      supabase
        .from('monthly_plans')
        .select('id, branch_id, sales_user_id, target_month, headcount_plan, start_headcount')
        .eq('target_month', targetMonthDate),
      supabase
        .from('entry_plans')
        .select('id, branch_id, sales_user_id, tour_date, entry_date, certainty_rank, status')
        .or(
          `and(entry_date.gte.${start},entry_date.lt.${end}),and(tour_date.gte.${start},tour_date.lt.${end})`
        ),
      supabase
        .from('exit_plans')
        .select('id, branch_id, sales_user_id, exit_date, status')
        .gte('exit_date', start)
        .lt('exit_date', end),
      supabase
        .from('daily_results')
        .select('id, result_date, branch_id, sales_user_id, new_count, increase_count, exit_count, transaction_count, status')
        .gte('result_date', start)
        .lt('result_date', end),
    ])

    const errors = [
      branchResult.error,
      userResult.error,
      monthlyPlanResult.error,
      entryResult.error,
      exitResult.error,
      dailyResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      console.error(errors)
      setMessage(`ダッシュボードデータの取得に失敗しました：${errors[0]?.message}`)
      setLoading(false)
      return
    }

    setBranches((branchResult.data ?? []) as Branch[])
    setSalesUsers((userResult.data ?? []) as SalesUser[])
    setMonthlyPlans((monthlyPlanResult.data ?? []) as MonthlyPlan[])
    setEntryPlans((entryResult.data ?? []) as EntryPlan[])
    setExitPlans((exitResult.data ?? []) as ExitPlan[])
    setDailyResults((dailyResult.data ?? []) as DailyResult[])
    setLoading(false)
  }

  const branchRows = useMemo(() => {
    const isEntryConfirmed = (item: EntryPlan) => {
      const certainty = normalizeText(item.certainty_rank)
      const status = normalizeText(item.status)

      return certainty === '確定' || status === '確定' || status === '入職済み'
    }

    return branches.map((branch) => {
      const branchPlan = monthlyPlans.find(
        (plan) => plan.branch_id === branch.id && !plan.sales_user_id
      )

      const activeEntries = entryPlans.filter((item) => {
        return item.branch_id === branch.id && normalizeText(item.status) !== '取消'
      })

      const activeExits = exitPlans.filter((item) => {
        return item.branch_id === branch.id && normalizeText(item.status) !== '取消'
      })

      const activeDailyResults = dailyResults.filter((item) => {
        return item.branch_id === branch.id && normalizeText(item.status) !== '取消'
      })

      const entryConfirmed = activeEntries.filter(isEntryConfirmed).length
      const entryProspects = activeEntries.filter((item) => !isEntryConfirmed(item))
      const exitConfirmed = activeExits.filter((item) => {
        const status = normalizeText(item.status)
        return status === '確定' || status === '退職済み'
      }).length

      const aCount = entryProspects.filter((item) => normalizeText(item.certainty_rank).includes('A')).length
      const bCount = entryProspects.filter((item) => normalizeText(item.certainty_rank).includes('B')).length
      const cCount = entryProspects.filter((item) => normalizeText(item.certainty_rank).includes('C')).length

      const startHeadcount = branchPlan?.start_headcount ?? 0
      const headcountPlan = branchPlan?.headcount_plan ?? 0
      const confirmedLanding = startHeadcount + entryConfirmed - exitConfirmed
      const landingWithA = confirmedLanding + aCount
      const landingWithAB = confirmedLanding + aCount + bCount
      const landingWithABC = confirmedLanding + aCount + bCount + cCount
      const planDiff = landingWithAB - headcountPlan
      const achievementRate = headcountPlan > 0 ? Math.round((landingWithAB / headcountPlan) * 1000) / 10 : 0

      const newCount = activeDailyResults.reduce((sum, item) => sum + Number(item.new_count ?? 0), 0)
      const increaseCount = activeDailyResults.reduce((sum, item) => sum + Number(item.increase_count ?? 0), 0)
      const actualExitCount = activeDailyResults.reduce((sum, item) => sum + Number(item.exit_count ?? 0), 0)
      const transactionCount = activeDailyResults.reduce((sum, item) => sum + Number(item.transaction_count ?? 0), 0)
      const actualNetIncrease = newCount + increaseCount - actualExitCount

      const userCount = salesUsers.filter((user) => user.branch_id === branch.id).length

      return {
        branchId: branch.id,
        branchName: branch.branch_name,
        userCount,
        startHeadcount,
        headcountPlan,
        entryConfirmed,
        exitConfirmed,
        confirmedLanding,
        aCount,
        bCount,
        cCount,
        landingWithA,
        landingWithAB,
        landingWithABC,
        planDiff,
        achievementRate,
        newCount,
        increaseCount,
        actualExitCount,
        transactionCount,
        actualNetIncrease,
      }
    })
  }, [branches, monthlyPlans, entryPlans, exitPlans, dailyResults, salesUsers])

  const dashboardSummary = useMemo(() => {
    const total = branchRows.reduce(
      (acc, row) => {
        acc.headcountPlan += row.headcountPlan
        acc.startHeadcount += row.startHeadcount
        acc.entryConfirmed += row.entryConfirmed
        acc.exitConfirmed += row.exitConfirmed
        acc.confirmedLanding += row.confirmedLanding
        acc.aCount += row.aCount
        acc.bCount += row.bCount
        acc.cCount += row.cCount
        acc.landingWithAB += row.landingWithAB
        acc.landingWithABC += row.landingWithABC
        acc.newCount += row.newCount
        acc.increaseCount += row.increaseCount
        acc.actualExitCount += row.actualExitCount
        acc.transactionCount += row.transactionCount
        acc.actualNetIncrease += row.actualNetIncrease
        return acc
      },
      {
        headcountPlan: 0,
        startHeadcount: 0,
        entryConfirmed: 0,
        exitConfirmed: 0,
        confirmedLanding: 0,
        aCount: 0,
        bCount: 0,
        cCount: 0,
        landingWithAB: 0,
        landingWithABC: 0,
        newCount: 0,
        increaseCount: 0,
        actualExitCount: 0,
        transactionCount: 0,
        actualNetIncrease: 0,
      }
    )

    const planDiff = total.landingWithAB - total.headcountPlan
    const achievementRate = total.headcountPlan > 0 ? Math.round((total.landingWithAB / total.headcountPlan) * 1000) / 10 : 0

    return {
      ...total,
      planDiff,
      achievementRate,
    }
  }, [branchRows])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              支店別ダッシュボード
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              全支店の人員PLAN・月末着地見込み・営業実績を一覧で確認します。
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-[180px_120px]">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                対象月
              </label>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? '読込中...' : '更新'}
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              全支店サマリー
            </h2>
            <p className="text-sm text-gray-500">
              各支店のA+B込み着地を基準に、PLAN差と達成率を表示します。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
            <SummaryCard label="全体PLAN" value={dashboardSummary.headcountPlan} suffix="名" />
            <SummaryCard label="月初人数" value={dashboardSummary.startHeadcount} suffix="名" />
            <SummaryCard label="入職確定" value={dashboardSummary.entryConfirmed} suffix="名" />
            <SummaryCard label="退職確定" value={dashboardSummary.exitConfirmed} suffix="名" />
            <SummaryCard label="A+B着地" value={dashboardSummary.landingWithAB} suffix="名" />
            <SummaryCard label="PLAN差" value={dashboardSummary.planDiff} suffix="名" />
            <SummaryCard label="A見込み" value={dashboardSummary.aCount} suffix="名" />
            <SummaryCard label="B見込み" value={dashboardSummary.bCount} suffix="名" />
            <SummaryCard label="C見込み" value={dashboardSummary.cCount} suffix="名" />
            <SummaryCard label="達成率" value={dashboardSummary.achievementRate} suffix="%" />
            <SummaryCard label="取引件数" value={dashboardSummary.transactionCount} suffix="件" />
            <SummaryCard label="実績純増" value={dashboardSummary.actualNetIncrease} suffix="名" />
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              支店別一覧
            </h2>
            <p className="text-sm text-gray-500">
              支店ごとの月初人数・見込み・着地・営業実績を横並びで確認できます。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] table-fixed border-collapse text-sm tabular-nums">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[80px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-100 text-left">
                  <th className="px-3 py-2">支店</th>
                  <th className="px-3 py-2 text-right">担当者</th>
                  <th className="px-3 py-2 text-right">PLAN</th>
                  <th className="px-3 py-2 text-right">月初</th>
                  <th className="px-3 py-2 text-right">入職確定</th>
                  <th className="px-3 py-2 text-right">退職確定</th>
                  <th className="px-3 py-2 text-right">確定着地</th>
                  <th className="px-3 py-2 text-right">A</th>
                  <th className="px-3 py-2 text-right">B</th>
                  <th className="px-3 py-2 text-right">C</th>
                  <th className="px-3 py-2 text-right">A着地</th>
                  <th className="px-3 py-2 text-right">A+B着地</th>
                  <th className="px-3 py-2 text-right">ABC着地</th>
                  <th className="px-3 py-2 text-right">PLAN差</th>
                  <th className="px-3 py-2 text-right">達成率</th>
                  <th className="px-3 py-2 text-right">新規</th>
                  <th className="px-3 py-2 text-right">増員</th>
                  <th className="px-3 py-2 text-right">退社</th>
                  <th className="px-3 py-2 text-right">取引件数</th>
                  <th className="px-3 py-2 text-right">純増</th>
                </tr>
              </thead>
              <tbody>
                {branchRows.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="px-3 py-6 text-center text-gray-500">
                      支店データがありません。
                    </td>
                  </tr>
                ) : (
                  branchRows.map((row) => (
                    <tr key={row.branchId} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-gray-900">{row.branchName}</td>
                      <td className="px-3 py-2 text-right">{row.userCount}</td>
                      <td className="px-3 py-2 text-right">{row.headcountPlan}</td>
                      <td className="px-3 py-2 text-right">{row.startHeadcount}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{row.entryConfirmed}</td>
                      <td className="px-3 py-2 text-right text-red-700">{row.exitConfirmed}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.confirmedLanding}</td>
                      <td className="px-3 py-2 text-right text-green-700">{row.aCount}</td>
                      <td className="px-3 py-2 text-right text-yellow-700">{row.bCount}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{row.cCount}</td>
                      <td className="px-3 py-2 text-right">{row.landingWithA}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.landingWithAB}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.landingWithABC}</td>
                      <td
                        className={[
                          'px-3 py-2 text-right font-bold',
                          row.planDiff < 0 ? 'text-red-600' : 'text-blue-600',
                        ].join(' ')}
                      >
                        {row.planDiff > 0 ? '+' : ''}{row.planDiff}
                      </td>
                      <td className="px-3 py-2 text-right">{row.achievementRate}%</td>
                      <td className="px-3 py-2 text-right text-blue-700">{row.newCount}</td>
                      <td className="px-3 py-2 text-right text-green-700">{row.increaseCount}</td>
                      <td className="px-3 py-2 text-right text-red-700">{row.actualExitCount}</td>
                      <td className="px-3 py-2 text-right">{row.transactionCount}</td>
                      <td
                        className={[
                          'px-3 py-2 text-right font-bold',
                          row.actualNetIncrease < 0 ? 'text-red-600' : 'text-blue-600',
                        ].join(' ')}
                      >
                        {row.actualNetIncrease > 0 ? '+' : ''}{row.actualNetIncrease}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: number
  suffix?: string
}) {
  const isDiff = label.includes('差') || label.includes('純増')
  const isMinus = value < 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div
        className={[
          'mt-2 text-2xl font-bold tabular-nums',
          isDiff && isMinus ? 'text-red-600' : 'text-gray-900',
          isDiff && !isMinus ? 'text-blue-600' : '',
        ].join(' ')}
      >
        {isDiff && value > 0 ? '+' : ''}
        {value}
        <span className="ml-1 text-sm font-normal text-gray-500">{suffix}</span>
      </div>
    </div>
  )
}
