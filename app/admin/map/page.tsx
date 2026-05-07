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

export default function WorkforceMapPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)

  const [targetMonth, setTargetMonth] = useState(getCurrentMonth())
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedSalesUserId, setSelectedSalesUserId] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')

  const [branches, setBranches] = useState<Branch[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [currentStaffList, setCurrentStaffList] = useState<CurrentStaff[]>([])

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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

    let currentStaffQuery = supabase
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
        memo,
        is_active
      `)
      .eq('is_active', true)
      .in('employment_status', ['就業中', '休職中', '退職予定'])
      .order('staff_name', { ascending: true })

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      branchQuery = branchQuery.eq('id', currentRole.branch_id)
      companyQuery = companyQuery.eq('branch_id', currentRole.branch_id)
      currentStaffQuery = currentStaffQuery.eq('branch_id', currentRole.branch_id)
    }

    if (selectedBranchId) {
      companyQuery = companyQuery.eq('branch_id', selectedBranchId)
      currentStaffQuery = currentStaffQuery.eq('branch_id', selectedBranchId)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      companyQuery = companyQuery.eq('sales_user_id', currentRole.sales_user_id)
      currentStaffQuery = currentStaffQuery.eq('sales_user_id', currentRole.sales_user_id)
    } else if (selectedSalesUserId) {
      companyQuery = companyQuery.eq('sales_user_id', selectedSalesUserId)
      currentStaffQuery = currentStaffQuery.eq('sales_user_id', selectedSalesUserId)
    }

    const [branchResult, companyResult, currentStaffResult] = await Promise.all([
      branchQuery,
      companyQuery,
      currentStaffQuery,
    ])

    const firstError =
      branchResult.error ||
      companyResult.error ||
      currentStaffResult.error

    if (firstError) {
      setMessage(`マップ図データの取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    setBranches((branchResult.data ?? []) as Branch[])
    setCompanies((companyResult.data ?? []) as unknown as Company[])
    setCurrentStaffList((currentStaffResult.data ?? []) as CurrentStaff[])

    setLoading(false)
  }

  const mapRows = useMemo(() => {
    return companies.map((company) => {
      const currentStaff = currentStaffList.filter((staff) => {
        return staff.company_id === company.id
      })

      const workingStaff = currentStaff.filter((staff) => staff.employment_status === '就業中')
      const leaveStaff = currentStaff.filter((staff) => staff.employment_status === '休職中')
      const plannedExitStaff = currentStaff.filter((staff) => staff.employment_status === '退職予定')

      return {
        company,
        currentStaff,
        workingStaff,
        leaveStaff,
        plannedExitStaff,
      }
    })
  }, [companies, currentStaffList])

  const summary = useMemo(() => {
    const workingCount = currentStaffList.filter((staff) => staff.employment_status === '就業中').length
    const leaveCount = currentStaffList.filter((staff) => staff.employment_status === '休職中').length
    const plannedExitCount = currentStaffList.filter((staff) => staff.employment_status === '退職予定').length

    return {
      companyCount: companies.length,
      staffCount: currentStaffList.length,
      workingCount,
      leaveCount,
      plannedExitCount,
    }
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
            企業ごとに、現在就業中のスタッフ名をカード形式で表示します。
            スタッフ名をクリックすると詳細ページへ移動できます。
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MapMetric label="企業数" value={summary.companyCount} suffix="社" />
          <MapMetric label="登録スタッフ" value={summary.staffCount} suffix="名" />
          <MapMetric label="就業中" value={summary.workingCount} suffix="名" />
          <MapMetric label="休職中" value={summary.leaveCount} suffix="名" />
          <MapMetric label="退職予定" value={summary.plannedExitCount} suffix="名" />
        </section>

        {viewMode === 'card' ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mapRows.map((row) => (
              <CompanyMapCard
                key={row.company.id}
                row={row}
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
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-100 text-left">
                    <th className="px-3 py-2">支店</th>
                    <th className="px-3 py-2">企業</th>
                    <th className="px-3 py-2">担当</th>
                    <th className="px-3 py-2 text-right">就業中</th>
                    <th className="px-3 py-2 text-right">休職中</th>
                    <th className="px-3 py-2 text-right">退職予定</th>
                    <th className="px-3 py-2">スタッフ名</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {mapRows.map((row) => (
                    <tr key={row.company.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2">{row.company.branches?.branch_name ?? '-'}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{row.company.company_name}</td>
                      <td className="px-3 py-2">{row.company.sales_users?.name ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-bold">{row.workingStaff.length}</td>
                      <td className="px-3 py-2 text-right">{row.leaveStaff.length}</td>
                      <td className="px-3 py-2 text-right text-red-600">{row.plannedExitStaff.length}</td>
                      <td className="px-3 py-2">
                        {row.currentStaff.length === 0 ? (
                          '-'
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {row.currentStaff.map((staff) => (
                              <Link
                                key={staff.id}
                                href={`/admin/staff/${staff.id}`}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                {staff.staff_name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Link
                            href="/admin/staff/transfer"
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"
                          >
                            配置変更
                          </Link>
                          <Link
                            href="/admin/staff/current"
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700"
                          >
                            管理
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {mapRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
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
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span>}
      </p>
    </div>
  )
}

function CompanyMapCard({
  row,
}: {
  row: {
    company: Company
    currentStaff: CurrentStaff[]
    workingStaff: CurrentStaff[]
    leaveStaff: CurrentStaff[]
    plannedExitStaff: CurrentStaff[]
  }
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

        <div className="flex shrink-0 flex-col gap-2">
          <Link
            href="/admin/staff/transfer"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            配置変更
          </Link>

          <Link
            href="/admin/staff/current"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            管理
          </Link>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <StaffCount label="就業中" value={row.workingStaff.length} />
        <StaffCount label="休職中" value={row.leaveStaff.length} />
        <StaffCount label="退職予定" value={row.plannedExitStaff.length} danger />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black text-slate-700">
            スタッフ
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
              <Link
                key={staff.id}
                href={`/admin/staff/${staff.id}`}
                className={[
                  'rounded-full border px-2 py-1 text-xs font-bold transition',
                  staff.employment_status === '退職予定'
                    ? 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100'
                    : staff.employment_status === '休職中'
                      ? 'border-yellow-100 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
                ].join(' ')}
              >
                {staff.staff_name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StaffCount({
  label,
  value,
  danger = false,
}: {
  label: string
  value: number
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="text-xs font-bold text-slate-500">
        {label}
      </p>
      <p className={['mt-1 text-xl font-black', danger && value > 0 ? 'text-red-600' : 'text-slate-900'].join(' ')}>
        {value}
      </p>
    </div>
  )
}
