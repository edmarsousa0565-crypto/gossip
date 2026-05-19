'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/feed', icon: '⊞' },
  { href: '/search', icon: '⊕' },
  { href: '/groups', icon: '⬡' },
  { href: '/events', icon: '◈' },
  { href: '/profile/me', icon: '◯' },
]

export default function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur border-t border-border flex items-center justify-around z-40">
      {links.map(({ href, icon }) => (
        <Link key={href} href={href}
          className={`text-2xl p-3 transition-colors ${pathname.startsWith(href) ? 'text-white' : 'text-muted'}`}>
          {icon}
        </Link>
      ))}
    </nav>
  )
}
