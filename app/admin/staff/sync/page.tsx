'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

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

type EntryPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  company_id: string | null
  entry_date: string | null
  certainty_rank: string | null
  status: string | null
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
  status: string | null
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

type CurrentStaff = {
  id: string
  branch_id: string
  company_id: string
  sales_user_id: string | null
  staff_name: string
  start_date: string | null
  employment_status: string | null
  planned_exit_date: string | null
  is_active: boolean | null
  source_entry_plan_id: string | null
  source_exit_plan_id: string | null
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

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').normalize('NFKC').trim()
}

function isConfirmedEntry(plan: EntryPlan) {
  const certainty = normalizeText(plan.certainty_rank)
  const status = normalizeText(plan.status)
  return certainty === '確定' || status === '確定' || status === '入職済み'
}

function isConfirmedExit(plan: ExitPlan) {
  const status = normalizeText(plan.status)
  return status === '確定' || status === '退職済み'
}

export default function StaffSyncPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [targetMonth, setTargetMonth] = useState(getCurrentMonth())

  const [entryPlans, setEntryPlans] = useState<EntryPlan[]>([])
  const [exitPlans, setExitPlans] = useState<ExitPlan[]>([])
  const [currentStaff, setCurrentStaff] = useState<CurrentStaff[]>([])

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!currentRole) return
    fetchData()
  }, [currentRole, selectedBranchId, targetMonth])

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

    const role = data as CurrentUserRole
    setCurrentRole(role)

    if (role.role !== 'admin' && role.branch_id) {
      setSelectedBranchId(role.branch_id)
    }

    setLoading(false)
  }

  async function fetchData() {
    if (!currentRole) return

    setLoading(true)
    setMessage('')

    const { start, end } = getMonthRange(targetMonth)

    let branchQuery = supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    let entryQuery = supabase
      .from('entry_plans')
      .select(`
        id,
        worker_name,
        branch_id,
        sales_user_id,
        company_id,
        entry_date,
        certainty_rank,
        status,
        companies(company_name),
        sales_users(name),
        branches(branch_name)
      `)
      .gte('entry_date', start)
      .lt('entry_date', end)

    let exitQuery = supabase
      .from('exit_plans')
      .select(`
        id,
        worker_name,
        branch_id,
        sales_user_id,
        company_id,
        exit_date,
        status,
        companies(company_name),
        sales_users(name),
        branches(branch_name)
      `)
      .gte('exit_date', start)
      .lt('exit_date', end)

    let staffQuery = supabase
      .from('current_staff_assignments')
      .select(`
        id,
        branch_id,
        company_id,
        sales_user_id,
        staff_name,
        start_date,
        employment_status,
        planned_exit_date,
        is_active,
        source_entry_plan_id,
        source_exit_plan_id
      `)

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      branchQuery = branchQuery.eq('id', currentRole.branch_id)
      entryQuery = entryQuery.eq('branch_id', currentRole.branch_id)
      exitQuery = exitQuery.eq('branch_id', currentRole.branch_id)
      staffQuery = staffQuery.eq('branch_id', currentRole.branch_id)
    }

    if (selectedBranchId) {
      entryQuery = entryQuery.eq('branch_id', selectedBranchId)
      exitQuery = exitQuery.eq('branch_id', selectedBranchId)
      staffQuery = staffQuery.eq('branch_id', selectedBranchId)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      entryQuery = entryQuery.eq('sales_user_id', currentRole.sales_user_id)
      exitQuery = exitQuery.eq('sales_user_id', currentRole.sales_user_id)
      staffQuery = staffQuery.eq('sales_user_id', currentRole.sales_user_id)
    }

    const [branchResult, entryResult, exitResult, staffResult] = await Promise.all([
      branchQuery,
      entryQuery,
      exitQuery,
      staffQuery,
    ])

    const firstError =
      branchResult.error ||
      entryResult.error ||
      exitResult.error ||
      staffResult.error

    if (firstError) {
      setMessage(`データ取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    setBranches((branchResult.data ?? []) as Branch[])
    setEntryPlans((entryResult.data ?? []) as unknown as EntryPlan[])
    setExitPlans((exitResult.data ?? []) as unknown as ExitPlan[])
    setCurrentStaff((staffResult.data ?? []) as CurrentStaff[])

    setLoading(false)
  }

  const syncTargets = useMemo(() => {
    const confirmedEntries = entryPlans.filter((plan) => {
      return isConfirmedEntry(plan) && normalizeText(plan.status) !== '取消'
    })

    const entryTargets = confirmedEntries.filter((plan) => {
      if (!plan.worker_name || !plan.company_id || !plan.branch_id || !plan.entry_date) return false

      const alreadyBySource = currentStaff.some((staff) => staff.source_entry_plan_id === plan.id)
      const alreadyByName = currentStaff.some((staff) => {
        return (
          staff.company_id === plan.company_id &&
          normalizeText(staff.staff_name) === normalizeText(plan.worker_name) &&
          staff.is_active !== false
        )
      })

      return !alreadyBySource && !alreadyByName
    })

    const confirmedExits = exitPlans.filter((plan) => {
      return isConfirmedExit(plan) && normalizeText(plan.status) !== '取消'
    })

    const exitTargets = confirmedExits.filter((plan) => {
      if (!plan.worker_name || !plan.company_id || !plan.exit_date) return false

      return currentStaff.some((staff) => {
        return (
          staff.company_id === plan.company_id &&
          normalizeText(staff.staff_name) === normalizeText(plan.worker_name) &&
          staff.is_active !== false &&
          staff.employment_status !== '終了'
        )
      })
    })

    return {
      entryTargets,
      exitTargets,
    }
  }, [entryPlans, exitPlans, currentStaff])

  async function syncEntries() {
    if (syncTargets.entryTargets.length === 0) {
      setMessage('反映対象の入職確定者はありません。')
      return
    }

    setSyncing(true)
    setMessage('')

    const payloads = syncTargets.entryTargets.map((plan) => ({
      branch_id: plan.branch_id,
      company_id: plan.company_id,
      sales_user_id: plan.sales_user_id,
      staff_name: plan.worker_name,
      start_date: plan.entry_date,
      employment_status: '就業中',
      planned_exit_date: null,
      memo: '入職予定から自動反映',
      is_active: true,
      source_entry_plan_id: plan.id,
    }))

    const { error } = await supabase
      .from('current_staff_assignments')
      .insert(payloads)

    if (error) {
      setMessage(`入職反映に失敗しました：${error.message}`)
      setSyncing(false)
      return
    }

    setMessage(`${payloads.length}名を就業中スタッフへ反映しました。`)
    await fetchData()
    setSyncing(false)
  }

  async function syncExits() {
    if (syncTargets.exitTargets.length === 0) {
      setMessage('反映対象の退職確定者はありません。')
      return
    }

    setSyncing(true)
    setMessage('')

    let updatedCount = 0

    for (const plan of syncTargets.exitTargets) {
      const targetStaff = currentStaff.find((staff) => {
        return (
          staff.company_id === plan.company_id &&
          normalizeText(staff.staff_name) === normalizeText(plan.worker_name) &&
          staff.is_active !== false &&
          staff.employment_status !== '終了'
        )
      })

      if (!targetStaff) continue

      const { error } = await supabase
        .from('current_staff_assignments')
        .update({
          employment_status: '退職予定',
          planned_exit_date: plan.exit_date,
          source_exit_plan_id: plan.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetStaff.id)

      if (error) {
        setMessage(`退職反映に失敗しました：${error.message}`)
        setSyncing(false)
        return
      }

      updatedCount += 1
    }

    setMessage(`${updatedCount}名を退職予定として反映しました。`)
    await fetchData()
    setSyncing(false)
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">
            Staff Sync
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            入退職予定からスタッフ反映
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            入職確定者を就業中スタッフへ追加し、退職確定者を退職予定として反映します。
            マップ図のスタッフ表示を最新化するための確認画面です。
          </p>
        </section>

        {message && (
          <div className="whitespace-pre-wrap rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[220px_220px_1fr] md:items-end">
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
                支店
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                disabled={currentRole?.role !== 'admin'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">全支店</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? '読込中...' : '再読込'}
              </button>
              <button
                onClick={syncEntries}
                disabled={syncing || syncTargets.entryTargets.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                入職を反映
              </button>
              <button
                onClick={syncExits}
                disabled={syncing || syncTargets.exitTargets.length === 0}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                退職を反映
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="入職反映待ち" value={syncTargets.entryTargets.length} suffix="名" />
          <SummaryCard label="退職反映待ち" value={syncTargets.exitTargets.length} suffix="名" />
          <SummaryCard label="入職確定数" value={entryPlans.filter(isConfirmedEntry).length} suffix="名" />
          <SummaryCard label="就業中スタッフ登録" value={currentStaff.filter((staff) => staff.is_active !== false).length} suffix="名" />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <TargetList
            title="入職反映待ち"
            description="就業中スタッフにまだ登録されていない入職確定者です。"
            rows={syncTargets.entryTargets.map((plan) => ({
              id: plan.id,
              staffName: plan.worker_name ?? '-',
              branchName: plan.branches?.branch_name ?? '-',
              companyName: plan.companies?.company_name ?? '-',
              salesUserName: plan.sales_users?.name ?? '-',
              date: plan.entry_date ?? '-',
              status: plan.status ?? '-',
            }))}
          />

          <TargetList
            title="退職反映待ち"
            description="就業中スタッフに登録済みで、退職予定への反映が必要な退職確定者です。"
            rows={syncTargets.exitTargets.map((plan) => ({
              id: plan.id,
              staffName: plan.worker_name ?? '-',
              branchName: plan.branches?.branch_name ?? '-',
              companyName: plan.companies?.company_name ?? '-',
              salesUserName: plan.sales_users?.name ?? '-',
              date: plan.exit_date ?? '-',
              status: plan.status ?? '-',
            }))}
          />
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
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span>}
      </p>
    </div>
  )
}

function TargetList({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: {
    id: string
    staffName: string
    branchName: string
    companyName: string
    salesUserName: string
    date: string
    status: string
  }[]
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        <p className="text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-slate-100 text-left">
              <th className="px-3 py-2">支店</th>
              <th className="px-3 py-2">企業</th>
              <th className="px-3 py-2">スタッフ名</th>
              <th className="px-3 py-2">担当</th>
              <th className="px-3 py-2">日付</th>
              <th className="px-3 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2">{row.branchName}</td>
                <td className="px-3 py-2">{row.companyName}</td>
                <td className="px-3 py-2 font-bold text-slate-900">{row.staffName}</td>
                <td className="px-3 py-2">{row.salesUserName}</td>
                <td className="px-3 py-2">{row.date}</td>
                <td className="px-3 py-2">{row.status}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  反映待ちデータはありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
