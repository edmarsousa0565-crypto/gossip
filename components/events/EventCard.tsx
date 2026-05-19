import Image from 'next/image'
import Link from 'next/link'
import type { Event } from '@/lib/supabase/types'

export default function EventCard({ event }: { event: Event }) {
  const start = new Date(event.start_at)
  return (
    <Link href={`/events/${event.id}`}
      className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-white/20 transition-colors block">
      <div className="relative h-40 bg-surface2">
        {event.cover_url && <Image src={event.cover_url} alt="" fill className="object-cover" />}
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur rounded-xl px-3 py-1.5 text-center min-w-[50px]">
          <div className="text-xs font-semibold text-muted uppercase">{start.toLocaleDateString('en', { month: 'short' })}</div>
          <div className="text-xl font-bold leading-none">{start.getDate()}</div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold">{event.title}</h3>
        {event.location && <p className="text-muted text-sm mt-1">📍 {event.location}</p>}
        {event.description && <p className="text-subtle text-xs mt-2 line-clamp-2">{event.description}</p>}
      </div>
    </Link>
  )
}
