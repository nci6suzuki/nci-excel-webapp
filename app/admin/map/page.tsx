'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import Link from 'next/link'

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

type Company = {
  id: string
  company_name: string
  branch_id: string | null
  sales_user_id: string | null
  is_active: boolean | null
  branches?: {
    branch_name: string
  } | null
  sales_users?: {
    name: string
  } | null
}

type CompanyMonthlyHeadcount = {
  id: string
  branch_id: string
  company_id: string
  target_month: string
  start_headcount: number | null
  headcount_plan: number | null
  memo: string | null
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
}

type ExitPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  company_id: string | null
  exit_date: string | null
  status: string | null
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
  memo: string | null
  is_active: boolean | null
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

function isActive(status: string | null | undefined) {
  return normalizeText(status) !== '取消'
}

function isEntryConfirmed(item: EntryPlan) {
  const certainty = normalizeText(item.certainty_rank)
  const status = normalizeText(item.status)

  return certainty === '確定' || status === '確定' || status === '入職済み'
}

function isExitConfirmed(item: ExitPlan) {
  const status = normalizeText(item.status)
  return status === '確定' || status === '退職済み'
}

export default function WorkforceMapPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)

  const [targetMonth, setTargetMonth] = useState(getCurrentMonth())
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedSalesUserId, setSelectedSalesUserId] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')

  const [branches, setBranches] = useState<Branch[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyHeadcounts, setCompanyHeadcounts] = useState<CompanyMonthlyHeadcount[]>([])
  const [entryPlans, setEntryPlans] = useState<EntryPlan[]>([])
  const [exitPlans, setExitPlans] = useState<ExitPlan[]>([])

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    start_headcount: '0',
    headcount_plan: '0',
    memo: '',
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [currentStaffList, setCurrentStaffList] = useState<CurrentStaff[]>([])

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!currentRole) return
    fetchMapData()
  }, [currentRole, targetMonth, selectedBranchId, selectedSalesUserId])

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

    if (role.role === 'user' && role.sales_user_id) {
      setSelectedSalesUserId(role.sales_user_id)
    }

    setLoading(false)
  }

  async function fetchMapData() {
    if (!currentRole) return

    setLoading(true)
    setMessage('')

    const { start, end } = getMonthRange(targetMonth)
    const targetMonthDate = `${targetMonth}-01`

    let branchQuery = supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    let companyQuery = supabase
      .from('companies')
      .select(`
        id,
        company_name,
        branch_id,
        sales_user_id,
        is_active,
        branches(branch_name),
        sales_users(name)
      `)
      .eq('is_active', true)
      .order('company_name', { ascending: true })

    let headcountQuery = supabase
      .from('company_monthly_headcounts')
      .select('id, branch_id, company_id, target_month, start_headcount, headcount_plan, memo')
      .eq('target_month', targetMonthDate)

    let entryQuery = supabase
      .from('entry_plans')
      .select('id, worker_name, branch_id, sales_user_id, company_id, tour_date, selection_status, entry_date, certainty_rank, status')
      .or(`and(entry_date.gte.${start},entry_date.lt.${end}),and(tour_date.gte.${start},tour_date.lt.${end})`)

    let exitQuery = supabase
      .from('exit_plans')
      .select('id, worker_name, branch_id, sales_user_id, company_id, exit_date, status')
      .gte('exit_date', start)
      .lt('exit_date', end)

    let currentStaffQuery = supabase
      .from('current_staff_assignments')
      .select('id, branch_id, company_id, sales_user_id, staff_name, start_date, employment_status, planned_exit_date, memo, is_active')
      .eq('is_active', true)
      .in('employment_status', ['就業中', '休職中', '退職予定'])

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      branchQuery = branchQuery.eq('id', currentRole.branch_id)
      companyQuery = companyQuery.eq('branch_id', currentRole.branch_id)
      headcountQuery = headcountQuery.eq('branch_id', currentRole.branch_id)
      entryQuery = entryQuery.eq('branch_id', currentRole.branch_id)
      exitQuery = exitQuery.eq('branch_id', currentRole.branch_id)
    }

    if (selectedBranchId) {
      companyQuery = companyQuery.eq('branch_id', selectedBranchId)
      headcountQuery = headcountQuery.eq('branch_id', selectedBranchId)
      entryQuery = entryQuery.eq('branch_id', selectedBranchId)
      exitQuery = exitQuery.eq('branch_id', selectedBranchId)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      companyQuery = companyQuery.eq('sales_user_id', currentRole.sales_user_id)
      entryQuery = entryQuery.eq('sales_user_id', currentRole.sales_user_id)
      exitQuery = exitQuery.eq('sales_user_id', currentRole.sales_user_id)
    } else if (selectedSalesUserId) {
      companyQuery = companyQuery.eq('sales_user_id', selectedSalesUserId)
      entryQuery = entryQuery.eq('sales_user_id', selectedSalesUserId)
      exitQuery = exitQuery.eq('sales_user_id', selectedSalesUserId)
    }

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      currentStaffQuery = currentStaffQuery.eq('branch_id', currentRole.branch_id)
    }
    
    if (selectedBranchId) {
      currentStaffQuery = currentStaffQuery.eq('branch_id', selectedBranchId)
    }
    
    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      currentStaffQuery = currentStaffQuery.eq('sales_user_id', currentRole.sales_user_id)
    } else if (selectedSalesUserId) {
      currentStaffQuery = currentStaffQuery.eq('sales_user_id', selectedSalesUserId)
    }

    const [
      branchResult,
      companyResult,
      headcountResult,
      entryResult,
      exitResult,
      currentStaffResult
    ] = await Promise.all([
      branchQuery,
      companyQuery,
      headcountQuery,
      entryQuery,
      exitQuery,
      currentStaffQuery
    ])

    const firstError =
      branchResult.error ||
      companyResult.error ||
      headcountResult.error ||
      entryResult.error ||
      exitResult.error ||
      currentStaffResult.error

    if (firstError) {
      setMessage(`マップ図データの取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    setBranches((branchResult.data ?? []) as Branch[])
    setCompanies((companyResult.data ?? []) as unknown as Company[])
    setCompanyHeadcounts((headcountResult.data ?? []) as CompanyMonthlyHeadcount[])
    setEntryPlans((entryResult.data ?? []) as EntryPlan[])
    setExitPlans((exitResult.data ?? []) as ExitPlan[])
    setCurrentStaffList((currentStaffResult.data ?? []) as CurrentStaff[])

    setLoading(false)
  }

  function startEditCompany(companyId: string) {
    const existing = companyHeadcounts.find((item) => item.company_id === companyId)

    setEditingCompanyId(companyId)
    setForm({
      start_headcount: String(existing?.start_headcount ?? 0),
      headcount_plan: String(existing?.headcount_plan ?? 0),
      memo: existing?.memo ?? '',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function cancelEdit() {
    setEditingCompanyId(null)
    setForm({
      start_headcount: '0',
      headcount_plan: '0',
      memo: '',
    })
  }

  async function saveCompanyHeadcount() {
    if (!editingCompanyId) return

    const company = companies.find((item) => item.id === editingCompanyId)

    if (!company || !company.branch_id) {
      setMessage('企業または支店情報が確認できません。')
      return
    }

    setSaving(true)
    setMessage('')

    const targetMonthDate = `${targetMonth}-01`

    const payload = {
      branch_id: company.branch_id,
      company_id: company.id,
      target_month: targetMonthDate,
      start_headcount: Number(form.start_headcount || 0),
      headcount_plan: Number(form.headcount_plan || 0),
      memo: form.memo || null,
    }

    const { error } = await supabase
      .from('company_monthly_headcounts')
      .upsert(payload, {
        onConflict: 'branch_id,company_id,target_month',
      })

    if (error) {
      setMessage(`企業別人数の保存に失敗しました：${error.message}`)
      setSaving(false)
      return
    }

    setMessage('企業別人数を保存しました。')
    cancelEdit()
    await fetchMapData()
    setSaving(false)
  }

const mapRows = useMemo(() => {
  return companies.map((company) => {
    const currentStaff = currentStaffList.filter((staff) => {
      return staff.company_id === company.id
    })

    return {
      company,
      currentStaff,
    }
  })
}, [companies, currentStaffList])

  const salesUsersForFilter = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    companies.forEach((company) => {
      if (company.sales_user_id && company.sales_users?.name) {
        map.set(company.sales_user_id, {
          id: company.sales_user_id,
          name: company.sales_users.name,
        })
      }
    })
    return Array.from(map.values())
  }, [companies])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">
            Workforce Map
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            マップ図
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            企業別に月初人数・PLAN・入職予定・退職予定・見込みをカード形式で表示します。
            Excelのマップ図に近い形で、どの企業で人員が増減するかを確認できます。
          </p>
        </section>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                担当者
              </label>
              <select
                value={selectedSalesUserId}
                onChange={(e) => setSelectedSalesUserId(e.target.value)}
                disabled={currentRole?.role === 'user'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">全員</option>
                {salesUsersForFilter.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                表示形式
              </label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'card' | 'table')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="card">カード表示</option>
                <option value="table">表形式</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchMapData}
                disabled={loading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? '読込中...' : '再読込'}
              </button>
            </div>
          </div>
        </section>

        {editingCompanyId && (
          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                企業別人数設定
              </h2>
              <p className="text-sm text-slate-600">
                {companies.find((item) => item.id === editingCompanyId)?.company_name ?? '-'} の月初人数・PLANを設定します。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  月初人数
                </label>
                <input
                  type="number"
                  value={form.start_headcount}
                  onChange={(e) => setForm({ ...form, start_headcount: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  企業別PLAN
                </label>
                <input
                  type="number"
                  value={form.headcount_plan}
                  onChange={(e) => setForm({ ...form, headcount_plan: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  メモ
                </label>
                <input
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveCompanyHeadcount}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>

              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </section>
        )}

        {viewMode === 'card' ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mapRows.map((row) => (
              <CompanyMapCard
                key={row.company.id}
                row={row}
                onEdit={() => startEditCompany(row.company.id)}
              />
            ))}

            {mapRows.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm md:col-span-2 xl:col-span-3">
                表示対象の企業がありません。
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b bg-slate-100 text-left">
                    <th className="px-3 py-2">支店</th>
                    <th className="px-3 py-2">企業</th>
                    <th className="px-3 py-2">担当</th>
                    <th className="px-3 py-2 text-right">PLAN</th>
                    <th className="px-3 py-2 text-right">月初</th>
                    <th className="px-3 py-2 text-right">入職確定</th>
                    <th className="px-3 py-2 text-right">退職確定</th>
                    <th className="px-3 py-2 text-right">確定着地</th>
                    <th className="px-3 py-2 text-right">A</th>
                    <th className="px-3 py-2 text-right">B</th>
                    <th className="px-3 py-2 text-right">C</th>
                    <th className="px-3 py-2 text-right">A+B着地</th>
                    <th className="px-3 py-2 text-right">PLAN差</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {mapRows.map((row) => (
                    <tr key={row.company.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2">{row.company.branches?.branch_name ?? '-'}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{row.company.company_name}</td>
                      <td className="px-3 py-2">{row.company.sales_users?.name ?? '-'}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => startEditCompany(row.company.id)}
                          className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"
                        >
                          人数設定
                        </button>
                      </td>
                    </tr>
                  ))}

                  {mapRows.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-3 py-6 text-center text-slate-500">
                        表示対象の企業がありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function MapMetric({
  label,
  value,
  suffix,
  signed = false,
}: {
  label: string
  value: number
  suffix?: string
  signed?: boolean
}) {
  const isMinus = value < 0
  const isPlus = value > 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>
      <p
        className={[
          'mt-2 text-3xl font-black tracking-tight',
          signed && isMinus ? 'text-red-600' : '',
          signed && isPlus ? 'text-blue-600' : '',
          !signed ? 'text-slate-900' : '',
        ].join(' ')}
      >
        {signed && isPlus ? '+' : ''}
        {value}
        {suffix && <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span>}
      </p>
    </div>
  )
}

function CompanyMapCard({
  row,
  onEdit,
}: {
  row: {
    company: Company
    currentStaff: CurrentStaff[]
  }
  onEdit: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">
            {row.company.branches?.branch_name ?? '支店未設定'}
          </p>

          <h2 className="mt-1 text-lg font-black text-slate-900">
            {row.company.company_name}
          </h2>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            担当：{row.company.sales_users?.name ?? '未設定'}
          </p>
        </div>

<Link
  href="/admin/staff/current"
  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
>
  スタッフ管理
</Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black text-slate-700">
            就業中スタッフ
          </p>

          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">
            {row.currentStaff.length}名
          </span>
        </div>

        {row.currentStaff.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400">
            登録なし
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {row.currentStaff.map((staff) => (
              <span
                key={staff.id}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700"
              >
                {staff.staff_name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SmallMetric({
  label,
  value,
  tone = 'normal',
}: {
  label: string
  value: number
  tone?: 'normal' | 'blue' | 'red' | 'bold'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p
        className={[
          'mt-1 text-xl font-black',
          tone === 'blue' ? 'text-blue-700' : '',
          tone === 'red' ? 'text-red-700' : '',
          tone === 'bold' || tone === 'normal' ? 'text-slate-900' : '',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function Pill({
  label,
  value,
  color,
  signed = false,
}: {
  label: string
  value: number
  color: 'green' | 'yellow' | 'orange' | 'red' | 'blue'
  signed?: boolean
}) {
  const className =
    color === 'green'
      ? 'bg-green-50 text-green-700 border-green-100'
      : color === 'yellow'
        ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
        : color === 'orange'
          ? 'bg-orange-50 text-orange-700 border-orange-100'
          : color === 'red'
            ? 'bg-red-50 text-red-700 border-red-100'
            : 'bg-blue-50 text-blue-700 border-blue-100'

  return (
    <div className={['rounded-xl border px-3 py-2 text-center', className].join(' ')}>
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-0.5 text-lg font-black">
        {signed && value > 0 ? '+' : ''}
        {value}
      </p>
    </div>
  )
}
