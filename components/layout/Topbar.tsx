'use client'
import Link from 'next/link'

export default function Topbar() {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-surface/80 backdrop-blur border-b border-border flex items-center justify-between px-4 z-40">
      <h1 className="text-xl font-bold tracking-tight">GOSSIP</h1>
      <Link href="/notifications" className="text-muted hover:text-white transition-colors">◉</Link>
    </header>
  )
}
