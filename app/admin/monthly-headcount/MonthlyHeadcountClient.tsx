'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import * as XLSX from 'xlsx'

type Branch = {
  id: string
  branch_name: string
}

type SalesUser = {
  id: string
  name: string
  branch_id: string | null
  role: string | null
}

type Company = {
  id: string
  company_name: string
  branch_id: string | null
  sales_user_id?: string | null
}

type MonthlyPlan = {
  id: string
  branch_id: string | null
  sales_user_id: string | null
  target_month: string
  headcount_plan: number | null
  start_headcount: number | null
}

type EntryPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  company_id: string | null
  tour_date: string | null
  selection_status: string | null
  entry_date: string | null
  certainty_rank: string | null
  status: string | null
  memo: string | null
  companies?: {
    company_name: string
  } | null
  sales_users?: {
    name: string
  } | null
}

type ExitPlan = {
  id: string
  worker_name: string | null
  branch_id: string | null
  sales_user_id: string | null
  company_id: string | null
  exit_date: string | null
  exit_reason: string | null
  reemployment_status: string | null
  next_job: string | null
  status: string | null
  memo: string | null
  companies?: {
    company_name: string
  } | null
  sales_users?: {
    name: string
  } | null
}

type DailyResult = {
  id: string
  result_date: string
  branch_id: string | null
  sales_user_id: string | null
  new_count: number | null
  increase_count: number | null
  exit_count: number | null
  transaction_count: number | null
  status: string | null
  new_orders_count: number | null
  visit_count: number | null
  interview_count: number | null
  memo: string | null
  sales_users?: {
    name: string
  } | null
}

const certaintyOptions = ['確定', 'A見込み', 'B見込み', 'C見込み']
const entryStatusOptions = ['予定', '確定', '入職済み', '取消']
const selectionStatusOptions = [
  '未対応',
  '人選中',
  '提案済み',
  '見学予定',
  '見学済み',
  '採用',
  '不採用',
  '辞退',
  '保留',
]

const exitStatusOptions = ['予定', '確定', '退職済み', '取消']
const reemploymentOptions = ['○', '×', '未定', '対象外']
const exitReasonOptions = [
  '契約満了',
  '自己都合',
  '会社都合',
  '家庭都合',
  '体調不良',
  '無断欠勤',
  '派遣先都合',
  '転職',
  '期間満了',
  'その他',
]

