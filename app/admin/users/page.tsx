'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type Branch = {
  id: string
  branch_name: string
}

type SalesUser = {
  id: string
  name: string
  branch_id: string | null
}

type UserRole = {
  id: string
  user_id: string
  email: string | null
  name: string | null
  role: 'admin' | 'manager' | 'user'
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

const roleOptions = [
  { value: 'admin', label: 'admin：全支店管理' },
  { value: 'manager', label: 'manager：自支店管理' },
  { value: 'user', label: 'user：自分のみ' },
]

export default function AdminUsersPage() {
  const router = useRouter()

  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    user_id: '',
    email: '',
    name: '',
    role: 'user' as 'admin' | 'manager' | 'user',
    branch_id: '',
    sales_user_id: '',
    is_active: true,
  })

  const filteredSalesUsers = useMemo(() => {
    if (!form.branch_id) return salesUsers
    return salesUsers.filter((user) => user.branch_id === form.branch_id)
  }, [form.branch_id, salesUsers])

  useEffect(() => {
    initialize()
  }, [])

  async function initialize() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
      return
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        id,
        user_id,
        email,
        name,
        role,
        branch_id,
        sales_user_id,
        is_active,
        branches (
          branch_name
        ),
        sales_users (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (roleError) {
      setMessage(`権限情報の取得に失敗しました：${roleError.message}`)
      setLoading(false)
      return
    }

    if (!roleData || roleData.role !== 'admin') {
      setMessage('このページはadminのみ利用できます。')
      setLoading(false)
      return
    }

    setCurrentRole(roleData as UserRole)

    await Promise.all([fetchBranches(), fetchSalesUsers(), fetchUserRoles()])

    setLoading(false)
  }

  async function fetchBranches() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      setMessage(`支店マスタの取得に失敗しました：${error.message}`)
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
      setMessage(`担当者マスタの取得に失敗しました：${error.message}`)
      return
    }

    setSalesUsers(data ?? [])
  }

  async function fetchUserRoles() {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        id,
        user_id,
        email,
        name,
        role,
        branch_id,
        sales_user_id,
        is_active,
        branches (
          branch_name
        ),
        sales_users (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`ユーザー権限一覧の取得に失敗しました：${error.message}`)
      return
    }

    setUserRoles((data ?? []) as UserRole[])
  }

  function resetForm() {
    setForm({
      user_id: '',
      email: '',
      name: '',
      role: 'user',
      branch_id: '',
      sales_user_id: '',
      is_active: true,
    })
  }

  function startEdit(row: UserRole) {
    setForm({
      user_id: row.user_id,
      email: row.email ?? '',
      name: row.name ?? '',
      role: row.role,
      branch_id: row.branch_id ?? '',
      sales_user_id: row.sales_user_id ?? '',
      is_active: row.is_active ?? true,
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    if (!form.user_id || !form.role) {
      setMessage('Auth user_id と権限は必須です。')
      return
    }

    if (form.role !== 'admin' && !form.branch_id) {
      setMessage('manager / user は所属支店が必須です。')
      return
    }

    if (form.role === 'user' && !form.sales_user_id) {
      setMessage('user は紐づく担当者が必須です。')
      return
    }

    setLoading(true)
    setMessage('')

    const payload = {
      user_id: form.user_id,
      email: form.email || null,
      name: form.name || null,
      role: form.role,
      branch_id: form.role === 'admin' ? null : form.branch_id || null,
      sales_user_id: form.role === 'user' ? form.sales_user_id || null : form.sales_user_id || null,
      is_active: form.is_active,
    }

    const { error } = await supabase.from('user_roles').upsert(payload, {
      onConflict: 'user_id',
    })

    if (error) {
      setMessage(`ユーザー権限の保存に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    setMessage('ユーザー権限を保存しました。')
    resetForm()
    await fetchUserRoles()
    setLoading(false)
  }

  async function handleToggleActive(row: UserRole) {
    const { error } = await supabase
      .from('user_roles')
      .update({ is_active: !(row.is_active ?? true) })
      .eq('id', row.id)

    if (error) {
      setMessage(`有効/無効の変更に失敗しました：${error.message}`)
      return
    }

    await fetchUserRoles()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading && !currentRole) {
    return (
      <main className="p-4 md:p-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          読み込み中...
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">ログインユーザー管理</h1>
            <p className="mt-1 text-sm text-slate-500">
              Supabase AuthのユーザーIDと、支店・担当者・権限を紐づけます。
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            ログアウト
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {currentRole?.role !== 'admin' ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            このページはadminのみ利用できます。
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">ユーザー権限登録・更新</h2>
              <p className="mt-1 text-sm text-slate-500">
                Auth user_id は Supabase Authentication の User UID を貼り付けてください。
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Input label="Auth user_id" value={form.user_id} onChange={(value) => setForm({ ...form, user_id: value })} />
                <Input label="メールアドレス" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                <Input label="氏名" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />

                <Select
                  label="権限"
                  value={form.role}
                  onChange={(value) => setForm({ ...form, role: value as 'admin' | 'manager' | 'user' })}
                  options={roleOptions}
                />

                <Select
                  label="所属支店"
                  value={form.branch_id}
                  onChange={(value) => setForm({ ...form, branch_id: value, sales_user_id: '' })}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.branch_name }))}
                  placeholder="admin以外は選択"
                  disabled={form.role === 'admin'}
                />

                <Select
                  label="担当者紐づけ"
                  value={form.sales_user_id}
                  onChange={(value) => setForm({ ...form, sales_user_id: value })}
                  options={filteredSalesUsers.map((user) => ({ value: user.id, label: user.name }))}
                  placeholder="userは必須"
                />

                <Select
                  label="状態"
                  value={form.is_active ? 'true' : 'false'}
                  onChange={(value) => setForm({ ...form, is_active: value === 'true' })}
                  options={[
                    { value: 'true', label: '有効' },
                    { value: 'false', label: '無効' },
                  ]}
                />

                <div className="flex items-end gap-2">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={resetForm}
                    disabled={loading}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                  >
                    クリア
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">ユーザー一覧</h2>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1050px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[210px]" />
                    <col className="w-[180px]" />
                    <col className="w-[140px]" />
                    <col className="w-[100px]" />
                    <col className="w-[130px]" />
                    <col className="w-[130px]" />
                    <col className="w-[90px]" />
                    <col className="w-[160px]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b bg-slate-100 text-left">
                      <th className="px-3 py-2">user_id</th>
                      <th className="px-3 py-2">メール</th>
                      <th className="px-3 py-2">氏名</th>
                      <th className="px-3 py-2">権限</th>
                      <th className="px-3 py-2">支店</th>
                      <th className="px-3 py-2">担当者</th>
                      <th className="px-3 py-2">状態</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRoles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          ユーザー権限が登録されていません。
                        </td>
                      </tr>
                    ) : (
                      userRoles.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-slate-50">
                          <td className="truncate px-3 py-2 font-mono text-xs">{row.user_id}</td>
                          <td className="truncate px-3 py-2">{row.email ?? '-'}</td>
                          <td className="px-3 py-2 font-semibold">{row.name ?? '-'}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                              {row.role}
                            </span>
                          </td>
                          <td className="px-3 py-2">{row.branches?.branch_name ?? '-'}</td>
                          <td className="px-3 py-2">{row.sales_users?.name ?? '-'}</td>
                          <td className="px-3 py-2">
                            {row.is_active ? (
                              <span className="text-sm font-bold text-green-700">有効</span>
                            ) : (
                              <span className="text-sm font-bold text-slate-400">無効</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(row)}
                                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleToggleActive(row)}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700"
                              >
                                {row.is_active ? '無効化' : '有効化'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
