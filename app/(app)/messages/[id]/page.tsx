'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import type { Message, Profile } from '@/lib/supabase/types'

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const [otherId, setOtherId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [me, setMe] = useState<Profile | null>(null)
  const [other, setOther] = useState<Profile | null>(null)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    params.then(p => setOtherId(p.id))
  }, [params])

  useEffect(() => {
    if (!otherId) return
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [myProfile, otherProfile] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('profiles').select('*').eq('id', otherId).single(),
      ])
      setMe(myProfile.data); setOther(otherProfile.data)

      const { data } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      if (data) setMessages(data as Message[])

      const channel = supabase.channel(`conv:${user.id}:${otherId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          payload => setMessages(prev => [...prev, payload.new as Message]))
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [otherId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !me) return
    const supabase = createClient()
    await supabase.from('messages').insert({ sender_id: me.id, receiver_id: otherId, content: input })
    setInput('')
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="flex items-center gap-3 p-4 border-b border-border bg-surface/80 backdrop-blur sticky top-0">
        <Avatar src={other?.avatar_url} name={other?.full_name ?? '?'} size={40} />
        <span className="font-semibold">{other?.full_name ?? '...'}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => {
          const isMine = m.sender_id === me?.id
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm
                ${isMine ? 'bg-white text-black rounded-br-sm' : 'bg-surface2 border border-border rounded-bl-sm'}`}>
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-3 p-4 border-t border-border">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Message..."
          className="flex-1 bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white/30 transition-colors" />
        <button type="submit" disabled={!input.trim()}
          className="bg-white text-black font-semibold px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-40 text-sm">
          Send
        </button>
      </form>
    </div>
  )
}
