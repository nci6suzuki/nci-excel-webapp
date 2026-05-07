'use client'

import { useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'

type ImportRow = {
  branch_name: string
  company_name: string
  sales_user_name: string
  staff_name: string
  start_date: string
  employment_status: string
  planned_exit_date: string
  memo: string
  is_active: string
}

type Branch = {
  id: string
  branch_name: string
}

type Company = {
  id: string
  company_name: string
  branch_id: string | null
  sales_user_id: string | null
}

type SalesUser = {
  id: string
  name: string
  branch_id: string | null
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim())

  if (lines.length <= 1) return []

  const headers = lines[0].split(',').map((header) => header.trim())

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim())
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })

    return {
      branch_name: row.branch_name ?? '',
      company_name: row.company_name ?? '',
      sales_user_name: row.sales_user_name ?? '',
      staff_name: row.staff_name ?? '',
      start_date: row.start_date ?? '',
      employment_status: row.employment_status || '就業中',
      planned_exit_date: row.planned_exit_date ?? '',
      memo: row.memo ?? '',
      is_active: row.is_active || 'true',
    } as ImportRow
  })
}

function downloadTemplate() {
  const csv = `branch_name,company_name,sales_user_name,staff_name,start_date,employment_status,planned_exit_date,memo,is_active
郡山,奥越部品,佐久間,山田太郎,2026-05-01,就業中,,備考,true
郡山,サンパック,大林,佐藤花子,2026-05-01,就業中,,備考,true
`

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'current_staff_template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function CurrentStaffImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleFileChange(file: File | null) {
    if (!file) return

    const text = await file.text()
    const parsedRows = parseCsv(text)

    setRows(parsedRows)
    setMessage(`${parsedRows.length}件を読み込みました。内容を確認してから取込してください。`)
  }

  async function handleImport() {
    if (rows.length === 0) {
      setMessage('CSVを読み込んでください。')
      return
    }

    setLoading(true)
    setMessage('')

    const [branchResult, companyResult, salesUserResult] = await Promise.all([
      supabase.from('branches').select('id, branch_name'),
      supabase.from('companies').select('id, company_name, branch_id, sales_user_id'),
      supabase.from('sales_users').select('id, name, branch_id'),
    ])

    const firstError =
      branchResult.error ||
      companyResult.error ||
      salesUserResult.error

    if (firstError) {
      setMessage(`マスタ取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    const branches = (branchResult.data ?? []) as Branch[]
    const companies = (companyResult.data ?? []) as Company[]
    const salesUsers = (salesUserResult.data ?? []) as SalesUser[]

    const errors: string[] = []
    const payloads = rows.map((row, index) => {
      const line = index + 2

      const branch = branches.find((item) => item.branch_name === row.branch_name)
      if (!branch) {
        errors.push(`${line}行目：支店「${row.branch_name}」が見つかりません。`)
        return null
      }

      const company = companies.find((item) => {
        return item.branch_id === branch.id && item.company_name === row.company_name
      })
      if (!company) {
        errors.push(`${line}行目：企業「${row.company_name}」が見つかりません。`)
        return null
      }

      let salesUserId: string | null = company.sales_user_id ?? null

      if (row.sales_user_name) {
        const salesUser = salesUsers.find((item) => {
          return item.branch_id === branch.id && item.name === row.sales_user_name
        })

        if (!salesUser) {
          errors.push(`${line}行目：担当者「${row.sales_user_name}」が見つかりません。`)
          return null
        }

        salesUserId = salesUser.id
      }

      if (!row.staff_name) {
        errors.push(`${line}行目：スタッフ名が空です。`)
        return null
      }

      return {
        branch_id: branch.id,
        company_id: company.id,
        sales_user_id: salesUserId,
        staff_name: row.staff_name,
        start_date: row.start_date || null,
        employment_status: row.employment_status || '就業中',
        planned_exit_date: row.planned_exit_date || null,
        memo: row.memo || null,
        is_active: row.is_active !== 'false',
      }
    }).filter(Boolean)

    if (errors.length > 0) {
      setMessage(errors.slice(0, 10).join('\n'))
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('current_staff_assignments')
      .insert(payloads)

    if (error) {
      setMessage(`取込に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    setMessage(`${payloads.length}件の就業中スタッフを取り込みました。`)
    setRows([])
    setLoading(false)
  }

  const summary = useMemo(() => {
    const working = rows.filter((row) => row.employment_status === '就業中').length
    const leave = rows.filter((row) => row.employment_status === '休職中').length
    const plannedExit = rows.filter((row) => row.employment_status === '退職予定').length

    return {
      total: rows.length,
      working,
      leave,
      plannedExit,
    }
  }, [rows])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-semibold text-blue-200">
            Current Staff Import
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            就業中スタッフ一括取込
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            CSVから就業中スタッフをまとめて登録します。登録したスタッフはマップ図の企業カード内に表示されます。
          </p>
        </section>

        {message && (
          <div className="whitespace-pre-wrap rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              CSV取込
            </h2>
            <p className="text-sm text-slate-500">
              支店名・企業名・担当者名は、登録済みマスタと一致している必要があります。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                CSVファイル
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={downloadTemplate}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              雛形ダウンロード
            </button>

            <button
              onClick={handleImport}
              disabled={loading || rows.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? '取込中...' : '取込実行'}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="読込件数" value={summary.total} suffix="件" />
          <SummaryCard label="就業中" value={summary.working} suffix="名" />
          <SummaryCard label="休職中" value={summary.leave} suffix="名" />
          <SummaryCard label="退職予定" value={summary.plannedExit} suffix="名" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              取込プレビュー
            </h2>
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
                  <th className="px-3 py-2">メモ</th>
                  <th className="px-3 py-2">表示</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.staff_name}-${index}`} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{row.branch_name}</td>
                    <td className="px-3 py-2">{row.company_name}</td>
                    <td className="px-3 py-2">{row.sales_user_name}</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{row.staff_name}</td>
                    <td className="px-3 py-2">{row.start_date}</td>
                    <td className="px-3 py-2">{row.employment_status}</td>
                    <td className="px-3 py-2">{row.planned_exit_date}</td>
                    <td className="px-3 py-2">{row.memo}</td>
                    <td className="px-3 py-2">{row.is_active}</td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                      CSVを読み込むと、ここにプレビューが表示されます。
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
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span>}
      </p>
    </div>
  )
}
