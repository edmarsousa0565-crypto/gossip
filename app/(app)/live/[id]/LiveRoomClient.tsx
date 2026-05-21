'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const LiveBroadcast = dynamic(() => import('@/components/live/LiveBroadcast'), { ssr: false })
const LiveViewer    = dynamic(() => import('@/components/live/LiveViewer'),    { ssr: false })

export default function LiveRoomClient({ streamId }: { streamId: string }) {
  const searchParams = useSearchParams()
  const role = searchParams.get('role') ?? 'viewer'
  const router = useRouter()

  const [stream,  setStream]  = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error: err } = await supabase
        .from('live_streams')
        .select('*, host:profiles!user_id(*)')
        .eq('id', streamId)
        .single()

      if (err || !data) { setError('Transmissão não encontrada.'); setLoading(false); return }
      if (data.ended)   { setError('Esta transmissão já terminou.'); setLoading(false); return }

      setStream(data)
      setLoading(false)
    }
    load()
  }, [streamId, router])

  async function endStream() {
    const supabase = createClient()
    await supabase.from('live_streams').update({ ended: true }).eq('id', streamId)
    router.push('/live')
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3" style={{ background: '#000' }}>
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>A carregar…</p>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center" style={{ background: '#000' }}>
      <p className="text-5xl">📡</p>
      <p className="font-medium text-white">{error}</p>
      <button onClick={() => router.push('/live')}
        className="px-6 py-2.5 rounded-full text-sm font-semibold"
        style={{ background: '#3797F0', color: '#fff' }}>
        Voltar ao direto
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50" style={{ background: '#000' }}>
      {role === 'broadcaster' ? (
        <LiveBroadcast
          streamId={streamId}
          title={stream?.title ?? 'Transmissão ao vivo'}
          onEnd={endStream}
        />
      ) : (
        <LiveViewer
          streamId={streamId}
          streamerName={stream?.host?.full_name ?? stream?.host?.username ?? 'Anfitrião'}
          streamerAvatar={stream?.host?.avatar_url}
          onLeave={() => router.push('/live')}
        />
      )}
    </div>
  )
}
