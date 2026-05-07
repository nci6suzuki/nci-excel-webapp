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

type Branch = { id: string; branch_name: string }
type SalesUser = { id: string; name: string; branch_id: string | null }
type Company = { id: string; company_name: string; branch_id: string | null; sales_user_id: string | null }

type CurrentStaff = {
  id: string
  branch_id: string
  company_id: string
  sales_user_id: string | null
  staff_name: string
  start_date: string | null
  employment_status: string | null
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
  from_branches?: { branch_name: string } | { branch_name: string }[] | null
  from_companies?: { company_name: string } | { company_name: string }[] | null
  from_sales_users?: { name: string } | { name: string }[] | null
  to_branches?: { branch_name: string } | { branch_name: string }[] | null
  to_companies?: { company_name: string } | { company_name: string }[] | null
  to_sales_users?: { name: string } | { name: string }[] | null
}

function today() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function relationName(value: any, key: string) {
  if (!value) return '-'
  if (Array.isArray(value)) return value[0]?.[key] ?? '-'
  return value[key] ?? '-'
}

export default function StaffTransferPage() {
  const [currentRole, setCurrentRole] = useState<CurrentUserRole | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [staffList, setStaffList] = useState<CurrentStaff[]>([])
  const [histories, setHistories] = useState<TransferHistory[]>([])

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<CurrentStaff | null>(null)

  const [transferForm, setTransferForm] = useState({
    to_branch_id: '',
    to_company_id: '',
    to_sales_user_id: '',
    transfer_date: today(),
    transfer_reason: '',
    memo: '',
  })

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!currentRole) return
    fetchData()
  }, [currentRole, selectedBranchId])

  async function initialize() {
    setLoading(true)
    setMessage('')

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

    let companyQuery = supabase
      .from('companies')
      .select('id, company_name, branch_id, sales_user_id')
      .eq('is_active', true)
      .order('company_name', { ascending: true })

    let salesUserQuery = supabase
      .from('sales_users')
      .select('id, name, branch_id')
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
        is_active,
        branches(branch_name),
        companies(company_name),
        sales_users(name)
      `)
      .eq('is_active', true)
      .in('employment_status', ['就業中', '休職中', '退職予定'])
      .order('staff_name', { ascending: true })

    let historyQuery = supabase
      .from('staff_assignment_histories')
      .select(`
        id,
        staff_name,
        transfer_date,
        transfer_reason,
        from_branches:branches!staff_assignment_histories_from_branch_id_fkey(branch_name),
        from_companies:companies!staff_assignment_histories_from_company_id_fkey(company_name),
        from_sales_users:sales_users!staff_assignment_histories_from_sales_user_id_fkey(name),
        to_branches:branches!staff_assignment_histories_to_branch_id_fkey(branch_name),
        to_companies:companies!staff_assignment_histories_to_company_id_fkey(company_name),
        to_sales_users:sales_users!staff_assignment_histories_to_sales_user_id_fkey(name)
      `)
      .order('transfer_date', { ascending: false })
      .limit(100)

    if (currentRole.role !== 'admin' && currentRole.branch_id) {
      branchQuery = branchQuery.eq('id', currentRole.branch_id)
      companyQuery = companyQuery.eq('branch_id', currentRole.branch_id)
      salesUserQuery = salesUserQuery.eq('branch_id', currentRole.branch_id)
      staffQuery = staffQuery.eq('branch_id', currentRole.branch_id)
    }

    if (selectedBranchId) {
      companyQuery = companyQuery.eq('branch_id', selectedBranchId)
      salesUserQuery = salesUserQuery.eq('branch_id', selectedBranchId)
      staffQuery = staffQuery.eq('branch_id', selectedBranchId)
    }

    if (currentRole.role === 'user' && currentRole.sales_user_id) {
      companyQuery = companyQuery.eq('sales_user_id', currentRole.sales_user_id)
      staffQuery = staffQuery.eq('sales_user_id', currentRole.sales_user_id)
    }

    const [branchResult, companyResult, salesUserResult, staffResult, historyResult] =
      await Promise.all([branchQuery, companyQuery, salesUserQuery, staffQuery, historyQuery])

    const firstError =
      branchResult.error ||
      companyResult.error ||
      salesUserResult.error ||
      staffResult.error ||
      historyResult.error

    if (firstError) {
      setMessage(`データ取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    setBranches((branchResult.data ?? []) as Branch[])
    setCompanies((companyResult.data ?? []) as Company[])
    setSalesUsers((salesUserResult.data ?? []) as SalesUser[])
    setStaffList((staffResult.data ?? []) as unknown as CurrentStaff[])
    setHistories((historyResult.data ?? []) as unknown as TransferHistory[])
    setLoading(false)
  }

  function openTransfer(staff: CurrentStaff) {
    setSelectedStaff(staff)
    setTransferForm({
      to_branch_id: staff.branch_id,
      to_company_id: staff.company_id,
      to_sales_user_id: staff.sales_user_id ?? '',
      transfer_date: today(),
      transfer_reason: '',
      memo: '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelTransfer() {
    setSelectedStaff(null)
    setTransferForm({
      to_branch_id: '',
      to_company_id: '',
      to_sales_user_id: '',
      transfer_date: today(),
      transfer_reason: '',
      memo: '',
    })
  }

  async function handleTransfer() {
    if (!selectedStaff || !currentRole) return

    if (!transferForm.to_branch_id || !transferForm.to_company_id || !transferForm.transfer_date) {
      setMessage('異動先支店・異動先企業・異動日を入力してください。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error: historyError } = await supabase
      .from('staff_assignment_histories')
      .insert({
        staff_assignment_id: selectedStaff.id,
        staff_name: selectedStaff.staff_name,
        from_branch_id: selectedStaff.branch_id,
        from_company_id: selectedStaff.company_id,
        from_sales_user_id: selectedStaff.sales_user_id,
        to_branch_id: transferForm.to_branch_id,
        to_company_id: transferForm.to_company_id,
        to_sales_user_id: transferForm.to_sales_user_id || null,
        transfer_date: transferForm.transfer_date,
        transfer_reason: transferForm.transfer_reason || null,
        memo: transferForm.memo || null,
        created_by: currentRole.user_id,
      })

    if (historyError) {
      setMessage(`異動履歴の保存に失敗しました：${historyError.message}`)
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('current_staff_assignments')
      .update({
        branch_id: transferForm.to_branch_id,
        company_id: transferForm.to_company_id,
        sales_user_id: transferForm.to_sales_user_id || null,
        memo: transferForm.memo || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedStaff.id)

    if (updateError) {
      setMessage(`スタッフ配置の更新に失敗しました：${updateError.message}`)
      setLoading(false)
      return
    }

    setMessage(`${selectedStaff.staff_name} さんの配置を変更しました。`)
    cancelTransfer()
    await fetchData()
    setLoading(false)
  }

  const filteredCompaniesForForm = useMemo(() => {
    if (!transferForm.to_branch_id) return companies
    return companies.filter((company) => company.branch_id === transferForm.to_branch_id)
  }, [companies, transferForm.to_branch_id])

  const filteredSalesUsersForForm = useMemo(() => {
    if (!transferForm.to_branch_id) return salesUsers
    return salesUsers.filter((user) => user.branch_id === transferForm.to_branch_id)
  }, [salesUsers, transferForm.to_branch_id])

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
      ]

      return values.some((value) => String(value).toLowerCase().includes(q))
    })
  }, [staffList, keyword])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">Staff Transfer</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            スタッフ異動・配置変更
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            就業中スタッフの所属企業・担当者を変更します。変更後はマップ図に即時反映され、異動履歴も保存されます。
          </p>
        </section>

        {message && (
          <div className="whitespace-pre-wrap rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {selectedStaff && (
          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">配置変更</h2>
              <p className="text-sm text-slate-600">
                {selectedStaff.staff_name} さんの配置を変更します。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">異動先支店</label>
                <select
                  value={transferForm.to_branch_id}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      to_branch_id: e.target.value,
                      to_company_id: '',
                      to_sales_user_id: '',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">選択してください</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">異動先企業</label>
                <select
                  value={transferForm.to_company_id}
                  onChange={(e) => {
                    const company = companies.find((item) => item.id === e.target.value)
                    setTransferForm({
                      ...transferForm,
                      to_company_id: e.target.value,
                      to_sales_user_id: company?.sales_user_id ?? transferForm.to_sales_user_id,
                    })
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">選択してください</option>
                  {filteredCompaniesForForm.map((company) => (
                    <option key={company.id} value={company.id}>{company.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">異動先担当者</label>
                <select
                  value={transferForm.to_sales_user_id}
                  onChange={(e) => setTransferForm({ ...transferForm, to_sales_user_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">未設定</option>
                  {filteredSalesUsersForForm.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">異動日</label>
                <input
                  type="date"
                  value={transferForm.transfer_date}
                  onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">理由</label>
                <input
                  value={transferForm.transfer_reason}
                  onChange={(e) => setTransferForm({ ...transferForm, transfer_reason: e.target.value })}
                  placeholder="例：増員対応、配置転換"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">メモ</label>
                <input
                  value={transferForm.memo}
                  onChange={(e) => setTransferForm({ ...transferForm, memo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleTransfer}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                配置変更を実行
              </button>

              <button
                onClick={cancelTransfer}
                disabled={loading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                onClick={fetchData}
                disabled={loading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? '読込中...' : '再読込'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">現在の配置</h2>
            <p className="text-sm text-slate-500">対象スタッフを選び、配置変更を行います。</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-3 py-2">スタッフ名</th>
                  <th className="px-3 py-2">支店</th>
                  <th className="px-3 py-2">企業</th>
                  <th className="px-3 py-2">担当</th>
                  <th className="px-3 py-2">開始日</th>
                  <th className="px-3 py-2">状態</th>
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
                    <td className="px-3 py-2">
                      <button
                        onClick={() => openTransfer(staff)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"
                      >
                        配置変更
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredStaffList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                      対象スタッフがいません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">配置変更履歴</h2>
            <p className="text-sm text-slate-500">直近100件の配置変更履歴です。</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-3 py-2">異動日</th>
                  <th className="px-3 py-2">スタッフ名</th>
                  <th className="px-3 py-2">異動前支店</th>
                  <th className="px-3 py-2">異動前企業</th>
                  <th className="px-3 py-2">異動前担当</th>
                  <th className="px-3 py-2">異動後支店</th>
                  <th className="px-3 py-2">異動後企業</th>
                  <th className="px-3 py-2">異動後担当</th>
                  <th className="px-3 py-2">理由</th>
                </tr>
              </thead>
              <tbody>
                {histories.map((history) => (
                  <tr key={history.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{history.transfer_date}</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{history.staff_name}</td>
                    <td className="px-3 py-2">{relationName(history.from_branches, 'branch_name')}</td>
                    <td className="px-3 py-2">{relationName(history.from_companies, 'company_name')}</td>
                    <td className="px-3 py-2">{relationName(history.from_sales_users, 'name')}</td>
                    <td className="px-3 py-2">{relationName(history.to_branches, 'branch_name')}</td>
                    <td className="px-3 py-2">{relationName(history.to_companies, 'company_name')}</td>
                    <td className="px-3 py-2">{relationName(history.to_sales_users, 'name')}</td>
                    <td className="px-3 py-2">{history.transfer_reason ?? '-'}</td>
                  </tr>
                ))}

                {histories.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                      配置変更履歴はありません。
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
