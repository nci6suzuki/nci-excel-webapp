'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
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

type CurrentStaff = {
  id: string
  branch_id: string
  company_id: string
  sales_user_id: string | null
  staff_name: string
  start_date: string | null
  employment_status: string | null
  planned_exit_date: string | null
  actual_exit_date: string | null
  exit_reason: string | null
  memo: string | null
  is_active: boolean | null
  branches?: { branch_name: string } | { branch_name: string }[] | null
  companies?: { company_name: string } | { company_name: string }[] | null
  sales_users?: { name: string } | { name: string }[] | null
}

type TransferHistory = {
  id: string
  staff_name: string
  transfer_date: string
  transfer_reason: string | null
  memo: string | null
  created_at: string | null
  from_branches?: { branch_name: string } | { branch_name: string }[] | null
  from_companies?: { company_name: string } | { company_name: string }[] | null
  from_sales_users?: { name: string } | { name: string }[] | null
  to_branches?: { branch_name: string } | { branch_name: string }[] | null
  to_companies?: { company_name: string } | { company_name: string }[] | null
  to_sales_users?: { name: string } | { name: string }[] | null
}

function getCurrentMonth() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function relationName(value: any, key: string) {
  if (!value) return '-'
  if (Array.isArray(value)) return value[0]?.[key] ?? '-'
  return value[key] ?? '-'
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, '').slice(0, 31)
}

