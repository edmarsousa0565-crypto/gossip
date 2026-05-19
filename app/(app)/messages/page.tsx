import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: messages } = await supabase
    .from('messages')
    .select(`*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)`)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const seen = new Set<string>()
  const conversations = (messages ?? []).filter((m: any) => {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (seen.has(otherId)) return false
    seen.add(otherId); return true
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      <div className="space-y-1">
        {conversations.map((m: any) => {
          const other = m.sender_id === user.id ? m.receiver : m.sender
          return (
            <Link key={m.id} href={`/messages/${other.id}`}
              className="flex items-center gap-3 p-4 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
              <Avatar src={other.avatar_url} name={other.full_name} size={48} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{other.full_name}</p>
                <p className="text-muted text-xs truncate">{m.content}</p>
              </div>
            </Link>
          )
        })}
        {conversations.length === 0 && (
          <p className="text-center text-muted py-16">No conversations yet</p>
        )}
      </div>
    </div>
  )
}
