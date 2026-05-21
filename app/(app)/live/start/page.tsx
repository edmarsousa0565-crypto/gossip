'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LiveStartPage() {
  const [title,    setTitle]    = useState('')
  const [starting, setStarting] = useState(false)
  const [error,    setError]    = useState('')
  const router = useRouter()

  async function goLive() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setStarting(true)
    setError('')

    try {
      // 1. Cria o stream
      const { data: stream, error: err } = await supabase
        .from('live_streams')
        .insert({
          user_id:  user.id,
          room_name: `live-${user.id}-${Date.now()}`,
          title: title.trim() || 'Transmissão ao vivo',
          ended: false,
          viewer_count: 0,
        })
        .select()
        .single()

      if (err || !stream) throw new Error(err?.message ?? 'Erro ao criar stream')

      // 2. Notifica seguidores em paralelo (não bloqueia)
      notifyFollowers(supabase, user.id, stream.id, stream.title).catch(() => {})

      router.push(`/live/${stream.id}?role=broadcaster`)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao iniciar o direto.')
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#000' }}>
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.3)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          </div>
          <h1 className="font-bold text-white text-[22px]">Ir ao vivo</h1>
          <p className="text-[14px] mt-1 text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
            A tua câmara e microfone serão ligados
          </p>
        </div>

        {/* Title input */}
        <div className="mb-4">
          <label className="text-[12px] font-medium mb-2 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Título (opcional)
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !starting) goLive() }}
            placeholder="Sobre o que é o teu direto?"
            maxLength={80}
            className="w-full text-[15px] text-white outline-none placeholder:text-white/30"
            style={{
              background: '#1c1c1e',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '14px 16px',
            }}
          />
        </div>

        {error && (
          <p className="text-[13px] mb-4 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.2)' }}>
            {error}
          </p>
        )}

        {/* Info */}
        <div className="flex items-center gap-2 mb-5 px-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Os teus seguidores serão notificados automaticamente
          </p>
        </div>

        {/* Go live */}
        <button
          onClick={goLive}
          disabled={starting}
          className="w-full py-4 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2.5 transition-opacity disabled:opacity-50 active:scale-[0.98]"
          style={{ background: '#ff3b30' }}>
          {starting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              A iniciar…
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Começar direto
            </>
          )}
        </button>

        <button
          onClick={() => router.back()}
          className="w-full py-3 mt-3 text-[14px] font-medium transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.45)' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

async function notifyFollowers(
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  userId: string,
  streamId: string,
  streamTitle: string,
) {
  // Busca perfil do broadcaster
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', userId)
    .single()

  const name = profile?.full_name || profile?.username || 'Alguém'

  // Busca todos os seguidores
  const { data: followers } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId)

  if (!followers || followers.length === 0) return

  // Insere notificação para cada seguidor (em batch)
  await supabase.from('notifications').insert(
    followers.map(f => ({
      user_id:    f.follower_id,
      type:       'live_start',
      actor_id:   userId,
      ref_id:     streamId,
      ref_type:   'live_stream',
      actor_name: name,
      content:    `${name} começou um direto: "${streamTitle}"`,
      read:       false,
    }))
  )
}