export default function StaffExportPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [staffList, setStaffList] = useState<CurrentStaff[]>([])
  const [histories, setHistories] = useState<TransferHistory[]>([])

  const [targetMonth, setTargetMonth] = useState(getCurrentMonth())
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!currentRole) return
    fetchData()
  }, [currentRole, selectedBranchId, statusFilter])

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

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id, name, role, branch_id, sales_user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (roleError) {
      setMessage(`権限情報の取得に失敗しました：${roleError.message}`)
      setLoading(false)
      return
    }

    if (!roleData) {
      setMessage('このユーザーの権限情報が登録されていません。')
      setLoading(false)
      return
    }

    const role = roleData as CurrentUserRole
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

    let branchQuery = supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

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
        actual_exit_date,
        exit_reason,
        memo,
        is_active,
        branches(branch_name),
        companies(company_name),
        sales_users(name)
      `)
      .order('staff_name', { ascending: true })

    let historyQuery = supabase
      .from('staff_assignment_histories')
      .select(`
        id,
        staff_name,
        transfer_date,
        transfer_reason,
        memo,
        created_at,
        from_branches:branches!staff_assignment_histories_from_branch_id_fkey(branch_name),
        from_companies:companies!staff_assignment_histories_from_company_id_fkey(company_name),
        from_sales_users:sales_users!staff_assignment_histories_from_sales_user_id_fkey(name),
        to_branches:branches!staff_assignment_histories_to_branch_id_fkey(branch_name),
        to_companies:companies!staff_assignment_histories_to_company_id_fkey(company_name),
        to_sales_users:sales_users!staff_assignment_histories_to_sales_user_id_fkey(name)
      `)
      .order('transfer_date', { ascending: false })

    if (statusFilter === 'active') {
      staffQuery = staffQuery.eq('is_active', true)
    } else if (statusFilter !== 'all') {
      staffQuery = staffQuery.eq('employment_status', statusFilter)
    }

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      branchQuery = branchQuery.eq('id', currentRole.branch_id)
      staffQuery = staffQuery.eq('branch_id', currentRole.branch_id)
    }

    if (selectedBranchId) {
      staffQuery = staffQuery.eq('branch_id', selectedBranchId)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      staffQuery = staffQuery.eq('sales_user_id', currentRole.sales_user_id)
    }

    const [branchResult, staffResult, historyResult] = await Promise.all([
      branchQuery,
      staffQuery,
      historyQuery,
    ])

    const firstError = branchResult.error || staffResult.error || historyResult.error

    if (firstError) {
      setMessage(`データ取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    setBranches((branchResult.data ?? []) as Branch[])
    setStaffList((staffResult.data ?? []) as unknown as CurrentStaff[])
    setHistories((historyResult.data ?? []) as unknown as TransferHistory[])
    setLoading(false)
  }

  const selectedBranchName = useMemo(() => {
    if (!selectedBranchId) return '全支店'
    return branches.find((branch) => branch.id === selectedBranchId)?.branch_name ?? '支店未設定'
  }, [branches, selectedBranchId])

  const summary = useMemo(() => {
    return {
      total: staffList.length,
      working: staffList.filter((staff) => staff.employment_status === '就業中').length,
      leave: staffList.filter((staff) => staff.employment_status === '休職中').length,
      plannedExit: staffList.filter((staff) => staff.employment_status === '退職予定').length,
      ended: staffList.filter((staff) => staff.employment_status === '終了').length,
    }
  }, [staffList])

  function exportExcel() {
    const workbook = XLSX.utils.book_new()

    const staffRows = staffList.map((staff) => ({
      支店: relationName(staff.branches, 'branch_name'),
      企業: relationName(staff.companies, 'company_name'),
      担当者: relationName(staff.sales_users, 'name'),
      スタッフ名: staff.staff_name,
      就業開始日: staff.start_date ?? '',
      状態: staff.employment_status ?? '',
      退職予定日: staff.planned_exit_date ?? '',
      終了日: staff.actual_exit_date ?? '',
      終了理由: staff.exit_reason ?? '',
      表示対象: staff.is_active ? '表示' : '非表示',
      メモ: staff.memo ?? '',
    }))

    const summaryRows = [
      { 項目: '対象月', 値: targetMonth },
      { 項目: '支店', 値: selectedBranchName },
      { 項目: '表示スタッフ数', 値: summary.total },
      { 項目: '就業中', 値: summary.working },
      { 項目: '休職中', 値: summary.leave },
      { 項目: '退職予定', 値: summary.plannedExit },
      { 項目: '終了', 値: summary.ended },
    ]

    const mapRows = staffList.map((staff) => ({
      支店: relationName(staff.branches, 'branch_name'),
      企業: relationName(staff.companies, 'company_name'),
      スタッフ名: staff.staff_name,
      状態: staff.employment_status ?? '',
      担当者: relationName(staff.sales_users, 'name'),
    }))

    const historyRows = histories.map((history) => ({
      異動日: history.transfer_date,
      スタッフ名: history.staff_name,
      異動前支店: relationName(history.from_branches, 'branch_name'),
      異動前企業: relationName(history.from_companies, 'company_name'),
      異動前担当者: relationName(history.from_sales_users, 'name'),
      異動後支店: relationName(history.to_branches, 'branch_name'),
      異動後企業: relationName(history.to_companies, 'company_name'),
      異動後担当者: relationName(history.to_sales_users, 'name'),
      理由: history.transfer_reason ?? '',
      メモ: history.memo ?? '',
      登録日時: history.created_at ?? '',
    }))

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      safeSheetName('サマリー')
    )

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(staffRows),
      safeSheetName('スタッフ一覧')
    )

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(mapRows),
      safeSheetName('マップ図用一覧')
    )

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(historyRows),
      safeSheetName('配置変更履歴')
    )

    const fileName = `${targetMonth}_${selectedBranchName}_スタッフ配置表.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-emerald-100">
            Staff Export
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            スタッフ配置表 Excel出力
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
            就業中スタッフ、マップ図用一覧、配置変更履歴をExcelで出力します。
          </p>
        </section>

        {message && (
          <div className="whitespace-pre-wrap rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
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
                状態
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="active">表示対象のみ</option>
                <option value="就業中">就業中</option>
                <option value="休職中">休職中</option>
                <option value="退職予定">退職予定</option>
                <option value="終了">終了</option>
                <option value="all">全て</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchData}
                disabled={loading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? '読込中...' : '再読込'}
              </button>
            </div>

            <div className="flex items-end">
              <button
                onClick={exportExcel}
                disabled={loading || staffList.length === 0}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Excel出力
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <SummaryCard label="表示件数" value={summary.total} suffix="名" />
          <SummaryCard label="就業中" value={summary.working} suffix="名" />
          <SummaryCard label="休職中" value={summary.leave} suffix="名" />
          <SummaryCard label="退職予定" value={summary.plannedExit} suffix="名" />
          <SummaryCard label="終了" value={summary.ended} suffix="名" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              出力プレビュー
            </h2>
            <p className="text-sm text-slate-500">
              Excelに出力されるスタッフ一覧です。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-3 py-2">支店</th>
                  <th className="px-3 py-2">企業</th>
                  <th className="px-3 py-2">担当者</th>
                  <th className="px-3 py-2">スタッフ名</th>
                  <th className="px-3 py-2">開始日</th>
                  <th className="px-3 py-2">状態</th>
                  <th className="px-3 py-2">退職予定日</th>
                  <th className="px-3 py-2">終了日</th>
                  <th className="px-3 py-2">表示</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff) => (
                  <tr key={staff.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{relationName(staff.branches, 'branch_name')}</td>
                    <td className="px-3 py-2">{relationName(staff.companies, 'company_name')}</td>
                    <td className="px-3 py-2">{relationName(staff.sales_users, 'name')}</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{staff.staff_name}</td>
                    <td className="px-3 py-2">{staff.start_date ?? '-'}</td>
                    <td className="px-3 py-2">{staff.employment_status ?? '-'}</td>
                    <td className="px-3 py-2">{staff.planned_exit_date ?? '-'}</td>
                    <td className="px-3 py-2">{staff.actual_exit_date ?? '-'}</td>
                    <td className="px-3 py-2">{staff.is_active ? '表示' : '非表示'}</td>
                  </tr>
                ))}

                {staffList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                      出力対象スタッフがいません。
                    </td>
                  </tr>
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
