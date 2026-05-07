'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase/client'

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
  source_entry_plan_id: string | null
  source_exit_plan_id: string | null
  branches?: { branch_name: string } | { branch_name: string }[] | null
  companies?: { company_name: string } | { company_name: string }[] | null
  sales_users?: { name: string } | { name: string }[] | null
}

type TransferHistory = {
  id: string
  staff_name: string
  transfer_date: string
  transfer_reason: string | null
  memo: string | null
  created_at: string | null
  from_branches?: { branch_name: string } | { branch_name: string }[] | null
  from_companies?: { company_name: string } | { company_name: string }[] | null
  from_sales_users?: { name: string } | { name: string }[] | null
  to_branches?: { branch_name: string } | { branch_name: string }[] | null
  to_companies?: { company_name: string } | { company_name: string }[] | null
  to_sales_users?: { name: string } | { name: string }[] | null
}

type EntryPlan = {
  id: string
  worker_name: string | null
  entry_date: string | null
  tour_date: string | null
  certainty_rank: string | null
  selection_status: string | null
  status: string | null
  memo: string | null
  companies?: { company_name: string } | { company_name: string }[] | null
}

type ExitPlan = {
  id: string
  worker_name: string | null
  exit_date: string | null
  exit_reason: string | null
  reemployment_status: string | null
  status: string | null
  memo: string | null
  companies?: { company_name: string } | { company_name: string }[] | null
}

function relationName(value: any, key: string) {
  if (!value) return '-'
  if (Array.isArray(value)) return value[0]?.[key] ?? '-'
  return value[key] ?? '-'
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').normalize('NFKC').trim()
}

