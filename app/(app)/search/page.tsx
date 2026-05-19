'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'
import type { Profile, Group, Event } from '@/lib/supabase/types'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)

  async function search(q: string) {
    setQuery(q)
    if (q.length < 2) { setProfiles([]); setGroups([]); setEvents([]); return }
    setLoading(true)
    const supabase = createClient()
    const [p, g, e] = await Promise.all([
      supabase.from('profiles').select('*').ilike('full_name', `%${q}%`).limit(5),
      supabase.from('groups').select('*').ilike('name', `%${q}%`).limit(5),
      supabase.from('events').select('*').ilike('title', `%${q}%`).limit(5),
    ])
    setProfiles(p.data ?? []); setGroups(g.data ?? []); setEvents(e.data ?? [])
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <input value={query} onChange={e => search(e.target.value)}
        placeholder="Search people, groups, events..." autoFocus
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors mb-6" />

      {loading && <p className="text-center text-muted text-sm">Searching...</p>}

      {profiles.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">People</h2>
          <div className="space-y-2">
            {profiles.map(p => (
              <Link key={p.id} href={`/profile/${p.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
                <Avatar src={p.avatar_url} name={p.full_name} size={40} />
                <div>
                  <p className="font-medium text-sm">{p.full_name}</p>
                  <p className="text-muted text-xs">@{p.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Groups</h2>
          <div className="space-y-2">
            {groups.map(g => (
              <Link key={g.id} href={`/groups/${g.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
                <div className="w-10 h-10 rounded-xl bg-surface2 flex items-center justify-center text-lg">⬡</div>
                <p className="font-medium text-sm">{g.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Events</h2>
          <div className="space-y-2">
            {events.map(e => (
              <Link key={e.id} href={`/events/${e.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
                <div className="w-10 h-10 rounded-xl bg-surface2 flex items-center justify-center text-lg">◈</div>
                <div>
                  <p className="font-medium text-sm">{e.title}</p>
                  <p className="text-muted text-xs">{new Date(e.start_at).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
