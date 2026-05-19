'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const links = [
  { href: '/feed', label: 'Feed', icon: '⊞' },
  { href: '/profile/me', label: 'Profile', icon: '◯' },
  { href: '/groups', label: 'Groups', icon: '⬡' },
  { href: '/events', label: 'Events', icon: '◈' },
  { href: '/messages', label: 'Messages', icon: '✉' },
  { href: '/notifications', label: 'Notifications', icon: '◉' },
  { href: '/search', label: 'Search', icon: '⊕' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useAuth()

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-surface border-r border-border p-6 z-40">
      <h1 className="text-2xl font-bold tracking-tight mb-10">GOSSIP</h1>
      <nav className="flex-1 space-y-1">
        {links.map(({ href, label, icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
              ${pathname.startsWith(href) ? 'bg-white/10 text-white' : 'text-muted hover:text-white hover:bg-white/5'}`}>
            <span className="text-lg">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <button onClick={signOut} className="text-muted hover:text-white text-sm px-4 py-3 text-left transition-colors">
        Sign out
      </button>
    </aside>
  )
}
