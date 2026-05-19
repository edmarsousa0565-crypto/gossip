import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import MobileNav from '@/components/layout/MobileNav'
import CustomCursor from '@/components/layout/CustomCursor'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomCursor />
      <Topbar />
      <Sidebar />
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        {children}
      </main>
      <MobileNav />
    </>
  )
}