function getMonthRange(month: string) {
  const start = `${month}-01`
  const startDate = new Date(`${month}-01T00:00:00`)
  const nextMonth = new Date(startDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const yyyy = nextMonth.getFullYear()
  const mm = String(nextMonth.getMonth() + 1).padStart(2, '0')
  const end = `${yyyy}-${mm}-01`

  return { start, end }
}

function getCurrentMonth() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getTargetMonthDate(month: string) {
  return `${month}-01`
}

type MonthlyHeadcountMode = 'input' | 'report' | 'list'

export default function MonthlyHeadcountClient({ mode }: { mode: MonthlyHeadcountMode }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedSalesUserId, setSelectedSalesUserId] = useState('')
  const [targetMonth, setTargetMonth] = useState(getCurrentMonth())

  const [monthlyPlanId, setMonthlyPlanId] = useState<string | null>(null)
  const [headcountPlan, setHeadcountPlan] = useState<number>(0)
  const [startHeadcount, setStartHeadcount] = useState<number>(0)

  const [entryPlans, setEntryPlans] = useState<EntryPlan[]>([])
  const [exitPlans, setExitPlans] = useState<ExitPlan[]>([])
  const [dailyResults, setDailyResults] = useState<DailyResult[]>([])

  const [loading, setLoading] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [monthlyPlansForUsers, setMonthlyPlansForUsers] = useState<MonthlyPlan[]>([])
  const [message, setMessage] = useState('')

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingExitId, setEditingExitId] = useState<string | null>(null)
  const [editingDailyResultId, setEditingDailyResultId] = useState<string | null>(null)

  const [entryForm, setEntryForm] = useState({
    worker_name: '',
    company_id: '',
    sales_user_id: '',
    tour_date: '',
    selection_status: '未対応',
    entry_date: '',
    certainty_rank: 'A見込み',
    status: '予定',
    memo: '',
  })

  const [exitForm, setExitForm] = useState({
    worker_name: '',
    company_id: '',
    sales_user_id: '',
    exit_date: '',
    exit_reason: '契約満了',
    reemployment_status: '未定',
    next_job: '',
    status: '予定',
    memo: '',
  })

  const [dailyResultForm, setDailyResultForm] = useState({
    result_date: `${getCurrentMonth()}-01`,
    sales_user_id: '',
    new_count: '0',
    increase_count: '0',
    exit_count: '0',
    transaction_count: '0',
    memo: '',
  })

  useEffect(() => {
    fetchBranches()
  }, [])

  useEffect(() => {
    if (!selectedBranchId) return

    fetchSalesUsers(selectedBranchId)
    fetchCompanies(selectedBranchId)

    setSelectedSalesUserId('')
    setEntryForm((prev) => ({
      ...prev,
      sales_user_id: '',
      company_id: '',
    }))
    setExitForm((prev) => ({
      ...prev,
      sales_user_id: '',
      company_id: '',
    }))
    setDailyResultForm((prev) => ({
      ...prev,
      sales_user_id: '',
    }))
  }, [selectedBranchId])

  useEffect(() => {
    if (!selectedBranchId || !targetMonth) return

    fetchMonthlyPlan()
    fetchMonthlyPlansForUsers()
    fetchPlans()
    fetchDailyResults()
  }, [selectedBranchId, selectedSalesUserId, targetMonth])

  async function fetchBranches() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, branch_name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error(error)
      setMessage('支店マスタの取得に失敗しました。')
      return
    }

    setBranches(data ?? [])

    if (data && data.length > 0) {
      setSelectedBranchId(data[0].id)
    }
  }

  async function fetchSalesUsers(branchId: string) {
    const { data, error } = await supabase
      .from('sales_users')
      .select('id, name, branch_id, role')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error(error)
      setMessage('担当者マスタの取得に失敗しました。')
      return
    }

    setSalesUsers(data ?? [])
  }

  async function fetchCompanies(branchId: string) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, branch_id, sales_user_id')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('company_name', { ascending: true })

    if (error) {
      console.error(error)
      setMessage('企業マスタの取得に失敗しました。')
      return
    }

    setCompanies(data ?? [])
  }

  async function fetchMonthlyPlan() {
    if (!selectedBranchId || !targetMonth) return

    const targetMonthDate = getTargetMonthDate(targetMonth)

    let query = supabase
      .from('monthly_plans')
      .select('id, branch_id, sales_user_id, target_month, headcount_plan, start_headcount')
      .eq('branch_id', selectedBranchId)
      .eq('target_month', targetMonthDate)

    if (selectedSalesUserId) {
      query = query.eq('sales_user_id', selectedSalesUserId)
    } else {
      query = query.is('sales_user_id', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('monthly plan fetch error:', error)
      setMessage(`月次PLANの取得に失敗しました：${error.message}`)
      return
    }

    if (!data) {
      setMonthlyPlanId(null)
      setHeadcountPlan(0)
      setStartHeadcount(0)
      return
    }

    const plan = data as MonthlyPlan

    setMonthlyPlanId(plan.id)
    setHeadcountPlan(plan.headcount_plan ?? 0)
    setStartHeadcount(plan.start_headcount ?? 0)
  }

  async function fetchMonthlyPlansForUsers() {
    if (!selectedBranchId || !targetMonth) return

    const targetMonthDate = getTargetMonthDate(targetMonth)

    const { data, error } = await supabase
      .from('monthly_plans')
      .select('id, branch_id, sales_user_id, target_month, headcount_plan, start_headcount')
      .eq('branch_id', selectedBranchId)
      .eq('target_month', targetMonthDate)
      .not('sales_user_id', 'is', null)

    if (error) {
      console.error('monthly plans for users fetch error:', error)
      setMessage(`担当者別PLANの取得に失敗しました：${error.message}`)
      return
    }

    setMonthlyPlansForUsers((data ?? []) as MonthlyPlan[])
  }

  async function handleSaveMonthlyPlan() {
    if (!selectedBranchId || !targetMonth) {
      setMessage('支店と対象月を選択してください。')
      return
    }

    setSavingPlan(true)
    setMessage('')

    const targetMonthDate = getTargetMonthDate(targetMonth)

    const payload = {
      branch_id: selectedBranchId,
      sales_user_id: selectedSalesUserId || null,
      target_month: targetMonthDate,
      headcount_plan: headcountPlan,
      start_headcount: startHeadcount,
    }

    if (monthlyPlanId) {
      const { error } = await supabase
        .from('monthly_plans')
        .update(payload)
        .eq('id', monthlyPlanId)

      if (error) {
        console.error('monthly plan update error:', error)
        setMessage(`月次PLANの更新に失敗しました：${error.message}`)
        setSavingPlan(false)
        return
      }

      setMessage('月次PLANを更新しました。')
      await fetchMonthlyPlansForUsers()
      setSavingPlan(false)
      return
    }

    const { data, error } = await supabase
      .from('monthly_plans')
      .insert(payload)
      .select('id')
      .single()

    if (error) {
      console.error('monthly plan insert error:', error)
      setMessage(`月次PLANの登録に失敗しました：${error.message}`)
      setSavingPlan(false)
      return
    }

    setMonthlyPlanId(data.id)
    setMessage('月次PLANを登録しました。')
    await fetchMonthlyPlansForUsers()
    setSavingPlan(false)
  }

  async function fetchPlans() {
    setLoading(true)
    setMessage('')

    const { start, end } = getMonthRange(targetMonth)

    let entryQuery = supabase
      .from('entry_plans')
      .select(`
        id,
        worker_name,
        branch_id,
        sales_user_id,
        company_id,
        tour_date,
        selection_status,
        entry_date,
        certainty_rank,
        status,
        memo,
        companies (
          company_name
        ),
        sales_users (
          name
        )
      `)
      .eq('branch_id', selectedBranchId)
      .or(
        `and(entry_date.gte.${start},entry_date.lt.${end}),and(tour_date.gte.${start},tour_date.lt.${end})`
      )
      .order('entry_date', { ascending: true, nullsFirst: false })

    let exitQuery = supabase
      .from('exit_plans')
      .select(`
        id,
        worker_name,
        branch_id,
        sales_user_id,
        company_id,
        exit_date,
        exit_reason,
        reemployment_status,
        next_job,
        status,
        memo,
        companies (
          company_name
        ),
        sales_users (
          name
        )
      `)
      .eq('branch_id', selectedBranchId)
      .gte('exit_date', start)
      .lt('exit_date', end)
      .order('exit_date', { ascending: true })

    if (selectedSalesUserId) {
      entryQuery = entryQuery.eq('sales_user_id', selectedSalesUserId)
      exitQuery = exitQuery.eq('sales_user_id', selectedSalesUserId)
    }

    const [entryResult, exitResult] = await Promise.all([
      entryQuery,
      exitQuery,
    ])

    if (entryResult.error) {
      console.error(entryResult.error)
      setMessage('入職予定一覧の取得に失敗しました。')
    } else {
      setEntryPlans((entryResult.data ?? []) as EntryPlan[])
    }

    if (exitResult.error) {
      console.error(exitResult.error)
      setMessage('退職予定一覧の取得に失敗しました。')
    } else {
      setExitPlans((exitResult.data ?? []) as ExitPlan[])
    }

    setLoading(false)
  }


  async function fetchDailyResults() {
    if (!selectedBranchId || !targetMonth) return

    const { start, end } = getMonthRange(targetMonth)

    let query = supabase
      .from('daily_results')
      .select(`
        id,
        result_date,
        branch_id,
        sales_user_id,
        new_count,
        increase_count,
        exit_count,
        transaction_count,
        status,
        new_orders_count,
        visit_count,
        interview_count,
        memo,
        sales_users (
          name
        )
      `)
      .eq('branch_id', selectedBranchId)
      .gte('result_date', start)
      .lt('result_date', end)
      .order('result_date', { ascending: true })

    if (selectedSalesUserId) {
      query = query.eq('sales_user_id', selectedSalesUserId)
    }

    const { data, error } = await query

    if (error) {
      console.error('daily results fetch error:', error)
      setMessage(`日次実績の取得に失敗しました：${error.message}`)
      return
    }

    setDailyResults((data ?? []) as DailyResult[])
  }

  async function handleCreateDailyResult() {
    if (!selectedBranchId) {
      setMessage('支店を選択してください。')
      return
    }

    if (!dailyResultForm.sales_user_id || !dailyResultForm.result_date) {
      setMessage('日次実績は、担当者と日付が必須です。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('daily_results')
      .insert({
        branch_id: selectedBranchId,
        sales_user_id: dailyResultForm.sales_user_id,
        result_date: dailyResultForm.result_date,
        new_count: Number(dailyResultForm.new_count || 0),
        increase_count: Number(dailyResultForm.increase_count || 0),
        exit_count: Number(dailyResultForm.exit_count || 0),
        transaction_count: Number(dailyResultForm.transaction_count || 0),
        status: '有効',
        memo: dailyResultForm.memo || null,
      })

    if (error) {
      console.error('daily result insert error:', error)
      setMessage(`日次実績の登録に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    resetDailyResultForm(dailyResultForm.result_date)

    setMessage('日次実績を登録しました。')
    await fetchDailyResults()
    setLoading(false)
  }


  function resetDailyResultForm(resultDate?: string) {
    setEditingDailyResultId(null)

    setDailyResultForm({
      result_date: resultDate || dailyResultForm.result_date || `${getCurrentMonth()}-01`,
      sales_user_id: selectedSalesUserId || '',
      new_count: '0',
      increase_count: '0',
      exit_count: '0',
      transaction_count: '0',
      memo: '',
    })
  }

  function handleStartEditDailyResult(result: DailyResult) {
    setEditingDailyResultId(result.id)

    setDailyResultForm({
      result_date: result.result_date ?? `${getCurrentMonth()}-01`,
      sales_user_id: result.sales_user_id ?? '',
      new_count: String(result.new_count ?? 0),
      increase_count: String(result.increase_count ?? 0),
      exit_count: String(result.exit_count ?? 0),
      transaction_count: String(result.transaction_count ?? 0),
      memo: result.memo ?? '',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function handleUpdateDailyResult() {
    if (!editingDailyResultId) return

    if (!selectedBranchId) {
      setMessage('支店を選択してください。')
      return
    }

    if (!dailyResultForm.sales_user_id || !dailyResultForm.result_date) {
      setMessage('日次実績は、担当者と日付が必須です。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('daily_results')
      .update({
        branch_id: selectedBranchId,
        sales_user_id: dailyResultForm.sales_user_id,
        result_date: dailyResultForm.result_date,
        new_count: Number(dailyResultForm.new_count || 0),
        increase_count: Number(dailyResultForm.increase_count || 0),
        exit_count: Number(dailyResultForm.exit_count || 0),
        transaction_count: Number(dailyResultForm.transaction_count || 0),
        status: '有効',
        memo: dailyResultForm.memo || null,
      })
      .eq('id', editingDailyResultId)

    if (error) {
      console.error('daily result update error:', error)
      setMessage(`日次実績の更新に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    resetDailyResultForm(dailyResultForm.result_date)
    setMessage('日次実績を更新しました。')
    await fetchDailyResults()
    setLoading(false)
  }

  async function handleCancelDailyResult(id: string) {
    const ok = window.confirm('この日次実績を取消にしますか？')
    if (!ok) return

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('daily_results')
      .update({ status: '取消' })
      .eq('id', id)

    if (error) {
      console.error('daily result cancel error:', error)
      setMessage(`日次実績の取消に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    setMessage('日次実績を取消にしました。')
    await fetchDailyResults()
    setLoading(false)
  }

  async function handleCreateEntry() {
    if (!selectedBranchId) {
      setMessage('支店を選択してください。')
      return
    }

    if (
      !entryForm.worker_name ||
      !entryForm.company_id ||
      !entryForm.sales_user_id
    ) {
      setMessage('入職登録は、氏名・企業・担当者が必須です。')
      return
    }

    if (!entryForm.tour_date && !entryForm.entry_date) {
      setMessage('見学日または入職予定日のどちらかを入力してください。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('entry_plans')
      .insert({
        branch_id: selectedBranchId,
        sales_user_id: entryForm.sales_user_id,
        company_id: entryForm.company_id,
        worker_name: entryForm.worker_name,
        tour_date: entryForm.tour_date || null,
        selection_status: entryForm.selection_status,
        entry_date: entryForm.entry_date || null,
        certainty_rank: entryForm.certainty_rank,
        status: entryForm.status,
        memo: entryForm.memo || null,
      })

    if (error) {
      console.error('entry insert error:', error)
      setMessage(`入職予定の登録に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    resetEntryForm()

    setMessage('入職予定を登録しました。')
    await fetchPlans()
    setLoading(false)
  }


  function resetEntryForm() {
    setEditingEntryId(null)

    setEntryForm({
      worker_name: '',
      company_id: '',
      sales_user_id: selectedSalesUserId || '',
      tour_date: '',
      selection_status: '未対応',
      entry_date: '',
      certainty_rank: 'A見込み',
      status: '予定',
      memo: '',
    })
  }

  function handleStartEditEntry(plan: EntryPlan) {
    setEditingEntryId(plan.id)

    setEntryForm({
      worker_name: plan.worker_name ?? '',
      company_id: plan.company_id ?? '',
      sales_user_id: plan.sales_user_id ?? '',
      tour_date: plan.tour_date ?? '',
      selection_status: plan.selection_status ?? '未対応',
      entry_date: plan.entry_date ?? '',
      certainty_rank: plan.certainty_rank ?? 'A見込み',
      status: plan.status ?? '予定',
      memo: plan.memo ?? '',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function handleUpdateEntry() {
    if (!editingEntryId) return

    if (
      !entryForm.worker_name ||
      !entryForm.company_id ||
      !entryForm.sales_user_id
    ) {
      setMessage('入職更新は、氏名・企業・担当者が必須です。')
      return
    }

    if (!entryForm.tour_date && !entryForm.entry_date) {
      setMessage('見学日または入職予定日のどちらかを入力してください。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('entry_plans')
      .update({
        sales_user_id: entryForm.sales_user_id,
        company_id: entryForm.company_id,
        worker_name: entryForm.worker_name,
        tour_date: entryForm.tour_date || null,
        selection_status: entryForm.selection_status,
        entry_date: entryForm.entry_date || null,
        certainty_rank: entryForm.certainty_rank,
        status: entryForm.status,
        memo: entryForm.memo || null,
      })
      .eq('id', editingEntryId)

    if (error) {
      console.error('entry update error:', error)
      setMessage(`入職予定の更新に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    resetEntryForm()
    setMessage('入職予定を更新しました。')
    await fetchPlans()
    setLoading(false)
  }

  async function handleCreateExit() {
    if (!selectedBranchId) {
      setMessage('支店を選択してください。')
      return
    }

    if (!exitForm.worker_name || !exitForm.company_id || !exitForm.sales_user_id || !exitForm.exit_date) {
      setMessage('退職登録は、氏名・企業・担当者・退職予定日が必須です。')
      return
    }

    if (exitForm.status === '確定' && !exitForm.reemployment_status) {
      setMessage('退職確定の場合は、再稼働有無を入力してください。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.from('exit_plans').insert({
      branch_id: selectedBranchId,
      sales_user_id: exitForm.sales_user_id,
      company_id: exitForm.company_id,
      worker_name: exitForm.worker_name,
      exit_date: exitForm.exit_date,
      exit_reason: exitForm.exit_reason,
      reemployment_status: exitForm.reemployment_status,
      next_job: exitForm.next_job || null,
      status: exitForm.status,
      memo: exitForm.memo || null,
    })

    if (error) {
      console.error(error)
      setMessage(`退職予定の登録に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    resetExitForm()

    setMessage('退職予定を登録しました。')
    await fetchPlans()
    setLoading(false)
  }



  function resetExitForm() {
    setEditingExitId(null)

    setExitForm({
      worker_name: '',
      company_id: '',
      sales_user_id: selectedSalesUserId || '',
      exit_date: '',
      exit_reason: '契約満了',
      reemployment_status: '未定',
      next_job: '',
      status: '予定',
      memo: '',
    })
  }

  function handleStartEditExit(plan: ExitPlan) {
    setEditingExitId(plan.id)

    setExitForm({
      worker_name: plan.worker_name ?? '',
      company_id: plan.company_id ?? '',
      sales_user_id: plan.sales_user_id ?? '',
      exit_date: plan.exit_date ?? '',
      exit_reason: plan.exit_reason ?? '契約満了',
      reemployment_status: plan.reemployment_status ?? '未定',
      next_job: plan.next_job ?? '',
      status: plan.status ?? '予定',
      memo: plan.memo ?? '',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function handleUpdateExit() {
    if (!editingExitId) return

    if (
      !exitForm.worker_name ||
      !exitForm.company_id ||
      !exitForm.sales_user_id ||
      !exitForm.exit_date
    ) {
      setMessage('退職更新は、氏名・企業・担当者・退職予定日が必須です。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('exit_plans')
      .update({
        sales_user_id: exitForm.sales_user_id,
        company_id: exitForm.company_id,
        worker_name: exitForm.worker_name,
        exit_date: exitForm.exit_date,
        exit_reason: exitForm.exit_reason,
        reemployment_status: exitForm.reemployment_status,
        next_job: exitForm.next_job || null,
        status: exitForm.status,
        memo: exitForm.memo || null,
      })
      .eq('id', editingExitId)

    if (error) {
      console.error('exit update error:', error)
      setMessage(`退職予定の更新に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    resetExitForm()
    setMessage('退職予定を更新しました。')
    await fetchPlans()
    setLoading(false)
  }

  async function handleCancelEntry(id: string) {
    const ok = window.confirm('この入職予定を取消にしますか？')
    if (!ok) return

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('entry_plans')
      .update({ status: '取消' })
      .eq('id', id)

    if (error) {
      console.error('entry cancel error:', error)
      setMessage(`入職予定の取消に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    setMessage('入職予定を取消にしました。')
    await fetchPlans()
    setLoading(false)
  }

  async function handleCancelExit(id: string) {
    const ok = window.confirm('この退職予定を取消にしますか？')
    if (!ok) return

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('exit_plans')
      .update({ status: '取消' })
      .eq('id', id)

    if (error) {
      console.error('exit cancel error:', error)
      setMessage(`退職予定の取消に失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    setMessage('退職予定を取消にしました。')
    await fetchPlans()
    setLoading(false)
  }

  const summary = useMemo(() => {
    const normalizeText = (value: string | null | undefined) => {
      return String(value ?? '').normalize('NFKC').trim()
    }

    const activeEntryPlans = entryPlans.filter((item) => {
      return normalizeText(item.status) !== '取消'
    })

    const activeExitPlans = exitPlans.filter((item) => {
      return normalizeText(item.status) !== '取消'
    })

    const isEntryConfirmed = (item: EntryPlan) => {
      const certainty = normalizeText(item.certainty_rank)
      const status = normalizeText(item.status)

      return (
        certainty === '確定' ||
        status === '確定' ||
        status === '入職済み'
      )
    }

    const entryConfirmed = activeEntryPlans.filter(isEntryConfirmed).length

    const entryProspects = activeEntryPlans.filter((item) => {
      return !isEntryConfirmed(item)
    })

    const exitConfirmed = activeExitPlans.filter((item) => {
      const status = normalizeText(item.status)
      return status === '確定' || status === '退職済み'
    }).length

    const aCount = entryProspects.filter((item) => {
      const certainty = normalizeText(item.certainty_rank)
      return certainty.includes('A')
    }).length

    const bCount = entryProspects.filter((item) => {
      const certainty = normalizeText(item.certainty_rank)
      return certainty.includes('B')
    }).length

    const cCount = entryProspects.filter((item) => {
      const certainty = normalizeText(item.certainty_rank)
      return certainty.includes('C')
    }).length

    const reemploymentCount = activeExitPlans.filter((item) => {
      return normalizeText(item.reemployment_status) === '○'
    }).length

    const confirmedLanding = startHeadcount + entryConfirmed - exitConfirmed
    const landingWithA = confirmedLanding + aCount
    const landingWithAB = confirmedLanding + aCount + bCount
    const landingWithABC = confirmedLanding + aCount + bCount + cCount
    const planDiff = landingWithAB - headcountPlan

    return {
      entryConfirmed,
      exitConfirmed,
      aCount,
      bCount,
      cCount,
      reemploymentCount,
      confirmedLanding,
      landingWithA,
      landingWithAB,
      landingWithABC,
      planDiff,
    }
  }, [entryPlans, exitPlans, startHeadcount, headcountPlan])

  const sortedEntryPlans = useMemo(() => {
    const rankOrder: Record<string, number> = {
      '確定': 1,
      'A見込み': 2,
      'B見込み': 3,
      'C見込み': 4,
    }

    const normalizeText = (value: string | null | undefined) => {
      return String(value ?? '').normalize('NFKC').trim()
    }

    return [...entryPlans].sort((a, b) => {
      const aRank = rankOrder[normalizeText(a.certainty_rank)] ?? 99
      const bRank = rankOrder[normalizeText(b.certainty_rank)] ?? 99

      if (aRank !== bRank) return aRank - bRank

      const aDate = a.entry_date || a.tour_date || ''
      const bDate = b.entry_date || b.tour_date || ''

      return aDate.localeCompare(bDate)
    })
  }, [entryPlans])


  const sortedExitPlans = useMemo(() => {
    return [...exitPlans].sort((a, b) => {
      const aDate = a.exit_date || ''
      const bDate = b.exit_date || ''
      return aDate.localeCompare(bDate)
    })
  }, [exitPlans])


  const activeDailyResults = useMemo(() => {
    const normalizeText = (value: string | null | undefined) => {
      return String(value ?? '').normalize('NFKC').trim()
    }

    return dailyResults.filter((item) => normalizeText(item.status) !== '取消')
  }, [dailyResults])

  const sortedDailyResults = useMemo(() => {
    return [...dailyResults].sort((a, b) => {
      const aDate = a.result_date || ''
      const bDate = b.result_date || ''

      if (aDate !== bDate) return aDate.localeCompare(bDate)

      const aName = a.sales_users?.name ?? ''
      const bName = b.sales_users?.name ?? ''

      return aName.localeCompare(bName)
    })
  }, [dailyResults])

  const salesUserSummaries = useMemo(() => {
    const normalizeText = (value: string | null | undefined) => {
      return String(value ?? '').normalize('NFKC').trim()
    }

    const isEntryConfirmed = (item: EntryPlan) => {
      const certainty = normalizeText(item.certainty_rank)
      const status = normalizeText(item.status)

      return (
        certainty === '確定' ||
        status === '確定' ||
        status === '入職済み'
      )
    }

    const targetUsers = selectedSalesUserId
      ? salesUsers.filter((user) => user.id === selectedSalesUserId)
      : salesUsers

    return targetUsers.map((user) => {
      const userPlan = monthlyPlansForUsers.find((plan) => plan.sales_user_id === user.id)

      const activeEntries = entryPlans.filter((item) => {
        return item.sales_user_id === user.id && normalizeText(item.status) !== '取消'
      })

      const activeExits = exitPlans.filter((item) => {
        return item.sales_user_id === user.id && normalizeText(item.status) !== '取消'
      })

      const entryConfirmed = activeEntries.filter(isEntryConfirmed).length
      const entryProspects = activeEntries.filter((item) => !isEntryConfirmed(item))
      const exitConfirmed = activeExits.filter((item) => {
        const status = normalizeText(item.status)
        return status === '確定' || status === '退職済み'
      }).length

      const aCount = entryProspects.filter((item) => normalizeText(item.certainty_rank).includes('A')).length
      const bCount = entryProspects.filter((item) => normalizeText(item.certainty_rank).includes('B')).length
      const cCount = entryProspects.filter((item) => normalizeText(item.certainty_rank).includes('C')).length

      const userDailyResults = activeDailyResults.filter((item) => item.sales_user_id === user.id)

      const newCount = userDailyResults.reduce((sum, item) => sum + Number(item.new_count ?? 0), 0)
      const increaseCount = userDailyResults.reduce((sum, item) => sum + Number(item.increase_count ?? 0), 0)
      const actualExitCount = userDailyResults.reduce((sum, item) => sum + Number(item.exit_count ?? 0), 0)
      const transactionCount = userDailyResults.reduce((sum, item) => sum + Number(item.transaction_count ?? 0), 0)
      const actualNetIncrease = newCount + increaseCount - actualExitCount

      const userStartHeadcount = userPlan?.start_headcount ?? 0
      const userHeadcountPlan = userPlan?.headcount_plan ?? 0
      const confirmedLanding = userStartHeadcount + entryConfirmed - exitConfirmed
      const landingWithAB = confirmedLanding + aCount + bCount
      const landingWithABC = confirmedLanding + aCount + bCount + cCount
      const planDiff = landingWithAB - userHeadcountPlan
      const achievementRate = userHeadcountPlan > 0 ? Math.round((landingWithAB / userHeadcountPlan) * 1000) / 10 : 0

      return {
        salesUserId: user.id,
        name: user.name,
        startHeadcount: userStartHeadcount,
        headcountPlan: userHeadcountPlan,
        entryConfirmed,
        exitConfirmed,
        confirmedLanding,
        aCount,
        bCount,
        cCount,
        prospectTotal: aCount + bCount + cCount,
        landingWithAB,
        landingWithABC,
        planDiff,
        achievementRate,
        newCount,
        increaseCount,
        actualExitCount,
        transactionCount,
        actualNetIncrease,
      }
    })
  }, [salesUsers, selectedSalesUserId, monthlyPlansForUsers, entryPlans, exitPlans, activeDailyResults])

  const workforceChangeRows = useMemo(() => {
    const normalizeText = (value: string | null | undefined) => {
      return String(value ?? '').normalize('NFKC').trim()
    }

    const isEntryConfirmed = (item: EntryPlan) => {
      const certainty = normalizeText(item.certainty_rank)
      const status = normalizeText(item.status)

      return (
        certainty === '確定' ||
        status === '確定' ||
        status === '入職済み'
      )
    }

    const isExitConfirmed = (item: ExitPlan) => {
      const status = normalizeText(item.status)
      return status === '確定' || status === '退職済み'
    }

    const activeEntries = entryPlans.filter((item) => normalizeText(item.status) !== '取消')
    const activeExits = exitPlans.filter((item) => normalizeText(item.status) !== '取消')

    const { start, end } = getMonthRange(targetMonth)
    const rows: {
      date: string
      weekday: string
      beforeHeadcount: number
      entryConfirmed: number
      exitConfirmed: number
      confirmedNet: number
      confirmedHeadcount: number
      newCount: number
      increaseCount: number
      actualExitCount: number
      actualNet: number
      actualHeadcount: number
      confirmedPlanDiff: number
      actualPlanDiff: number
    }[] = []

    let currentConfirmedHeadcount = startHeadcount
    let currentActualHeadcount = startHeadcount

    const cursor = new Date(`${start}T00:00:00`)
    const endDate = new Date(`${end}T00:00:00`)
    const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']

    while (cursor < endDate) {
      const yyyy = cursor.getFullYear()
      const mm = String(cursor.getMonth() + 1).padStart(2, '0')
      const dd = String(cursor.getDate()).padStart(2, '0')
      const date = `${yyyy}-${mm}-${dd}`
      const beforeHeadcount = currentConfirmedHeadcount

      const entryConfirmed = activeEntries.filter((item) => {
        return isEntryConfirmed(item) && item.entry_date === date
      }).length

      const exitConfirmed = activeExits.filter((item) => {
        return isExitConfirmed(item) && item.exit_date === date
      }).length

      const confirmedNet = entryConfirmed - exitConfirmed
      currentConfirmedHeadcount += confirmedNet

      const dailyItems = activeDailyResults.filter((item) => item.result_date === date)
      const newCount = dailyItems.reduce((sum, item) => sum + Number(item.new_count ?? 0), 0)
      const increaseCount = dailyItems.reduce((sum, item) => sum + Number(item.increase_count ?? 0), 0)
      const actualExitCount = dailyItems.reduce((sum, item) => sum + Number(item.exit_count ?? 0), 0)
      const actualNet = newCount + increaseCount - actualExitCount
      currentActualHeadcount += actualNet

      rows.push({
        date,
        weekday: weekdayLabels[cursor.getDay()],
        beforeHeadcount,
        entryConfirmed,
        exitConfirmed,
        confirmedNet,
        confirmedHeadcount: currentConfirmedHeadcount,
        newCount,
        increaseCount,
        actualExitCount,
        actualNet,
        actualHeadcount: currentActualHeadcount,
        confirmedPlanDiff: currentConfirmedHeadcount - headcountPlan,
        actualPlanDiff: currentActualHeadcount - headcountPlan,
      })

      cursor.setDate(cursor.getDate() + 1)
    }

    return rows
  }, [targetMonth, startHeadcount, headcountPlan, entryPlans, exitPlans, activeDailyResults])

  const workforceChangeSummary = useMemo(() => {
    const lastRow = workforceChangeRows[workforceChangeRows.length - 1]
    const totalEntryConfirmed = workforceChangeRows.reduce((sum, row) => sum + row.entryConfirmed, 0)
    const totalExitConfirmed = workforceChangeRows.reduce((sum, row) => sum + row.exitConfirmed, 0)
    const totalActualNet = workforceChangeRows.reduce((sum, row) => sum + row.actualNet, 0)

    return {
      confirmedHeadcount: lastRow?.confirmedHeadcount ?? startHeadcount,
      actualHeadcount: lastRow?.actualHeadcount ?? startHeadcount,
      totalEntryConfirmed,
      totalExitConfirmed,
      totalActualNet,
      confirmedPlanDiff: (lastRow?.confirmedHeadcount ?? startHeadcount) - headcountPlan,
      actualPlanDiff: (lastRow?.actualHeadcount ?? startHeadcount) - headcountPlan,
    }
  }, [workforceChangeRows, startHeadcount, headcountPlan])


  const selectedBranchName = useMemo(() => {
    return branches.find((branch) => branch.id === selectedBranchId)?.branch_name ?? '未選択'
  }, [branches, selectedBranchId])

  function sanitizeFileName(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, '_')
  }

  function setSheetWidths(sheet: XLSX.WorkSheet, widths: number[]) {
    sheet['!cols'] = widths.map((wch) => ({ wch }))
  }

  function addAoaSheet(workbook: XLSX.WorkBook, sheetName: string, rows: (string | number | null)[][], widths: number[]) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    setSheetWidths(sheet, widths)
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  }

  function addJsonSheet<T extends Record<string, string | number | null>>(
    workbook: XLSX.WorkBook,
    sheetName: string,
    rows: T[],
    widths: number[]
  ) {
    const sheet = XLSX.utils.json_to_sheet(rows)
    setSheetWidths(sheet, widths)
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  }

  function createSummarySheet(workbook: XLSX.WorkBook) {
    const rows: (string | number | null)[][] = [
      ['月次人員管理 陣立て表サマリー'],
      ['対象月', targetMonth],
      ['支店', selectedBranchName],
      ['担当者', selectedSalesUserId ? salesUsers.find((user) => user.id === selectedSalesUserId)?.name ?? '' : '全員'],
      [],
      ['項目', '人数'],
      ['人員PLAN', headcountPlan],
      ['月初人数', startHeadcount],
      ['入職確定', summary.entryConfirmed],
      ['退職確定', summary.exitConfirmed],
      ['確定着地', summary.confirmedLanding],
      ['PLAN差', summary.planDiff],
      ['A見込み', summary.aCount],
      ['B見込み', summary.bCount],
      ['C見込み', summary.cCount],
      ['A込み着地', summary.landingWithA],
      ['A+B込み着地', summary.landingWithAB],
      ['A+B+C込み着地', summary.landingWithABC],
    ]

    addAoaSheet(workbook, '陣立て表サマリー', rows, [30, 18, 18, 18])
  }

  function createPersonalPerformanceSheet(workbook: XLSX.WorkBook) {
    const rows = salesUserSummaries.map((row) => ({
      担当者: row.name,
      個人PLAN: row.headcountPlan,
      月初: row.startHeadcount,
      入職確定: row.entryConfirmed,
      退職確定: row.exitConfirmed,
      確定着地: row.confirmedLanding,
      A見込み: row.aCount,
      B見込み: row.bCount,
      C見込み: row.cCount,
      見込計: row.prospectTotal,
      'A+B着地': row.landingWithAB,
      'A+B+C着地': row.landingWithABC,
      PLAN差: row.planDiff,
      達成率: `${row.achievementRate}%`,
      新規: row.newCount,
      増員: row.increaseCount,
      退社: row.actualExitCount,
      取引件数: row.transactionCount,
      純増: row.actualNetIncrease,
    }))

    addJsonSheet(workbook, '個人別実績管理表', rows, [14, 10, 10, 10, 10, 10, 8, 8, 8, 10, 12, 12, 10, 10, 8, 8, 8, 10, 8])
  }

  function createEntryListSheet(workbook: XLSX.WorkBook) {
    const rows = sortedEntryPlans.map((plan) => ({
      確度: plan.certainty_rank ?? '',
      氏名: plan.worker_name ?? '',
      企業名: plan.companies?.company_name ?? '',
      担当: plan.sales_users?.name ?? '',
      見学日: plan.tour_date ?? '',
      入職日: plan.entry_date ?? '',
      人選状況: plan.selection_status ?? '',
      状態: plan.status ?? '',
      備考: plan.memo ?? '',
    }))

    addJsonSheet(workbook, '入職・見込み一覧', rows, [12, 18, 22, 14, 12, 12, 14, 12, 30])
  }

  function createExitListSheet(workbook: XLSX.WorkBook) {
    const rows = sortedExitPlans.map((plan) => ({
      状態: plan.status ?? '',
      氏名: plan.worker_name ?? '',
      企業名: plan.companies?.company_name ?? '',
      担当: plan.sales_users?.name ?? '',
      退職日: plan.exit_date ?? '',
      再稼働: plan.reemployment_status ?? '',
      理由: plan.exit_reason ?? '',
      次職: plan.next_job ?? '',
      備考: plan.memo ?? '',
    }))

    addJsonSheet(workbook, '退職予定・退職確定一覧', rows, [12, 18, 22, 14, 12, 10, 14, 18, 30])
  }

  function createDailyResultsSheet(workbook: XLSX.WorkBook) {
    const rows = sortedDailyResults.map((result) => ({
      日付: result.result_date,
      担当: result.sales_users?.name ?? '',
      新規: Number(result.new_count ?? 0),
      増員: Number(result.increase_count ?? 0),
      退社: Number(result.exit_count ?? 0),
      取引件数: Number(result.transaction_count ?? 0),
      状態: result.status ?? '有効',
      備考: result.memo ?? '',
    }))

    addJsonSheet(workbook, '日次実績一覧', rows, [12, 14, 8, 8, 8, 10, 10, 30])
  }


  function createWorkforceChangeSheet(workbook: XLSX.WorkBook) {
    const rows = workforceChangeRows.map((row) => ({
      日付: row.date,
      曜日: row.weekday,
      前日確定稼働: row.beforeHeadcount,
      入職確定: row.entryConfirmed,
      退職確定: row.exitConfirmed,
      確定増減: row.confirmedNet,
      確定稼働: row.confirmedHeadcount,
      新規: row.newCount,
      増員: row.increaseCount,
      退社: row.actualExitCount,
      実績純増: row.actualNet,
      実績稼働: row.actualHeadcount,
      確定PLAN差: row.confirmedPlanDiff,
      実績PLAN差: row.actualPlanDiff,
    }))

    addJsonSheet(workbook, '稼働人員変動表', rows, [12, 8, 14, 10, 10, 10, 12, 8, 8, 8, 10, 12, 12, 12])
  }

  function downloadWorkbook(workbook: XLSX.WorkBook, suffix: string) {
    const branchName = sanitizeFileName(selectedBranchName || '支店未選択')
    const fileName = `${targetMonth}_${branchName}_${suffix}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  function handleExportReportExcel() {
    const workbook = XLSX.utils.book_new()
    createSummarySheet(workbook)
    createWorkforceChangeSheet(workbook)
    createPersonalPerformanceSheet(workbook)
    downloadWorkbook(workbook, '陣立て表・個人別実績')
  }

  function handleExportListExcel() {
    const workbook = XLSX.utils.book_new()
    createEntryListSheet(workbook)
    createExitListSheet(workbook)
    createDailyResultsSheet(workbook)
    downloadWorkbook(workbook, '入職退職一覧')
  }

  function handleExportAllExcel() {
    const workbook = XLSX.utils.book_new()
    createSummarySheet(workbook)
    createWorkforceChangeSheet(workbook)
    createPersonalPerformanceSheet(workbook)
    createEntryListSheet(workbook)
    createExitListSheet(workbook)
    createDailyResultsSheet(workbook)
    downloadWorkbook(workbook, '月次人員管理')
  }

  const filteredCompaniesForEntry = companies
  const filteredCompaniesForExit = companies

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            月次人員管理
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            入職予定・退職予定を登録し、陣立て表・個人別実績・稼働人員変動表へ反映するための管理画面です。
          </p>
        </div>

        {message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            表示条件・月次PLAN
          </h2>

          <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                支店
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                対象月
              </label>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                担当者
              </label>
              <select
                value={selectedSalesUserId}
                onChange={(e) => setSelectedSalesUserId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">全員</option>
                {salesUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                人員PLAN
              </label>
              <input
                type="number"
                value={headcountPlan}
                onChange={(e) => setHeadcountPlan(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                月初人数
              </label>
              <input
                type="number"
                value={startHeadcount}
                onChange={(e) => setStartHeadcount(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSaveMonthlyPlan}
                disabled={savingPlan || !selectedBranchId}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingPlan ? '保存中...' : 'PLAN保存'}
              </button>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchPlans}
                disabled={loading || !selectedBranchId}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? '読み込み中...' : '表示する'}
              </button>
            </div>
          </div>
        </section>

        {mode !== 'input' && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Excel出力
                </h2>
                <p className="text-sm text-gray-500">
                  対象月・支店名をファイル名に入れて、陣立て表・個人別実績・入職退職一覧を出力します。
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                onClick={handleExportAllExcel}
                disabled={loading || !selectedBranchId}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                全てExcel出力
              </button>
              <button
                onClick={handleExportReportExcel}
                disabled={loading || !selectedBranchId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                陣立て・個人別実績を出力
              </button>
              <button
                onClick={handleExportListExcel}
                disabled={loading || !selectedBranchId}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                入職・退職一覧を出力
              </button>
            </div>
          </section>
        )}

        {mode === 'report' && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              陣立て表サマリー
            </h2>
            <p className="text-sm text-gray-500">
              月初人数・入退職・見込みをもとに、月末着地を自動計算します。PLAN差はA+B込み着地で計算しています。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
            <SummaryCard label="人員PLAN" value={headcountPlan} suffix="名" />
            <SummaryCard label="月初人数" value={startHeadcount} suffix="名" />
            <SummaryCard label="入職確定" value={summary.entryConfirmed} suffix="名" />
            <SummaryCard label="退職確定" value={summary.exitConfirmed} suffix="名" />
            <SummaryCard label="確定着地" value={summary.confirmedLanding} suffix="名" />
            <SummaryCard label="PLAN差" value={summary.planDiff} suffix="名" />

            <SummaryCard label="A見込み" value={summary.aCount} suffix="名" />
            <SummaryCard label="B見込み" value={summary.bCount} suffix="名" />
            <SummaryCard label="C見込み" value={summary.cCount} suffix="名" />
            <SummaryCard label="A込み着地" value={summary.landingWithA} suffix="名" />
            <SummaryCard label="A+B込み着地" value={summary.landingWithAB} suffix="名" />
            <SummaryCard label="A+B+C込み着地" value={summary.landingWithABC} suffix="名" />
          </div>
        </section>

        )}

        {mode === 'report' && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                稼働人員変動表
              </h2>
              <p className="text-sm text-gray-500">
                月初人数を起点に、日別の入職確定・退職確定・日次実績の純増から稼働人数の推移を表示します。
              </p>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <SummaryCard label="月初人数" value={startHeadcount} suffix="名" />
              <SummaryCard label="入職確定計" value={workforceChangeSummary.totalEntryConfirmed} suffix="名" />
              <SummaryCard label="退職確定計" value={workforceChangeSummary.totalExitConfirmed} suffix="名" />
              <SummaryCard label="確定稼働" value={workforceChangeSummary.confirmedHeadcount} suffix="名" />
              <SummaryCard label="実績純増" value={workforceChangeSummary.totalActualNet} suffix="名" />
              <SummaryCard label="実績PLAN差" value={workforceChangeSummary.actualPlanDiff} suffix="名" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] table-fixed border-collapse text-sm tabular-nums">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[60px]" />
                  <col className="w-[110px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[100px]" />
                  <col className="w-[70px]" />
                  <col className="w-[70px]" />
                  <col className="w-[70px]" />
                  <col className="w-[90px]" />
                  <col className="w-[100px]" />
                  <col className="w-[105px]" />
                  <col className="w-[105px]" />
                </colgroup>
                <thead>
                  <tr className="border-b bg-gray-100 text-left">
                    <th className="px-3 py-2">日付</th>
                    <th className="px-3 py-2 text-center">曜</th>
                    <th className="px-3 py-2 text-right">前日確定</th>
                    <th className="px-3 py-2 text-right">入職確定</th>
                    <th className="px-3 py-2 text-right">退職確定</th>
                    <th className="px-3 py-2 text-right">確定増減</th>
                    <th className="px-3 py-2 text-right">確定稼働</th>
                    <th className="px-3 py-2 text-right">新規</th>
                    <th className="px-3 py-2 text-right">増員</th>
                    <th className="px-3 py-2 text-right">退社</th>
                    <th className="px-3 py-2 text-right">実績純増</th>
                    <th className="px-3 py-2 text-right">実績稼働</th>
                    <th className="px-3 py-2 text-right">確定PLAN差</th>
                    <th className="px-3 py-2 text-right">実績PLAN差</th>
                  </tr>
                </thead>
                <tbody>
                  {workforceChangeRows.map((row) => (
                    <tr key={row.date} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-gray-900">{row.date}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{row.weekday}</td>
                      <td className="px-3 py-2 text-right">{row.beforeHeadcount}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{row.entryConfirmed}</td>
                      <td className="px-3 py-2 text-right text-red-700">{row.exitConfirmed}</td>
                      <td className={["px-3 py-2 text-right font-semibold", row.confirmedNet < 0 ? "text-red-600" : row.confirmedNet > 0 ? "text-blue-600" : "text-gray-700"].join(' ')}>
                        {row.confirmedNet > 0 ? '+' : ''}{row.confirmedNet}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{row.confirmedHeadcount}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{row.newCount}</td>
                      <td className="px-3 py-2 text-right text-green-700">{row.increaseCount}</td>
                      <td className="px-3 py-2 text-right text-red-700">{row.actualExitCount}</td>
                      <td className={["px-3 py-2 text-right font-semibold", row.actualNet < 0 ? "text-red-600" : row.actualNet > 0 ? "text-blue-600" : "text-gray-700"].join(' ')}>
                        {row.actualNet > 0 ? '+' : ''}{row.actualNet}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{row.actualHeadcount}</td>
                      <td className={["px-3 py-2 text-right font-bold", row.confirmedPlanDiff < 0 ? "text-red-600" : "text-blue-600"].join(' ')}>
                        {row.confirmedPlanDiff > 0 ? '+' : ''}{row.confirmedPlanDiff}
                      </td>
                      <td className={["px-3 py-2 text-right font-bold", row.actualPlanDiff < 0 ? "text-red-600" : "text-blue-600"].join(' ')}>
                        {row.actualPlanDiff > 0 ? '+' : ''}{row.actualPlanDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(mode === 'input' || editingDailyResultId) && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingDailyResultId ? '日次実績編集' : '日次実績入力'}
            </h2>
            <p className="text-sm text-gray-500">
              新規数・増員数・退社数・取引件数を担当者ごとに登録します。登録した数値は、下の個人別実績管理表に自動反映されます。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
            <Input
              label="日付"
              type="date"
              value={dailyResultForm.result_date}
              onChange={(value) => setDailyResultForm({ ...dailyResultForm, result_date: value })}
            />

            <Select
              label="担当者"
              value={dailyResultForm.sales_user_id}
              onChange={(value) => setDailyResultForm({ ...dailyResultForm, sales_user_id: value })}
              options={salesUsers.map((user) => ({
                value: user.id,
                label: user.name,
              }))}
              placeholder="選択してください"
            />

            <Input
              label="新規数"
              type="number"
              value={dailyResultForm.new_count}
              onChange={(value) => setDailyResultForm({ ...dailyResultForm, new_count: value })}
            />

            <Input
              label="増員数"
              type="number"
              value={dailyResultForm.increase_count}
              onChange={(value) => setDailyResultForm({ ...dailyResultForm, increase_count: value })}
            />

            <Input
              label="退社数"
              type="number"
              value={dailyResultForm.exit_count}
              onChange={(value) => setDailyResultForm({ ...dailyResultForm, exit_count: value })}
            />

            <Input
              label="取引件数"
              type="number"
              value={dailyResultForm.transaction_count}
              onChange={(value) => setDailyResultForm({ ...dailyResultForm, transaction_count: value })}
            />

            <div className="flex items-end">
              <button
                onClick={editingDailyResultId ? handleUpdateDailyResult : handleCreateDailyResult}
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {editingDailyResultId ? '実績更新' : '実績登録'}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <Input
              label="備考"
              value={dailyResultForm.memo}
              onChange={(value) => setDailyResultForm({ ...dailyResultForm, memo: value })}
            />
          </div>

          {editingDailyResultId && (
            <div className="mt-4">
              <button
                onClick={() => resetDailyResultForm()}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50 md:w-auto"
              >
                編集をキャンセル
              </button>
            </div>
          )}
        </section>

        )}

        {mode === 'report' && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              個人別実績管理表
            </h2>
            <p className="text-sm text-gray-500">
              人員の着地見込みに加えて、新規数・増員数・退社数・取引件数・純増を担当者別に集計します。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] table-fixed border-collapse text-sm tabular-nums">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[90px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-100 text-left">
                  <th className="px-3 py-2">担当者</th>
                  <th className="px-3 py-2 text-right">個人PLAN</th>
                  <th className="px-3 py-2 text-right">月初</th>
                  <th className="px-3 py-2 text-right">入職確定</th>
                  <th className="px-3 py-2 text-right">退職確定</th>
                  <th className="px-3 py-2 text-right">確定着地</th>
                  <th className="px-3 py-2 text-right">A</th>
                  <th className="px-3 py-2 text-right">B</th>
                  <th className="px-3 py-2 text-right">C</th>
                  <th className="px-3 py-2 text-right">見込計</th>
                  <th className="px-3 py-2 text-right">A+B着地</th>
                  <th className="px-3 py-2 text-right">ABC着地</th>
                  <th className="px-3 py-2 text-right">PLAN差</th>
                  <th className="px-3 py-2 text-right">達成率</th>
                  <th className="px-3 py-2 text-right">新規</th>
                  <th className="px-3 py-2 text-right">増員</th>
                  <th className="px-3 py-2 text-right">退社</th>
                  <th className="px-3 py-2 text-right">取引件数</th>
                  <th className="px-3 py-2 text-right">純増</th>
                </tr>
              </thead>
              <tbody>
                {salesUserSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="px-3 py-6 text-center text-gray-500">
                      担当者データがありません。
                    </td>
                  </tr>
                ) : (
                  salesUserSummaries.map((row) => (
                    <tr key={row.salesUserId} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-gray-900">{row.name}</td>
                      <td className="px-3 py-2 text-right">{row.headcountPlan}</td>
                      <td className="px-3 py-2 text-right">{row.startHeadcount}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{row.entryConfirmed}</td>
                      <td className="px-3 py-2 text-right text-red-700">{row.exitConfirmed}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.confirmedLanding}</td>
                      <td className="px-3 py-2 text-right text-green-700">{row.aCount}</td>
                      <td className="px-3 py-2 text-right text-yellow-700">{row.bCount}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{row.cCount}</td>
                      <td className="px-3 py-2 text-right">{row.prospectTotal}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.landingWithAB}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.landingWithABC}</td>
                      <td
                        className={[
                          'px-3 py-2 text-right font-bold',
                          row.planDiff < 0 ? 'text-red-600' : 'text-blue-600',
                        ].join(' ')}
                      >
                        {row.planDiff > 0 ? '+' : ''}{row.planDiff}
                      </td>
                      <td className="px-3 py-2 text-right">{row.achievementRate}%</td>
                      <td className="px-3 py-2 text-right text-blue-700">{row.newCount}</td>
                      <td className="px-3 py-2 text-right text-green-700">{row.increaseCount}</td>
                      <td className="px-3 py-2 text-right text-red-700">{row.actualExitCount}</td>
                      <td className="px-3 py-2 text-right">{row.transactionCount}</td>
                      <td
                        className={[
                          'px-3 py-2 text-right font-bold',
                          row.actualNetIncrease < 0 ? 'text-red-600' : 'text-blue-600',
                        ].join(' ')}
                      >
                        {row.actualNetIncrease > 0 ? '+' : ''}{row.actualNetIncrease}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        )}


        {mode === 'list' && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                日次実績一覧
              </h2>
              <p className="text-sm text-gray-500">
                登録済みの日次実績を確認・編集・取消できます。取消済みは個人別実績管理表と稼働人員変動表の集計から除外されます。
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed border-collapse text-sm tabular-nums">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[130px]" />
                  <col className="w-[80px]" />
                  <col className="w-[80px]" />
                  <col className="w-[80px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[220px]" />
                  <col className="w-[130px]" />
                </colgroup>
                <thead>
                  <tr className="border-b bg-gray-100 text-left">
                    <th className="px-3 py-2">日付</th>
                    <th className="px-3 py-2">担当</th>
                    <th className="px-3 py-2 text-right">新規</th>
                    <th className="px-3 py-2 text-right">増員</th>
                    <th className="px-3 py-2 text-right">退社</th>
                    <th className="px-3 py-2 text-right">取引件数</th>
                    <th className="px-3 py-2">状態</th>
                    <th className="px-3 py-2">備考</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDailyResults.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                        日次実績はありません。
                      </td>
                    </tr>
                  ) : (
                    sortedDailyResults.map((result) => {
                      const isCanceled = result.status === '取消'

                      return (
                        <tr
                          key={result.id}
                          className={[
                            'border-b hover:bg-slate-50',
                            isCanceled ? 'bg-gray-50 text-gray-400' : '',
                          ].join(' ')}
                        >
                          <td className="px-3 py-2">{result.result_date}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{result.sales_users?.name ?? '-'}</td>
                          <td className="px-3 py-2 text-right text-blue-700">{Number(result.new_count ?? 0)}</td>
                          <td className="px-3 py-2 text-right text-green-700">{Number(result.increase_count ?? 0)}</td>
                          <td className="px-3 py-2 text-right text-red-700">{Number(result.exit_count ?? 0)}</td>
                          <td className="px-3 py-2 text-right">{Number(result.transaction_count ?? 0)}</td>
                          <td className="px-3 py-2">
                            <StatusBadge value={result.status ?? '有効'} />
                          </td>
                          <td className="px-3 py-2">{result.memo ?? '-'}</td>
                          <td className="px-3 py-2">
                            {result.status !== '取消' ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStartEditDailyResult(result)}
                                  disabled={loading}
                                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                >
                                  編集
                                </button>

                                <button
                                  onClick={() => handleCancelDailyResult(result.id)}
                                  disabled={loading}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">取消済</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(mode === 'input' || mode === 'list') && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                入職・見込み一覧
              </h2>
            </div>

            {(mode === 'input' || editingEntryId) && (
            <div className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2">
              <Input
                label="スタッフ名"
                value={entryForm.worker_name}
                onChange={(value) => setEntryForm({ ...entryForm, worker_name: value })}
              />

              <Select
                label="担当者"
                value={entryForm.sales_user_id}
                onChange={(value) => setEntryForm({ ...entryForm, sales_user_id: value })}
                options={salesUsers.map((user) => ({
                  value: user.id,
                  label: user.name,
                }))}
                placeholder="選択してください"
              />

              <Select
                label="企業名"
                value={entryForm.company_id}
                onChange={(value) => setEntryForm({ ...entryForm, company_id: value })}
                options={filteredCompaniesForEntry.map((company) => ({
                  value: company.id,
                  label: company.company_name,
                }))}
                placeholder="選択してください"
              />

              <Input
                label="見学日"
                type="date"
                value={entryForm.tour_date}
                onChange={(value) => setEntryForm({ ...entryForm, tour_date: value })}
              />

              <Select
                label="人選状況"
                value={entryForm.selection_status}
                onChange={(value) => setEntryForm({ ...entryForm, selection_status: value })}
                options={selectionStatusOptions.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />

              <Input
                label="入職予定日"
                type="date"
                value={entryForm.entry_date}
                onChange={(value) => setEntryForm({ ...entryForm, entry_date: value })}
              />

              <Select
                label="確度"
                value={entryForm.certainty_rank}
                onChange={(value) => setEntryForm({ ...entryForm, certainty_rank: value })}
                options={certaintyOptions.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />

              <Select
                label="状態"
                value={entryForm.status}
                onChange={(value) => setEntryForm({ ...entryForm, status: value })}
                options={entryStatusOptions.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />

              <div className="md:col-span-2">
                <Input
                  label="備考"
                  value={entryForm.memo}
                  onChange={(value) => setEntryForm({ ...entryForm, memo: value })}
                />
              </div>

              <div className="md:col-span-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    onClick={editingEntryId ? handleUpdateEntry : handleCreateEntry}
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {editingEntryId ? '入職予定を更新' : '入職予定を登録'}
                  </button>

                  {editingEntryId && (
                    <button
                      onClick={resetEntryForm}
                      disabled={loading}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
                    >
                      編集をキャンセル
                    </button>
                  )}
                </div>
              </div>
            </div>

            )}

            {mode === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-100 text-left">
                    <th className="px-3 py-2">確度</th>
                    <th className="px-3 py-2">氏名</th>
                    <th className="px-3 py-2">企業名</th>
                    <th className="px-3 py-2">担当</th>
                    <th className="px-3 py-2">見学日</th>
                    <th className="px-3 py-2">入職日</th>
                    <th className="px-3 py-2">状態</th>
                    <th className="px-3 py-2">備考</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntryPlans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                        入職予定はありません。
                      </td>
                    </tr>
                  ) : (
                    sortedEntryPlans.map((plan) => {
                      const isCanceled = plan.status === '取消'

                      return (
                        <tr
                          key={plan.id}
                          className={[
                            'border-b',
                            isCanceled ? 'bg-gray-50 text-gray-400' : '',
                          ].join(' ')}
                        >
                          <td className="px-3 py-2">
                            <CertaintyBadge value={plan.certainty_rank} />
                          </td>
                          <td className="px-3 py-2 font-medium">{plan.worker_name}</td>
                          <td className="px-3 py-2">{plan.companies?.company_name ?? '-'}</td>
                          <td className="px-3 py-2">{plan.sales_users?.name ?? '-'}</td>
                          <td className="px-3 py-2">{plan.tour_date ?? '-'}</td>
                          <td className="px-3 py-2">
                            {plan.entry_date ? (
                              plan.entry_date
                            ) : (
                              <span className="text-gray-400">未定</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge value={plan.status} />
                          </td>
                          <td className="px-3 py-2">{plan.memo ?? '-'}</td>
                          <td className="px-3 py-2">
                            {plan.status !== '取消' ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStartEditEntry(plan)}
                                  disabled={loading}
                                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                >
                                  編集
                                </button>

                                <button
                                  onClick={() => handleCancelEntry(plan.id)}
                                  disabled={loading}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">取消済</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                退職予定・退職確定一覧
              </h2>
            </div>

            {(mode === 'input' || editingExitId) && (
            <div className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2">
              <Input
                label="スタッフ名"
                value={exitForm.worker_name}
                onChange={(value) => setExitForm({ ...exitForm, worker_name: value })}
              />

              <Select
                label="担当者"
                value={exitForm.sales_user_id}
                onChange={(value) => setExitForm({ ...exitForm, sales_user_id: value })}
                options={salesUsers.map((user) => ({
                  value: user.id,
                  label: user.name,
                }))}
                placeholder="選択してください"
              />

              <Select
                label="退職企業"
                value={exitForm.company_id}
                onChange={(value) => setExitForm({ ...exitForm, company_id: value })}
                options={filteredCompaniesForExit.map((company) => ({
                  value: company.id,
                  label: company.company_name,
                }))}
                placeholder="選択してください"
              />

              <Input
                label="退職予定日"
                type="date"
                value={exitForm.exit_date}
                onChange={(value) => setExitForm({ ...exitForm, exit_date: value })}
              />

              <Select
                label="状態"
                value={exitForm.status}
                onChange={(value) => setExitForm({ ...exitForm, status: value })}
                options={exitStatusOptions.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />

              <Select
                label="再稼働"
                value={exitForm.reemployment_status}
                onChange={(value) => setExitForm({ ...exitForm, reemployment_status: value })}
                options={reemploymentOptions.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />

              <Select
                label="退職理由"
                value={exitForm.exit_reason}
                onChange={(value) => setExitForm({ ...exitForm, exit_reason: value })}
                options={exitReasonOptions.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />

              <Input
                label="次職"
                value={exitForm.next_job}
                onChange={(value) => setExitForm({ ...exitForm, next_job: value })}
              />

              <div className="md:col-span-2">
                <Input
                  label="備考"
                  value={exitForm.memo}
                  onChange={(value) => setExitForm({ ...exitForm, memo: value })}
                />
              </div>

              <div className="md:col-span-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    onClick={editingExitId ? handleUpdateExit : handleCreateExit}
                    disabled={loading}
                    className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {editingExitId ? '退職予定を更新' : '退職予定を登録'}
                  </button>

                  {editingExitId && (
                    <button
                      onClick={resetExitForm}
                      disabled={loading}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
                    >
                      編集をキャンセル
                    </button>
                  )}
                </div>
              </div>
            </div>

            )}

            {mode === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-100 text-left">
                    <th className="px-3 py-2">状態</th>
                    <th className="px-3 py-2">氏名</th>
                    <th className="px-3 py-2">企業名</th>
                    <th className="px-3 py-2">担当</th>
                    <th className="px-3 py-2">退職日</th>
                    <th className="px-3 py-2">再稼働</th>
                    <th className="px-3 py-2">理由</th>
                    <th className="px-3 py-2">備考</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {exitPlans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                        退職予定はありません。
                      </td>
                    </tr>
                  ) : (
                    sortedExitPlans.map((plan) => {
                      const isCanceled = plan.status === '取消'

                      return (
                        <tr
                          key={plan.id}
                          className={[
                            'border-b',
                            isCanceled ? 'bg-gray-50 text-gray-400' : '',
                          ].join(' ')}
                        >
                          <td className="px-3 py-2">
                            <StatusBadge value={plan.status} />
                          </td>
                          <td className="px-3 py-2 font-medium">{plan.worker_name}</td>
                          <td className="px-3 py-2">{plan.companies?.company_name ?? '-'}</td>
                          <td className="px-3 py-2">{plan.sales_users?.name ?? '-'}</td>
                          <td className="px-3 py-2">{plan.exit_date ?? '-'}</td>
                          <td className="px-3 py-2">{plan.reemployment_status ?? '-'}</td>
                          <td className="px-3 py-2">{plan.exit_reason ?? '-'}</td>
                          <td className="px-3 py-2">{plan.memo ?? '-'}</td>
                          <td className="px-3 py-2">
                            {plan.status !== '取消' ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStartEditExit(plan)}
                                  disabled={loading}
                                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                >
                                  編集
                                </button>

                                <button
                                  onClick={() => handleCancelExit(plan.id)}
                                  disabled={loading}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">取消済</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>
        </div>        )}

      </div>
    </div>
  )
}


function CertaintyBadge({ value }: { value: string | null }) {
  const text = String(value ?? '-').normalize('NFKC').trim()

  const className =
    text === '確定'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : text.includes('A')
        ? 'bg-green-100 text-green-700 border-green-200'
        : text.includes('B')
          ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
          : text.includes('C')
            ? 'bg-orange-100 text-orange-700 border-orange-200'
            : 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {text}
    </span>
  )
}

function StatusBadge({ value }: { value: string | null }) {
  const text = String(value ?? '-').normalize('NFKC').trim()

  const className =
    text === '確定' || text === '入職済み' || text === '退職済み'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : text === '取消'
        ? 'bg-gray-100 text-gray-500 border-gray-200'
        : text === '有効'
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {text}
    </span>
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
  const isDiff = label.includes('差')
  const isMinus = value < 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div
        className={[
          'mt-2 text-2xl font-bold',
          isDiff && isMinus ? 'text-red-600' : 'text-gray-900',
          isDiff && !isMinus ? 'text-blue-600' : '',
        ].join(' ')}
      >
        {isDiff && value > 0 ? '+' : ''}
        {value}
        <span className="ml-1 text-sm font-normal text-gray-500">{suffix}</span>
      </div>
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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