'use client'

import { FormEvent, Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setMessage('メールアドレスとパスワードを入力してください。')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage(`ログインに失敗しました：${error.message}`)
      setLoading(false)
      return
    }

    router.replace(next)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="hidden text-white lg:block">
            <p className="text-sm font-semibold text-blue-200">
              NCI Management System
            </p>

            <h1 className="mt-4 text-5xl font-black leading-tight tracking-tight">
              月次人員管理と<br />
              スタッフ配置を<br />
              ひとつに。
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-200">
              入職・退職・日次実績・マップ図・スタッフ配置を管理する社内システムです。
              ログイン後、権限に応じたメニューが表示されます。
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              <FeatureCard title="月次管理" text="入退職・日次実績" />
              <FeatureCard title="マップ図" text="企業別スタッフ配置" />
              <FeatureCard title="権限管理" text="支店・担当者別制御" />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white p-6 shadow-2xl md:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white shadow-lg">
                N
              </div>

              <h2 className="text-2xl font-black text-slate-900">
                ログイン
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                メールアドレスとパスワードを入力してください。
              </p>
            </div>

            {message && (
              <div className="mb-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="example@nci6.com"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="password"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    {showPassword ? '非表示' : '表示'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">
                ログインできない場合
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-600">
                Supabase Authentication にユーザーが登録されているか、
                /admin/users で権限・支店・担当者が有効になっているか確認してください。
              </p>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/admin"
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                管理画面へ戻る
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function FeatureCard({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-xs text-blue-100">{text}</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
