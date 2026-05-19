import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Image from 'next/image'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase.from('events').select('*, creator:profiles(*)').eq('id', id).single()
  if (!event) notFound()

  const start = new Date(event.start_at)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="relative h-56 bg-surface2">
          {event.cover_url && <Image src={event.cover_url} alt="" fill className="object-cover" />}
        </div>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-muted text-sm">📅 {start.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          {event.location && <p className="text-muted text-sm">📍 {event.location}</p>}
          {event.description && <p className="text-sm leading-relaxed">{event.description}</p>}
          <div className="flex gap-2 pt-2">
            <button className="bg-white text-black text-sm font-semibold px-5 py-2 rounded-xl hover:bg-white/90 transition-colors">Going</button>
            <button className="bg-surface2 border border-border text-sm px-5 py-2 rounded-xl hover:bg-white/5 transition-colors">Maybe</button>
            <button className="bg-surface2 border border-border text-sm px-5 py-2 rounded-xl hover:bg-white/5 transition-colors">Can&apos;t go</button>
          </div>
        </div>
      </div>
    </div>
  )
}
