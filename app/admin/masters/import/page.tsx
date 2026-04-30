'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type ImportType = 'branches' | 'sales_users' | 'companies'
type Row = Record<string, string>
type Branch = { id: string; branch_name: string }
type SalesUser = { id: string; name: string; branch_id: string | null }

const required: Record<ImportType, string[]> = {
  branches: ['branch_name'],
  sales_users: ['branch_name', 'name'],
  companies: ['branch_name', 'company_name'],
}

const samples: Record<ImportType, string[]> = {
  branches: ['branch_name', 'display_order', 'is_active'],
  sales_users: ['branch_name', 'name', 'role', 'display_order', 'is_active'],
  companies: ['branch_name', 'company_name', 'sales_user_name', 'display_order', 'is_active'],
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(',').map((v) => v.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])) as Row
  })
}

function bool(v: string, d = true) {
  const t = String(v ?? '').normalize('NFKC').trim().toLowerCase()
  if (!t) return d
  return ['true', '1', '有効', '○', 'yes'].includes(t)
}

function num(v: string) {
  const n = Number(v || 0)
  return Number.isFinite(n) ? n : 0
}

export default function MasterImportPage() {
  const [type, setType] = useState<ImportType>('branches')
  const [rows, setRows] = useState<Row[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchMasters() }, [])

  async function fetchMasters() {
    const [b, s] = await Promise.all([
      supabase.from('branches').select('id, branch_name'),
      supabase.from('sales_users').select('id, name, branch_id'),
    ])
    setBranches((b.data ?? []) as Branch[])
    setSalesUsers((s.data ?? []) as SalesUser[])
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseCsv(text)
    setRows(parsed)
    const missing = required[type].filter((c) => !parsed[0] || !(c in parsed[0]))
    setMessage(missing.length ? `必要な列がありません：${missing.join(', ')}` : `${parsed.length}件を読み込みました。`)
  }

  async function handleImport() {
    if (!rows.length) return setMessage('取込対象がありません。')
    setLoading(true)
    setMessage('')
    if (type === 'branches') await importBranches()
    if (type === 'sales_users') await importSalesUsers()
    if (type === 'companies') await importCompanies()
    await fetchMasters()
    setLoading(false)
  }

  async function importBranches() {
    const payload = rows.filter(r => r.branch_name).map(r => ({ branch_name: r.branch_name, display_order: num(r.display_order), is_active: bool(r.is_active) }))
    const { error } = await supabase.from('branches').upsert(payload, { onConflict: 'branch_name' })
    setMessage(error ? `取込失敗：${error.message}` : `支店マスタを${payload.length}件取り込みました。`)
  }

  async function importSalesUsers() {
    const branchMap = new Map(branches.map(b => [b.branch_name, b.id]))
    const payload = rows.map(r => ({ branch_id: branchMap.get(r.branch_name), name: r.name, role: r.role || 'sales', display_order: num(r.display_order), is_active: bool(r.is_active) })).filter(r => r.branch_id && r.name)
    const { error } = await supabase.from('sales_users').upsert(payload, { onConflict: 'branch_id,name' })
    setMessage(error ? `取込失敗：${error.message}` : `担当者マスタを${payload.length}件取り込みました。`)
  }

  async function importCompanies() {
    const branchMap = new Map(branches.map(b => [b.branch_name, b.id]))
    const userMap = new Map(salesUsers.map(u => [`${u.branch_id}_${u.name}`, u.id]))
    const payload = rows.map(r => {
      const branchId = branchMap.get(r.branch_name)
      return { branch_id: branchId, company_name: r.company_name, sales_user_id: r.sales_user_name ? userMap.get(`${branchId}_${r.sales_user_name}`) ?? null : null, display_order: num(r.display_order), is_active: bool(r.is_active) }
    }).filter(r => r.branch_id && r.company_name)
    const { error } = await supabase.from('companies').upsert(payload, { onConflict: 'branch_id,company_name' })
    setMessage(error ? `取込失敗：${error.message}` : `企業マスタを${payload.length}件取り込みました。`)
  }

  function downloadTemplate() {
    const body = type === 'branches' ? '郡山,1,true' : type === 'sales_users' ? '郡山,佐久間,sales,1,true' : '郡山,奥越部品,佐久間,1,true'
    const csv = '\uFEFF' + samples[type].join(',') + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${type}_template.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const columns = useMemo(() => rows[0] ? Object.keys(rows[0]) : samples[type], [rows, type])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">マスタ一括取込</h1>
          <p className="mt-1 text-sm text-slate-600">CSVから支店・担当者・企業マスタを一括登録します。</p>
        </div>
        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <select value={type} onChange={e => { setType(e.target.value as ImportType); setRows([]); setMessage('') }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="branches">支店マスタ</option><option value="sales_users">担当者マスタ</option><option value="companies">企業マスタ</option>
            </select>
            <input type="file" accept=".csv" onChange={handleFile} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={downloadTemplate} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">CSV雛形</button>
            <button onClick={handleImport} disabled={loading || !rows.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">取込実行</button>
          </div>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">プレビュー</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b bg-slate-100 text-left">{columns.map(c => <th key={c} className="px-3 py-2">{c}</th>)}</tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i} className="border-b">{columns.map(c=><td key={c} className="px-3 py-2">{r[c] ?? ''}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">CSVを選択してください。</td></tr>}</tbody></table>
          </div>
        </section>
      </div>
    </div>
  )
}
