'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useHaptic } from '@/hooks/useHaptic'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'
import NewConversation from '@/components/messages/NewConversation'
import type { Profile } from '@/lib/supabase/types'

type Convo = {
  otherId: string
  other: Profile
  lastMessage: string
  lastAt: string
  unread: number
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

function previewText(content: string): { label: string; isMedia: boolean } {
  if (content.startsWith('[audio-once]:')) return { label: '🎧 Áudio · uma vez', isMedia: true }
  if (content.startsWith('[audio]:'))      return { label: '🎤 Mensagem de áudio', isMedia: true }
  if (content.startsWith('[image]:'))      return { label: '📷 Foto', isMedia: true }
  if (content.startsWith('[video]:'))      return { label: '🎥 Vídeo', isMedia: true }
  if (content === '[deleted]')             return { label: 'Mensagem apagada', isMedia: true }
  return { label: content, isMedia: false }
}

export default function MessagesPage() {
  const [convos, setConvos] = useState<Convo[]>([])
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const { tap } = useHaptic()

  async function loadConvos() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data: messages } = await supabase
      .from('messages')
      .select(`*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)`)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const seen = new Map<string, Convo>()
    for (const m of (messages ?? []) as any[]) {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (seen.has(otherId)) continue
      const other = m.sender_id === user.id ? m.receiver : m.sender
      if (!other) continue
      seen.set(otherId, { otherId, other, lastMessage: m.content, lastAt: m.created_at, unread: 0 })
    }

    const { data: unread } = await supabase
      .from('messages').select('sender_id')
      .eq('receiver_id', user.id).eq('read', false)
    for (const u of (unread ?? []) as any[]) {
      const c = seen.get(u.sender_id)
      if (c) c.unread++
    }

    setConvos([...seen.values()])
    setLoading(false)
  }

  useEffect(() => { loadConvos() }, [])

  const { pullY, refreshing, triggered, handlers } = usePullToRefresh(loadConvos, { threshold: 56 })

  const totalUnread = convos.reduce((s, c) => s + c.unread, 0)

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{
        background: '#000',
        minHeight: '100dvh',
        paddingTop: `${pullY}px`,
        transition: pullY === 0 ? 'padding-top 0.3s ease' : 'none',
      }}
      {...handlers}>

      {/* Pull-to-refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50"
          style={{
            top: `calc(3.5rem + ${pullY * 0.4}px)`,
            opacity: Math.min(1, pullY / 40),
            transform: `translateX(-50%) scale(${0.6 + pullY / 200})`,
          }}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}
            style={{
              background: '#1c1c1e',
              border: `1.5px solid ${triggered ? '#3797F0' : 'rgba(255,255,255,0.15)'}`,
              rotate: refreshing ? undefined : `${pullY * 3}deg`,
            }}>
            {refreshing
              ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  style={{ color: triggered ? '#3797F0' : 'rgba(255,255,255,0.4)' }}>
                  <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
            }
          </div>
        </div>
      )}

      {/* ─── Header ────────────────────────────── */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3"
        style={{
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-white tracking-tight">Mensagens</h1>
            {totalUnread > 0 && (
              <span className="min-w-[20px] h-5 rounded-full flex items-center justify-center text-[11px] font-bold px-1.5"
                style={{ background: '#3797F0', color: '#fff' }}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={() => { tap(); setShowNew(true) }}
            className="p-2 rounded-full transition-colors hover:bg-white/[0.06]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
            aria-label="Nova mensagem">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Body ──────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col gap-3 px-4 pt-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-14 h-14 rounded-full shrink-0" style={{ background: '#1c1c1e' }} />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-28 rounded-full" style={{ background: '#1c1c1e' }} />
                <div className="h-3 w-44 rounded-full" style={{ background: '#141414' }} />
              </div>
            </div>
          ))}
        </div>
      ) : convos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-white mb-1.5">Sem mensagens</p>
          <p className="text-[14px] mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Começa uma conversa com os teus amigos
          </p>
          <button
            onClick={() => { tap(); setShowNew(true) }}
            className="px-6 py-2.5 rounded-full text-[15px] font-semibold transition-opacity hover:opacity-85"
            style={{ background: '#3797F0', color: '#fff' }}>
            Enviar mensagem
          </button>
        </div>
      ) : (
        <div className="pt-1">
          {convos.map(c => {
            const p = previewText(c.lastMessage)
            return (
              <Link key={c.otherId} href={`/messages/${c.otherId}`}
                onClick={() => tap()}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]">

                {/* Avatar with unread ring */}
                <div className="relative shrink-0">
                  <div className={c.unread > 0 ? 'ring-2 ring-[#3797F0] ring-offset-2 ring-offset-black rounded-full' : ''}>
                    <Avatar src={c.other.avatar_url} name={c.other.full_name} size={56} />
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className={`text-[15px] truncate ${c.unread > 0 ? 'font-bold text-white' : 'font-medium text-white'}`}>
                      {c.other.full_name ?? c.other.username}
                    </p>
                    <span className={`text-[12px] shrink-0 tabular-nums ${c.unread > 0 ? 'text-[#3797F0] font-medium' : 'text-white/35'}`}>
                      {timeAgo(c.lastAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`text-[13px] truncate flex-1 ${c.unread > 0 ? 'text-white font-medium' : 'text-white/45'} ${p.isMedia ? 'italic' : ''}`}>
                      {p.label}
                    </p>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-bold px-1"
                        style={{ background: '#3797F0', color: '#fff' }}>
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showNew && <NewConversation onClose={() => setShowNew(false)} />}
    </div>
  )
}
