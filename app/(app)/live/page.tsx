'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import type { Profile } from '@/lib/supabase/types'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? ''

export default function LivePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streams, setStreams] = useState<any[]>([])
  const [starting, setStarting] = useState(false)
  const [title, setTitle] = useState('')
  const [showStart, setShowStart] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from(containerRef.current!.querySelectorAll('.live-card'), {
      y: 30, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(1.7)',
    })
  }, { scope: containerRef, dependencies: [streams] })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
    })

    supabase
      .from('live_streams')
      .select('*, host:profiles(*)')
      .eq('ended', false)
      .order('started_at', { ascending: false })
      .then(({ data }) => setStreams(data ?? []))
  }, [])

  function goLive() {
    router.push('/live/start')
  }

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ao Vivo</h1>
        <button
          onClick={() => setShowStart(v => !v)}
          className="btn-ripple flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Transmitir
        </button>
      </div>

      {showStart && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold">Iniciar transmissão ao vivo</h2>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título (ex: Treino da tarde 💪)"
            className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-white/30 transition-colors"
          />
          {!LIVEKIT_URL && (
            <p className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 leading-relaxed">
              ⚠️ LiveKit não configurado. Adiciona <span className="font-mono bg-orange-500/20 px-1 rounded">NEXT_PUBLIC_LIVEKIT_URL</span>, <span className="font-mono bg-orange-500/20 px-1 rounded">LIVEKIT_API_KEY</span> e <span className="font-mono bg-orange-500/20 px-1 rounded">LIVEKIT_API_SECRET</span> nas variáveis de ambiente.
            </p>
          )}
          <button
            onClick={goLive}
            disabled={starting || !LIVEKIT_URL}
            className="w-full btn-accent py-3 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
            {starting ? 'A iniciar…' : 'Ir ao vivo'}
          </button>
        </div>
      )}

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
              <div className="absolute top-2 left-2">
                <span className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-full text-white text-[10px] font-bold">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
                </span>
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
