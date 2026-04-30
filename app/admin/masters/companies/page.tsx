'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Branch = { id: string; branch_name: string }
type SalesUser = { id: string; name: string; branch_id: string | null }
type Company = {
  id: string
  company_name: string
  branch_id: string | null
  sales_user_id: string | null
  display_order: number | null
  is_active: boolean | null
  branches?: { branch_name: string } | null
  sales_users?: { name: string } | null
}

export default function CompanyMasterPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [rows, setRows] = useState<Company[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ company_name: '', branch_id: '', sales_user_id: '', display_order: '0', is_active: true })

  useEffect(() => { initialize() }, [])

  async function initialize() { await Promise.all([fetchBranches(), fetchSalesUsers(), fetchRows()]) }

  async function fetchBranches() {
    const { data, error } = await supabase.from('branches').select('id, branch_name').eq('is_active', true).order('display_order', { ascending: true })
    if (error) return setMessage(`支店マスタの取得に失敗しました：${error.message}`)
    setBranches(data ?? [])
  }

  async function fetchSalesUsers() {
    const { data, error } = await supabase.from('sales_users').select('id, name, branch_id').eq('is_active', true).order('display_order', { ascending: true })
    if (error) return setMessage(`担当者マスタの取得に失敗しました：${error.message}`)
    setSalesUsers(data ?? [])
  }

  async function fetchRows() {
    const { data, error } = await supabase.from('companies').select('id, company_name, branch_id, sales_user_id, display_order, is_active, branches(branch_name), sales_users(name)').order('display_order', { ascending: true }).order('company_name', { ascending: true })
    if (error) return setMessage(`企業マスタの取得に失敗しました：${error.message}`)
    setRows((data ?? []) as Company[])
  }

  async function handleSave() {
    if (!form.company_name.trim() || !form.branch_id) return setMessage('企業名と支店は必須です。')
    setLoading(true); setMessage('')
    const payload = { company_name: form.company_name.trim(), branch_id: form.branch_id, sales_user_id: form.sales_user_id || null, display_order: Number(form.display_order || 0), is_active: form.is_active }
    const { error } = editingId ? await supabase.from('companies').update(payload).eq('id', editingId) : await supabase.from('companies').insert(payload)
    if (error) { setLoading(false); return setMessage(`保存に失敗しました：${error.message}`) }
    setMessage(editingId ? '企業を更新しました。' : '企業を登録しました。')
    resetForm(); await fetchRows(); setLoading(false)
  }

  function handleEdit(row: Company) {
    setEditingId(row.id)
    setForm({ company_name: row.company_name ?? '', branch_id: row.branch_id ?? '', sales_user_id: row.sales_user_id ?? '', display_order: String(row.display_order ?? 0), is_active: row.is_active ?? true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm({ company_name: '', branch_id: selectedBranchId || '', sales_user_id: '', display_order: '0', is_active: true })
  }

  const filteredSalesUsers = useMemo(() => form.branch_id ? salesUsers.filter((u) => u.branch_id === form.branch_id) : salesUsers, [salesUsers, form.branch_id])
  const filteredRows = useMemo(() => selectedBranchId ? rows.filter((row) => row.branch_id === selectedBranchId) : rows, [rows, selectedBranchId])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div><h1 className="text-2xl font-bold text-slate-900">企業マスタ</h1><p className="mt-1 text-sm text-slate-600">入職・退職予定で選択する派遣先企業を管理します。</p></div>
        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{editingId ? '企業編集' : '企業登録'}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="企業名"><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="例：奥越部品" /></Field>
            <Field label="支店"><select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value, sales_user_id: '' })}><option value="">選択してください</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}</select></Field>
            <Field label="主担当"><select value={form.sales_user_id} onChange={(e) => setForm({ ...form, sales_user_id: e.target.value })}><option value="">未設定</option>{filteredSalesUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="表示順"><input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} /></Field>
            <Field label="状態"><select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">有効</option><option value="false">無効</option></select></Field>
          </div>
          <div className="mt-4 flex gap-2"><button onClick={handleSave} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{editingId ? '更新' : '登録'}</button><button onClick={resetForm} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">クリア</button></div>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 grid gap-4 md:grid-cols-[1fr_240px] md:items-end"><div><h2 className="text-lg font-bold text-slate-900">登録済み企業</h2><p className="text-sm text-slate-500">支店で絞り込めます。</p></div><select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}><option value="">全支店</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}</select></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr className="border-b bg-slate-100 text-left"><th className="px-3 py-2">企業名</th><th className="px-3 py-2">支店</th><th className="px-3 py-2">主担当</th><th className="px-3 py-2 text-right">表示順</th><th className="px-3 py-2">状態</th><th className="px-3 py-2">操作</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2 font-bold text-slate-900">{row.company_name}</td><td className="px-3 py-2">{row.branches?.branch_name ?? '-'}</td><td className="px-3 py-2">{row.sales_users?.name ?? '-'}</td><td className="px-3 py-2 text-right">{row.display_order ?? 0}</td><td className="px-3 py-2">{row.is_active ? '有効' : '無効'}</td><td className="px-3 py-2"><button onClick={() => handleEdit(row)} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">編集</button></td></tr>)}{filteredRows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">企業が登録されていません。</td></tr>}</tbody></table></div>
        </section>
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-sm font-bold text-slate-700">{label}</label>{children}</div> }
