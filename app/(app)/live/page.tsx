'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'

export default function LivePage() {
  const [streams, setStreams] = useState<any[]>([])
  const [newLive, setNewLive] = useState<string | null>(null) // nome do broadcaster que acabou de ir ao vivo
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from(containerRef.current!.querySelectorAll('.live-card'), {
      y: 30, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(1.7)',
    })
  }, { scope: containerRef, dependencies: [streams] })

  useEffect(() => {
    const supabase = createClient()

    // Carrega lives activas
    supabase
      .from('live_streams')
      .select('*, host:profiles(*)')
      .eq('ended', false)
      .order('started_at', { ascending: false })
      .then(({ data }) => setStreams(data ?? []))

    // Escuta mudanças em tempo real
    const channel = supabase
      .channel('live-streams-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_streams' },
        async (payload) => {
          // Busca o stream completo com o perfil do host
          const { data } = await supabase
            .from('live_streams')
            .select('*, host:profiles(*)')
            .eq('id', payload.new.id)
            .single()
          if (!data) return
          setStreams(prev => [data, ...prev])
          // Banner "X está ao vivo"
          const name = data.host?.full_name || data.host?.username || 'Alguém'
          setNewLive(name)
          setTimeout(() => setNewLive(null), 4000)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams' },
        (payload) => {
          if (payload.new.ended) {
            // Remove live terminada
            setStreams(prev => prev.filter(s => s.id !== payload.new.id))
          } else {
            // Actualiza viewer_count
            setStreams(prev =>
              prev.map(s =>
                s.id === payload.new.id
                  ? { ...s, viewer_count: payload.new.viewer_count }
                  : s
              )
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Banner "X está ao vivo" */}
      {newLive && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-2xl text-white text-sm font-semibold"
          style={{ background: '#ff3b30', boxShadow: '0 4px 24px rgba(255,59,48,0.45)' }}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {newLive} está ao vivo!
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ao Vivo</h1>
        <button
          onClick={() => router.push('/live/start')}
          className="btn-ripple flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Transmitir
        </button>
      </div>

      {streams.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.7" strokeLinecap="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold">Nenhum direto ativo</p>
            <p className="text-xs text-muted mt-1">Sê o primeiro a transmitir!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {streams.map((s: any) => (
            <button
              key={s.id}
              onClick={() => router.push(`/live/${s.id}?role=viewer`)}
              className="live-card relative bg-surface border border-border rounded-2xl overflow-hidden text-left hover:border-white/20 transition-colors">
              <div className="aspect-video bg-surface2 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                  </svg>
                </div>
              </div>
              <div className="absolute top-2 left-2 flex items-center gap-2">
                <span className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-full text-white text-[10px] font-bold">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
                </span>
                {s.viewer_count > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
                    style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    {s.viewer_count}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <Avatar src={s.host?.avatar_url} name={s.host?.full_name ?? '?'} size={28} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{s.host?.full_name}</p>
                    <p className="text-xs text-muted truncate">{s.title}</p>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
