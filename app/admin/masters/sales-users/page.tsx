'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Branch = { id: string; branch_name: string }
type SalesUser = {
  id: string
  name: string
  branch_id: string | null
  role: string | null
  display_order: number | null
  is_active: boolean | null
  branches: { branch_name: string | null } | null
}

export default function SalesUserMasterPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [rows, setRows] = useState<SalesUser[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', branch_id: '', role: 'sales', display_order: '0', is_active: true })

  useEffect(() => { initialize() }, [])

  async function initialize() { await Promise.all([fetchBranches(), fetchRows()]) }

  async function fetchBranches() {
    const { data, error } = await supabase.from('branches').select('id, branch_name').eq('is_active', true).order('display_order', { ascending: true })
    if (error) return setMessage(`支店マスタの取得に失敗しました：${error.message}`)
    setBranches(data ?? [])
  }

async function fetchRows() {
  const { data, error } = await supabase
    .from('sales_users')
    .select('id, name, branch_id, role, display_order, is_active, branches(branch_name)')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    setMessage(`担当者マスタの取得に失敗しました：${error.message}`)
    return
  }

  const normalizedRows = (data ?? []).map((row) => ({
    ...row,
    branches: Array.isArray(row.branches)
      ? row.branches[0] ?? null
      : row.branches ?? null,
  }))

  setRows(normalizedRows as SalesUser[])
}

  async function handleSave() {
    if (!form.name.trim() || !form.branch_id) return setMessage('氏名と所属支店は必須です。')
    setLoading(true); setMessage('')
    const payload = { name: form.name.trim(), branch_id: form.branch_id, role: form.role, display_order: Number(form.display_order || 0), is_active: form.is_active }
    const { error } = editingId ? await supabase.from('sales_users').update(payload).eq('id', editingId) : await supabase.from('sales_users').insert(payload)
    if (error) { setLoading(false); return setMessage(`保存に失敗しました：${error.message}`) }
    setMessage(editingId ? '担当者を更新しました。' : '担当者を登録しました。')
    resetForm(); await fetchRows(); setLoading(false)
  }

  function handleEdit(row: SalesUser) {
    setEditingId(row.id)
    setForm({ name: row.name ?? '', branch_id: row.branch_id ?? '', role: row.role ?? 'sales', display_order: String(row.display_order ?? 0), is_active: row.is_active ?? true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm({ name: '', branch_id: selectedBranchId || '', role: 'sales', display_order: '0', is_active: true })
  }

  const filteredRows = useMemo(() => selectedBranchId ? rows.filter((row) => row.branch_id === selectedBranchId) : rows, [rows, selectedBranchId])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div><h1 className="text-2xl font-bold text-slate-900">担当者マスタ</h1><p className="mt-1 text-sm text-slate-600">月次人員管理で使用する営業担当者を管理します。</p></div>
        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{editingId ? '担当者編集' : '担当者登録'}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="氏名"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：佐久間" /></Field>
            <Field label="所属支店"><select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}><option value="">選択してください</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}</select></Field>
            <Field label="役割"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="sales">営業</option><option value="manager">支店長</option><option value="office">事務</option></select></Field>
            <Field label="表示順"><input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} /></Field>
            <Field label="状態"><select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">有効</option><option value="false">無効</option></select></Field>
          </div>
          <div className="mt-4 flex gap-2"><button onClick={handleSave} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{editingId ? '更新' : '登録'}</button><button onClick={resetForm} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">クリア</button></div>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 grid gap-4 md:grid-cols-[1fr_240px] md:items-end"><div><h2 className="text-lg font-bold text-slate-900">登録済み担当者</h2><p className="text-sm text-slate-500">支店で絞り込めます。</p></div><select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}><option value="">全支店</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}</select></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b bg-slate-100 text-left"><th className="px-3 py-2">氏名</th><th className="px-3 py-2">所属支店</th><th className="px-3 py-2">役割</th><th className="px-3 py-2 text-right">表示順</th><th className="px-3 py-2">状態</th><th className="px-3 py-2">操作</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2 font-bold text-slate-900">{row.name}</td><td className="px-3 py-2">{row.branches?.branch_name ?? '-'}</td><td className="px-3 py-2">{row.role ?? '-'}</td><td className="px-3 py-2 text-right">{row.display_order ?? 0}</td><td className="px-3 py-2">{row.is_active ? '有効' : '無効'}</td><td className="px-3 py-2"><button onClick={() => handleEdit(row)} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">編集</button></td></tr>)}{filteredRows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">担当者が登録されていません。</td></tr>}</tbody></table></div>
        </section>
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-sm font-bold text-slate-700">{label}</label>{children}</div> }
