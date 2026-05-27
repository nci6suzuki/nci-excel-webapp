'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '../../../lib/supabase/client'

type BackupTable = {
  key: string
  label: string
  table: string
  description: string
  enabled: boolean
}

const backupTables: BackupTable[] = [
  { key: 'branches', label: '支店マスタ', table: 'branches', description: '支店情報', enabled: true },
  { key: 'sales_users', label: '担当者マスタ', table: 'sales_users', description: '営業担当者情報', enabled: true },
  { key: 'companies', label: '企業マスタ', table: 'companies', description: '派遣先企業情報', enabled: true },
  { key: 'monthly_plans', label: '月次PLAN', table: 'monthly_plans', description: '月次人員PLAN', enabled: true },
  { key: 'entry_plans', label: '入職予定', table: 'entry_plans', description: '入職・見学・見込み情報', enabled: true },
  { key: 'exit_plans', label: '退職予定', table: 'exit_plans', description: '退職予定情報', enabled: true },
  { key: 'daily_results', label: '日次実績', table: 'daily_results', description: '日次実績情報', enabled: true },
  { key: 'current_staff_assignments', label: '就業中スタッフ', table: 'current_staff_assignments', description: 'スタッフ配置情報', enabled: true },
  { key: 'staff_assignment_histories', label: '配置変更履歴', table: 'staff_assignment_histories', description: '配置変更履歴', enabled: true },
  { key: 'user_roles', label: 'ユーザー権限', table: 'user_roles', description: 'ユーザー権限設定', enabled: true },
]

function getToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, '').slice(0, 31)
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {}
    Object.entries(row).forEach(([key, value]) => {
      if (value === null || value === undefined) normalized[key] = ''
      else if (typeof value === 'object') normalized[key] = JSON.stringify(value)
      else normalized[key] = value
    })
    return normalized
  })
}

export default function BackupPage() {
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>(() =>
    backupTables.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.key] = item.enabled
      return acc
    }, {})
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [lastResult, setLastResult] = useState<Record<string, number> | null>(null)

  const selectedTables = useMemo(() => backupTables.filter((item) => selectedKeys[item.key]), [selectedKeys])

  function toggleTable(key: string) {
    setSelectedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function selectAll() {
    setSelectedKeys(backupTables.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.key] = true
      return acc
    }, {}))
  }

  function clearAll() {
    setSelectedKeys(backupTables.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.key] = false
      return acc
    }, {}))
  }

  async function exportBackup() {
    if (selectedTables.length === 0) {
      setMessage('出力するテーブルを選択してください。')
      return
    }

    setLoading(true)
    setMessage('')
    setLastResult(null)

    const workbook = XLSX.utils.book_new()
    const resultCounts: Record<string, number> = {}
    const summaryRows: Record<string, unknown>[] = [
      { 項目: '出力日', 値: getToday() },
      { 項目: '出力対象数', 値: selectedTables.length },
    ]

    for (const item of selectedTables) {
      const { data, error } = await supabase.from(item.table).select('*')

      if (error) {
        setMessage(`${item.label} の取得に失敗しました：${error.message}`)
        setLoading(false)
        return
      }

      const rows = normalizeRows((data ?? []) as Record<string, unknown>[])
      resultCounts[item.label] = rows.length
      summaryRows.push({ 項目: item.label, 値: `${rows.length}件` })

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ message: 'データなし' }]),
        safeSheetName(item.label)
      )
    }

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), safeSheetName('バックアップ概要'))

    XLSX.writeFile(workbook, `${getToday()}_NCI管理システム_バックアップ.xlsx`)
    setLastResult(resultCounts)
    setMessage('バックアップExcelを出力しました。')
    setLoading(false)
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-900 to-blue-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-sky-100">Data Backup</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">データバックアップ</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            マスタ、月次人員管理、スタッフ配置、配置変更履歴をExcelで一括出力します。
          </p>
        </section>

        {message && (
          <div className="whitespace-pre-wrap rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="選択中" value={`${selectedTables.length}テーブル`} />
          <SummaryCard label="出力形式" value="Excel" />
          <SummaryCard label="推奨頻度" value="月次・更新前" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">バックアップ対象</h2>
              <p className="text-sm text-slate-500">出力したいデータを選択してください。</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={selectAll} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">全選択</button>
              <button onClick={clearAll} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">全解除</button>
              <button onClick={exportBackup} disabled={loading || selectedTables.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-50">
                {loading ? '出力中...' : 'バックアップ出力'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {backupTables.map((item) => (
              <label key={item.key} className={['cursor-pointer rounded-2xl border p-4 transition', selectedKeys[item.key] ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'].join(' ')}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={!!selectedKeys[item.key]} onChange={() => toggleTable(item.key)} className="mt-1 h-4 w-4" />
                  <div>
                    <p className="text-sm font-black text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    <p className="mt-2 font-mono text-[11px] font-bold text-slate-400">{item.table}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {lastResult && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">前回出力結果</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(lastResult).map(([label, count]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-700">{label}</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{count}<span className="ml-1 text-xs text-slate-500">件</span></p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-black text-amber-900">注意事項</h2>
          <div className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
            <p>・この機能はデータのExcel出力用です。復元機能ではありません。</p>
            <p>・本番運用前、月次締め後、大量取込前に出力しておくと安全です。</p>
            <p>・ユーザー権限データも含むため、出力ファイルの保管場所に注意してください。</p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Link href="/admin/deploy-check" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100">公開前チェックへ</Link>
          <Link href="/admin/system-check" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100">運用チェックへ</Link>
          <Link href="/admin/manual" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">運用マニュアルへ</Link>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  )
}
