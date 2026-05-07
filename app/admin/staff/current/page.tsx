'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Branch = {
  id: string
  branch_name: string
}

type SalesUser = {
  id: string
  name: string
  branch_id: string | null
}

type Company = {
  id: string
  company_name: string
  branch_id: string | null
  sales_user_id: string | null
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
  branches?: { branch_name: string } | { branch_name: string }[] | null
  companies?: { company_name: string } | { company_name: string }[] | null
  sales_users?: { name: string } | { name: string }[] | null
}

function relationName(value: any, key: string) {
  if (!value) return '-'
  if (Array.isArray(value)) return value[0]?.[key] ?? '-'
  return value[key] ?? '-'
}

export default function CurrentStaffPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [staffList, setStaffList] = useState<CurrentStaff[]>([])

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    branch_id: '',
    company_id: '',
    sales_user_id: '',
    staff_name: '',
    start_date: '',
    employment_status: '就業中',
    planned_exit_date: '',
    memo: '',
    is_active: true,
  })

  useEffect(() => {
    initialize()
  }, [])

  async function initialize() {
    await Promise.all([
      fetchBranches(),
      fetchSalesUsers(),
      fetchCompanies(),
      fetchStaffList(),
    ])
  }

  async function fetchBranches() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      setMessage(`支店の取得に失敗しました：${error.message}`)
      return
    }

    setBranches(data ?? [])
  }

  async function fetchSalesUsers() {
    const { data, error } = await supabase
      .from('sales_users')
      .select('id, name, branch_id')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      setMessage(`担当者の取得に失敗しました：${error.message}`)
      return
    }

    setSalesUsers(data ?? [])
  }

  async function fetchCompanies() {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, branch_id, sales_user_id')
      .eq('is_active', true)
      .order('company_name', { ascending: true })

    if (error) {
      setMessage(`企業の取得に失敗しました：${error.message}`)
      return
    }

    setCompanies(data ?? [])
  }

  async function fetchStaffList() {
    const { data, error } = await supabase
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
        is_active,
        branches(branch_name),
        companies(company_name),
        sales_users(name)
      `)
      .order('staff_name', { ascending: true })

    if (error) {
      setMessage(`就業中スタッフの取得に失敗しました：${error.message}`)
      return
    }

    setStaffList((data ?? []) as unknown as CurrentStaff[])
  }

  async function handleSave() {
    if (!form.branch_id || !form.company_id || !form.staff_name.trim()) {
      setMessage('支店・企業・スタッフ名は必須です。')
      return
    }

    setLoading(true)
    setMessage('')

    const payload = {
      branch_id: form.branch_id,
      company_id: form.company_id,
      sales_user_id: form.sales_user_id || null,
      staff_name: form.staff_name.trim(),
      start_date: form.start_date || null,
      employment_status: form.employment_status,
      planned_exit_date: form.planned_exit_date || null,
      memo: form.memo || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }

    const query = editingId
      ? supabase.from('current_staff_assignments').update(payload).eq('id', editingId)
      : supabase.from('current_staff_assignments').insert(payload)

    const { error } = await query

    if (error) {
      setMessage(`保存に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    setMessage(editingId ? '就業中スタッフを更新しました。' : '就業中スタッフを登録しました。')
    resetForm()
    await fetchStaffList()
    setLoading(false)
  }

  function handleEdit(staff: CurrentStaff) {
    setEditingId(staff.id)
    setForm({
      branch_id: staff.branch_id,
      company_id: staff.company_id,
      sales_user_id: staff.sales_user_id ?? '',
      staff_name: staff.staff_name ?? '',
      start_date: staff.start_date ?? '',
      employment_status: staff.employment_status ?? '就業中',
      planned_exit_date: staff.planned_exit_date ?? '',
      memo: staff.memo ?? '',
      is_active: staff.is_active ?? true,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      branch_id: selectedBranchId || '',
      company_id: '',
      sales_user_id: '',
      staff_name: '',
      start_date: '',
      employment_status: '就業中',
      planned_exit_date: '',
      memo: '',
      is_active: true,
    })
  }

  const filteredCompaniesForForm = useMemo(() => {
    if (!form.branch_id) return companies
    return companies.filter((company) => company.branch_id === form.branch_id)
  }, [companies, form.branch_id])

  const filteredSalesUsersForForm = useMemo(() => {
    if (!form.branch_id) return salesUsers
    return salesUsers.filter((user) => user.branch_id === form.branch_id)
  }, [salesUsers, form.branch_id])

  const filteredStaffList = useMemo(() => {
    if (!selectedBranchId) return staffList
    return staffList.filter((staff) => staff.branch_id === selectedBranchId)
  }, [staffList, selectedBranchId])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">就業中スタッフ管理</h1>
          <p className="mt-1 text-sm text-slate-600">
            マップ図カードに表示する、現在就業中のスタッフ名を登録・編集します。
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            {editingId ? 'スタッフ編集' : 'スタッフ登録'}
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">支店</label>
              <select
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value, company_id: '', sales_user_id: '' })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">企業</label>
              <select
                value={form.company_id}
                onChange={(e) => {
                  const company = companies.find((item) => item.id === e.target.value)
                  setForm({
                    ...form,
                    company_id: e.target.value,
                    sales_user_id: company?.sales_user_id ?? form.sales_user_id,
                  })
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {filteredCompaniesForForm.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">担当者</label>
              <select
                value={form.sales_user_id}
                onChange={(e) => setForm({ ...form, sales_user_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">未設定</option>
                {filteredSalesUsersForForm.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">スタッフ名</label>
              <input
                value={form.staff_name}
                onChange={(e) => setForm({ ...form, staff_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="例：山田太郎"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">就業開始日</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">状態</label>
              <select
                value={form.employment_status}
                onChange={(e) => setForm({ ...form, employment_status: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="就業中">就業中</option>
                <option value="休職中">休職中</option>
                <option value="退職予定">退職予定</option>
                <option value="終了">終了</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">退職予定日</label>
              <input
                type="date"
                value={form.planned_exit_date}
                onChange={(e) => setForm({ ...form, planned_exit_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">表示</label>
              <select
                value={form.is_active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="true">表示する</option>
                <option value="false">表示しない</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">メモ</label>
              <input
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {editingId ? '更新' : '登録'}
            </button>

            <button
              onClick={resetForm}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              クリア
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 grid gap-4 md:grid-cols-[1fr_240px] md:items-end">
            <div>
              <h2 className="text-lg font-bold text-slate-900">登録済みスタッフ</h2>
              <p className="text-sm text-slate-500">支店で絞り込めます。</p>
            </div>

            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value)
                setForm((prev) => ({ ...prev, branch_id: e.target.value }))
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">全支店</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-3 py-2">スタッフ名</th>
                  <th className="px-3 py-2">支店</th>
                  <th className="px-3 py-2">企業</th>
                  <th className="px-3 py-2">担当者</th>
                  <th className="px-3 py-2">開始日</th>
                  <th className="px-3 py-2">状態</th>
                  <th className="px-3 py-2">退職予定日</th>
                  <th className="px-3 py-2">表示</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffList.map((staff) => (
                  <tr key={staff.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-900">{staff.staff_name}</td>
                    <td className="px-3 py-2">{relationName(staff.branches, 'branch_name')}</td>
                    <td className="px-3 py-2">{relationName(staff.companies, 'company_name')}</td>
                    <td className="px-3 py-2">{relationName(staff.sales_users, 'name')}</td>
                    <td className="px-3 py-2">{staff.start_date ?? '-'}</td>
                    <td className="px-3 py-2">{staff.employment_status ?? '-'}</td>
                    <td className="px-3 py-2">{staff.planned_exit_date ?? '-'}</td>
                    <td className="px-3 py-2">{staff.is_active ? '表示' : '非表示'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleEdit(staff)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredStaffList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                      就業中スタッフが登録されていません。
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