export default function StaffDetailPage() {
  const params = useParams()
  const staffId = String(params.id ?? '')

  const [staff, setStaff] = useState<CurrentStaff | null>(null)
  const [histories, setHistories] = useState<TransferHistory[]>([])
  const [entryPlans, setEntryPlans] = useState<EntryPlan[]>([])
  const [exitPlans, setExitPlans] = useState<ExitPlan[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDetail()
  }, [staffId])

  async function fetchDetail() {
    if (!staffId) return

    setLoading(true)
    setMessage('')

    const { data: staffData, error: staffError } = await supabase
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
        source_entry_plan_id,
        source_exit_plan_id,
        branches(branch_name),
        companies(company_name),
        sales_users(name)
      `)
      .eq('id', staffId)
      .maybeSingle()

    if (staffError) {
      setMessage(`スタッフ情報の取得に失敗しました：${staffError.message}`)
      setLoading(false)
      return
    }

    if (!staffData) {
      setMessage('スタッフ情報が見つかりません。')
      setLoading(false)
      return
    }

    const loadedStaff = staffData as unknown as CurrentStaff
    setStaff(loadedStaff)

    const [historyResult, entryResult, exitResult] = await Promise.all([
      supabase
        .from('staff_assignment_histories')
        .select(`
          id,
          staff_name,
          transfer_date,
          transfer_reason,
          memo,
          created_at,
          from_branches:branches!staff_assignment_histories_from_branch_id_fkey(branch_name),
          from_companies:companies!staff_assignment_histories_from_company_id_fkey(company_name),
          from_sales_users:sales_users!staff_assignment_histories_from_sales_user_id_fkey(name),
          to_branches:branches!staff_assignment_histories_to_branch_id_fkey(branch_name),
          to_companies:companies!staff_assignment_histories_to_company_id_fkey(company_name),
          to_sales_users:sales_users!staff_assignment_histories_to_sales_user_id_fkey(name)
        `)
        .eq('staff_assignment_id', staffId)
        .order('transfer_date', { ascending: false }),
      supabase
        .from('entry_plans')
        .select(`
          id,
          worker_name,
          entry_date,
          tour_date,
          certainty_rank,
          selection_status,
          status,
          memo,
          companies(company_name)
        `)
        .eq('company_id', loadedStaff.company_id)
        .ilike('worker_name', loadedStaff.staff_name)
        .order('entry_date', { ascending: false }),
      supabase
        .from('exit_plans')
        .select(`
          id,
          worker_name,
          exit_date,
          exit_reason,
          reemployment_status,
          status,
          memo,
          companies(company_name)
        `)
        .eq('company_id', loadedStaff.company_id)
        .ilike('worker_name', loadedStaff.staff_name)
        .order('exit_date', { ascending: false }),
    ])

    const firstError = historyResult.error || entryResult.error || exitResult.error
    if (firstError) {
      setMessage(`関連情報の取得に失敗しました：${firstError.message}`)
      setLoading(false)
      return
    }

    setHistories((historyResult.data ?? []) as unknown as TransferHistory[])
    setEntryPlans((entryResult.data ?? []) as unknown as EntryPlan[])
    setExitPlans((exitResult.data ?? []) as unknown as ExitPlan[])
    setLoading(false)
  }

  const statusTone = useMemo(() => {
    if (!staff) return 'bg-slate-100 text-slate-600'
    if (staff.employment_status === '退職予定') return 'bg-red-50 text-red-700'
    if (staff.employment_status === '終了') return 'bg-slate-100 text-slate-600'
    if (staff.employment_status === '休職中') return 'bg-yellow-50 text-yellow-700'
    return 'bg-blue-50 text-blue-700'
  }, [staff])

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link href="/admin/staff" className="text-sm font-bold text-blue-600 hover:underline">
            ← スタッフ検索へ戻る
          </Link>
        </div>

        {message && (
          <div className="whitespace-pre-wrap rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {!staff ? (
          <section className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
            {loading ? '読込中...' : 'スタッフ情報がありません。'}
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg md:p-8">
              <p className="text-sm font-semibold text-blue-200">Staff Detail</p>
              <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                    {staff.staff_name}
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-slate-200">
                    現在の就業先、担当者、異動履歴、入退職予定との紐づきを確認できます。
                  </p>
                </div>

                <span className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${statusTone}`}>
                  {staff.employment_status ?? '-'}
                </span>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="支店" value={relationName(staff.branches, 'branch_name')} />
              <InfoCard label="企業" value={relationName(staff.companies, 'company_name')} />
              <InfoCard label="担当者" value={relationName(staff.sales_users, 'name')} />
              <InfoCard label="就業開始日" value={staff.start_date ?? '-'} />
              <InfoCard label="退職予定日" value={staff.planned_exit_date ?? '-'} />
              <InfoCard label="終了日" value={staff.actual_exit_date ?? '-'} />
              <InfoCard label="表示対象" value={staff.is_active ? '表示' : '非表示'} />
              <InfoCard label="終了理由" value={staff.exit_reason ?? '-'} />
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">メモ</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {staff.memo || 'メモはありません。'}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900">配置変更履歴</h2>
                <p className="text-sm text-slate-500">このスタッフの異動・配置変更履歴です。</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-100 text-left">
                      <th className="px-3 py-2">異動日</th>
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
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          配置変更履歴はありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <RelatedEntryPlans rows={entryPlans} />
              <RelatedExitPlans rows={exitPlans} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-900">{value}</p>
    </div>
  )
}

function RelatedEntryPlans({ rows }: { rows: EntryPlan[] }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">関連する入職予定</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-slate-100 text-left">
              <th className="px-3 py-2">企業</th>
              <th className="px-3 py-2">見学日</th>
              <th className="px-3 py-2">入職日</th>
              <th className="px-3 py-2">確度</th>
              <th className="px-3 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2">{relationName(row.companies, 'company_name')}</td>
                <td className="px-3 py-2">{row.tour_date ?? '-'}</td>
                <td className="px-3 py-2">{row.entry_date ?? '-'}</td>
                <td className="px-3 py-2">{row.certainty_rank ?? '-'}</td>
                <td className="px-3 py-2">{row.status ?? '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">関連する入職予定はありません。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RelatedExitPlans({ rows }: { rows: ExitPlan[] }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">関連する退職予定</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-slate-100 text-left">
              <th className="px-3 py-2">企業</th>
              <th className="px-3 py-2">退職日</th>
              <th className="px-3 py-2">退職理由</th>
              <th className="px-3 py-2">再稼働</th>
              <th className="px-3 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2">{relationName(row.companies, 'company_name')}</td>
                <td className="px-3 py-2">{row.exit_date ?? '-'}</td>
                <td className="px-3 py-2">{row.exit_reason ?? '-'}</td>
                <td className="px-3 py-2">{row.reemployment_status ?? '-'}</td>
                <td className="px-3 py-2">{row.status ?? '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">関連する退職予定はありません。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
