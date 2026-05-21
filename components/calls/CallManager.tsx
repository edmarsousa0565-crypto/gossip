'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CallView from './CallView'
import Avatar from '@/components/ui/Avatar'
import type { Profile } from '@/lib/supabase/types'

type CallRow = {
  id: string
  caller_id: string
  callee_id: string
  room_name: string
  type: 'voice' | 'video'
  status: string
  caller?: Profile
}

export default function CallManager() {
  const [incoming, setIncoming] = useState<CallRow | null>(null)
  const [active, setActive] = useState<{ callId: string; type: 'voice' | 'video'; isCaller: boolean; otherProfile?: Profile } | null>(null)
  const myIdRef   = useRef('')
  const ringingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      myIdRef.current = user.id

      const channel = supabase.channel(`calls:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'calls',
          filter: `callee_id=eq.${user.id}`,
        }, async payload => {
          const call = payload.new as CallRow
          if (call.status !== 'ringing') return
          const { data: caller } = await supabase.from('profiles').select('*').eq('id', call.caller_id).single()
          setIncoming({ ...call, caller: caller ?? undefined })
          // Ring vibration loop
          if (navigator.vibrate) {
            ringingRef.current = setInterval(() => navigator.vibrate([300, 200, 300]), 1500)
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'calls',
          filter: `callee_id=eq.${user.id}`,
        }, payload => {
          const call = payload.new as CallRow
          if (call.status === 'ended' || call.status === 'declined') {
            clearInterval(ringingRef.current ?? undefined)
            setIncoming(null)
            setActive(null)
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    init()
    return () => { clearInterval(ringingRef.current ?? undefined) }
  }, [])

  async function accept() {
    if (!incoming) return
    clearInterval(ringingRef.current ?? undefined)
    const supabase = createClient()
    await supabase.from('calls').update({ status: 'active' }).eq('id', incoming.id)
    setActive({ callId: incoming.id, type: incoming.type, isCaller: false, otherProfile: incoming.caller })
    setIncoming(null)
  }

  async function decline() {
    if (!incoming) return
    clearInterval(ringingRef.current ?? undefined)
    const supabase = createClient()
    await supabase.from('calls').update({ status: 'declined' }).eq('id', incoming.id)
    setIncoming(null)
  }

  async function endActive() {
    if (!active) return
    const supabase = createClient()
    await supabase.from('calls').update({ status: 'ended' }).eq('id', active.callId)
    setActive(null)
  }

  return (
    <>
      {/* ── Incoming call banner ──────────────────────── */}
      {incoming && !active && (
        <div className="fixed top-0 left-0 right-0 z-[110] flex justify-center pt-4 px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm overflow-hidden shadow-2xl"
            style={{
              background: '#1c1c1e',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '20px',
            }}>
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="relative shrink-0">
                <Avatar src={incoming.caller?.avatar_url} name={incoming.caller?.full_name ?? '?'} size={54} />
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                  style={{ background: '#34c759' }}>
                  {incoming.type === 'video' ? '📹' : '📞'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-[15px] truncate">{incoming.caller?.full_name ?? 'Alguém'}</p>
                <p className="text-[12px] animate-pulse" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {incoming.type === 'video' ? 'Chamada de vídeo' : 'Chamada de voz'}…
                </p>
              </div>
            </div>

            <div className="flex" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={decline}
                className="flex-1 py-3.5 flex items-center justify-center gap-2 text-[14px] font-semibold transition-colors hover:bg-red-500/10"
                style={{ color: '#ff3b30', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Recusar
              </button>
              <button onClick={accept}
                className="flex-1 py-3.5 flex items-center justify-center gap-2 text-[14px] font-semibold transition-colors hover:bg-green-500/10"
                style={{ color: '#34c759' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 015 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active call ───────────────────────────────── */}
      {active && (
        <CallView
          callId={active.callId}
          type={active.type}
          isCaller={active.isCaller}
          otherName={active.otherProfile?.full_name}
          otherAvatar={active.otherProfile?.avatar_url}
          onEnd={endActive}
        />
      )}
    </>
  )
}
