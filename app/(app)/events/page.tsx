import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EventCard from '@/components/events/EventCard'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Events</h1>
        <button className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors">
          + Create Event
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(events ?? []).map(event => (
          <EventCard key={event.id} event={event as any} />
        ))}
      </div>
    </div>
  )
}
