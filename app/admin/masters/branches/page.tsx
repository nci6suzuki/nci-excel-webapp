'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type Branch = {
  id: string
  branch_name: string
  display_order: number | null
  is_active: boolean | null
}

export default function BranchMasterPage() {
  const [rows, setRows] = useState<Branch[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ branch_name: '', display_order: '0', is_active: true })

  useEffect(() => { fetchRows() }, [])

  async function fetchRows() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, branch_name, display_order, is_active')
      .order('display_order', { ascending: true })
      .order('branch_name', { ascending: true })
    if (error) return setMessage(`支店マスタの取得に失敗しました：${error.message}`)
    setRows((data ?? []) as Branch[])
  }

  async function handleSave() {
    if (!form.branch_name.trim()) return setMessage('支店名を入力してください。')
    setLoading(true); setMessage('')
    const payload = {
      branch_name: form.branch_name.trim(),
      display_order: Number(form.display_order || 0),
      is_active: form.is_active,
    }
    const { error } = editingId
      ? await supabase.from('branches').update(payload).eq('id', editingId)
      : await supabase.from('branches').insert(payload)
    if (error) { setLoading(false); return setMessage(`保存に失敗しました：${error.message}`) }
    setMessage(editingId ? '支店を更新しました。' : '支店を登録しました。')
    resetForm(); await fetchRows(); setLoading(false)
  }

  function handleEdit(row: Branch) {
    setEditingId(row.id)
    setForm({ branch_name: row.branch_name ?? '', display_order: String(row.display_order ?? 0), is_active: row.is_active ?? true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm({ branch_name: '', display_order: '0', is_active: true })
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">支店マスタ</h1>
          <p className="mt-1 text-sm text-slate-600">月次人員管理で使用する支店を管理します。</p>
        </div>

        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{editingId ? '支店編集' : '支店登録'}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="支店名"><input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} placeholder="例：郡山" /></Field>
            <Field label="表示順"><input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} /></Field>
            <Field label="状態"><select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">有効</option><option value="false">無効</option></select></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{editingId ? '更新' : '登録'}</button>
            <button onClick={resetForm} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">クリア</button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">登録済み支店</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b bg-slate-100 text-left"><th className="px-3 py-2">支店名</th><th className="px-3 py-2 text-right">表示順</th><th className="px-3 py-2">状態</th><th className="px-3 py-2">操作</th></tr></thead>
              <tbody>
                {rows.map((row) => <tr key={row.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2 font-bold text-slate-900">{row.branch_name}</td><td className="px-3 py-2 text-right">{row.display_order ?? 0}</td><td className="px-3 py-2">{row.is_active ? '有効' : '無効'}</td><td className="px-3 py-2"><button onClick={() => handleEdit(row)} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">編集</button></td></tr>)}
                {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">支店が登録されていません。</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-bold text-slate-700">{label}</label>{children}</div>
}
