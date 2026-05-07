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

function relationName(value: any, key: string) {
  if (!value) return '-'
  if (Array.isArray(value)) return value[0]?.[key] ?? '-'
  return value[key] ?? '-'
}

export default function StaffSearchPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [staffList, setStaffList] = useState<CurrentStaff[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [keyword, setKeyword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!currentRole) return
    fetchStaff()
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

    await fetchBranches(role)
    setLoading(false)
  }

  async function fetchBranches(role: CurrentUserRole) {
    let query = supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (role.role !== 'admin' && role.branch_id) {
      query = query.eq('id', role.branch_id)
    }

    const { data, error } = await query

    if (error) {
      setMessage(`支店の取得に失敗しました：${error.message}`)
      return
    }

    setBranches(data ?? [])
  }

  async function fetchStaff() {
    if (!currentRole) return

    setLoading(true)
    setMessage('')

    let query = supabase
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

    if (statusFilter === 'active') {
      query = query.eq('is_active', true)
    } else if (statusFilter !== 'all') {
      query = query.eq('employment_status', statusFilter)
    }

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      query = query.eq('branch_id', currentRole.branch_id)
    }

    if (selectedBranchId) {
      query = query.eq('branch_id', selectedBranchId)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      query = query.eq('sales_user_id', currentRole.sales_user_id)
    }

    const { data, error } = await query

    if (error) {
      setMessage(`スタッフ一覧の取得に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    setStaffList((data ?? []) as unknown as CurrentStaff[])
    setLoading(false)
  }

  const filteredStaffList = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return staffList

    return staffList.filter((staff) => {
      const values = [
        staff.staff_name,
        relationName(staff.branches, 'branch_name'),
        relationName(staff.companies, 'company_name'),
        relationName(staff.sales_users, 'name'),
        staff.employment_status,
        staff.memo,
      ]

      return values.some((value) => String(value).toLowerCase().includes(q))
    })
  }, [staffList, keyword])

  const summary = useMemo(() => {
    return {
      total: filteredStaffList.length,
      working: filteredStaffList.filter((staff) => staff.employment_status === '就業中').length,
      leave: filteredStaffList.filter((staff) => staff.employment_status === '休職中').length,
      plannedExit: filteredStaffList.filter((staff) => staff.employment_status === '退職予定').length,
      ended: filteredStaffList.filter((staff) => staff.employment_status === '終了').length,
    }
  }, [filteredStaffList])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">Staff Search</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            スタッフ検索
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            就業中スタッフを検索し、現在の就業先・担当者・状態を確認できます。氏名をクリックすると詳細ページに移動します。
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
              <label className="mb-1 block text-sm font-bold text-slate-700">支店</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                disabled={currentRole?.role !== 'admin'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">全支店</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">状態</label>
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

            <div className="xl:col-span-2">
              <label className="mb-1 block text-sm font-bold text-slate-700">検索</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="スタッフ名・企業名・担当者名で検索"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchStaff}
                disabled={loading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? '読込中...' : '再読込'}
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
            <h2 className="text-lg font-bold text-slate-900">スタッフ一覧</h2>
            <p className="text-sm text-slate-500">氏名をクリックすると、詳細ページを確認できます。</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-3 py-2">スタッフ名</th>
                  <th className="px-3 py-2">支店</th>
                  <th className="px-3 py-2">企業</th>
                  <th className="px-3 py-2">担当者</th>
                  <th className="px-3 py-2">開始日</th>
                  <th className="px-3 py-2">退職予定日</th>
                  <th className="px-3 py-2">状態</th>
                  <th className="px-3 py-2">メモ</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffList.map((staff) => (
                  <tr key={staff.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-blue-700">
                      <Link href={`/admin/staff/${staff.id}`} className="hover:underline">
                        {staff.staff_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{relationName(staff.branches, 'branch_name')}</td>
                    <td className="px-3 py-2">{relationName(staff.companies, 'company_name')}</td>
                    <td className="px-3 py-2">{relationName(staff.sales_users, 'name')}</td>
                    <td className="px-3 py-2">{staff.start_date ?? '-'}</td>
                    <td className="px-3 py-2">{staff.planned_exit_date ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-xs font-bold',
                          staff.employment_status === '退職予定'
                            ? 'bg-red-50 text-red-700'
                            : staff.employment_status === '終了'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-blue-50 text-blue-700',
                        ].join(' ')}
                      >
                        {staff.employment_status ?? '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{staff.memo ?? '-'}</td>
                  </tr>
                ))}

                {filteredStaffList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      対象スタッフがいません。
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

function SummaryCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span>}
      </p>
    </div>
  )
}
