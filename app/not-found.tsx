import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-blue-600">
          404
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">
          ページが見つかりません
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          URLが間違っているか、ページが移動・削除された可能性があります。
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/admin"
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
          >
            管理トップへ
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
          >
            ログインへ
          </Link>
        </div>
      </section>
    </main>
  )
}
