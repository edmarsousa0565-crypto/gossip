'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'

export default function LivePage() {
  const [streams, setStreams] = useState<any[]>([])
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from(containerRef.current!.querySelectorAll('.live-card'), {
      y: 30, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(1.7)',
    })
  }, { scope: containerRef, dependencies: [streams] })

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('live_streams')
      .select('*, host:profiles(*)')
      .eq('ended', false)
      .order('started_at', { ascending: false })
      .then(({ data }) => setStreams(data ?? []))
  }, [])

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto px-4 py-6 space-y-5">
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
