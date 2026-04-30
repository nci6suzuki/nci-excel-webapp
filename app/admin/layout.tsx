import AdminAuthGuard from './AdminAuthGuard'
import AdminShell from './AdminShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <AdminShell>{children}</AdminShell>
    </AdminAuthGuard>
  )
}
