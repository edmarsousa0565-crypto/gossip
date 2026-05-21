'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

interface Props {
  callId: string
  type: 'voice' | 'video'
  isCaller: boolean
  otherName?: string | null
  otherAvatar?: string | null
  onEnd: () => void
}

export default function CallView({ callId, type, isCaller, otherName, otherAvatar, onEnd }: Props) {
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef          = useRef<RTCPeerConnection | null>(null)
  const channelRef     = useRef<any>(null)
  const pendingIceRef  = useRef<RTCIceCandidateInit[]>([])
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const [connected, setConnected] = useState(false)
  const [duration,  setDuration]  = useState(0)
  const [micMuted,  setMicMuted]  = useState(false)
  const [camOff,    setCamOff]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    let destroyed = false
    const supabase = createClient()

    async function setup() {
      // ── 1. Peer connection ───────────────────────────────
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc

      // ── 2. Local media ───────────────────────────────────
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' })
      } catch {
        setError('Sem acesso ao microfone / câmara. Verifica as permissões no browser.')
        return
      }
      if (destroyed) { stream.getTracks().forEach(t => t.stop()); return }

      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      // ── 3. Remote tracks ─────────────────────────────────
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
        if (!connected) {
          setConnected(true)
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
        }
      }

      // ── 4. Realtime signalling channel ───────────────────
      const ch = supabase.channel(`call-sig:${callId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      channelRef.current = ch

      // Apply ICE, buffering until remoteDescription is set
      async function applyIce(candidate: RTCIceCandidateInit) {
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(candidate) } catch {}
          // drain buffer
          const pending = pendingIceRef.current.splice(0)
          for (const c of pending) try { await pc.addIceCandidate(c) } catch {}
        } else {
          pendingIceRef.current.push(candidate)
        }
      }

      async function drainIce() {
        const pending = pendingIceRef.current.splice(0)
        for (const c of pending) try { await pc.addIceCandidate(c) } catch {}
      }

      ch.on('broadcast', { event: 'ice' }, ({ payload }) => {
        if (!destroyed) applyIce(payload.candidate)
      })

      if (isCaller) {
        // Caller waits for the answer
        ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (destroyed) return
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
            await drainIce()
          } catch {}
        })
      }

      // ── 5. Subscribe → start signalling ──────────────────
      ch.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || destroyed) return

        // From this point, send ICE candidates immediately
        pc.onicecandidate = (e) => {
          if (e.candidate)
            ch.send({ type: 'broadcast', event: 'ice', payload: { candidate: e.candidate.toJSON() } })
        }

        if (isCaller) {
          // Create offer → store in DB
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await supabase.from('calls')
            .update({ offer: JSON.stringify(offer) })
            .eq('id', callId)
        } else {
          // Callee: fetch offer (retry up to 6×, 1 s apart)
          let offerJson: string | null = null
          for (let i = 0; i < 6 && !destroyed; i++) {
            const { data } = await supabase.from('calls').select('offer').eq('id', callId).single()
            if (data?.offer) { offerJson = data.offer; break }
            await new Promise(r => setTimeout(r, 1000))
          }
          if (!offerJson || destroyed) { setError('Não foi possível obter os dados da chamada.'); return }

          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(offerJson)))
          await drainIce()

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          ch.send({ type: 'broadcast', event: 'answer', payload: { answer: { type: answer.type, sdp: answer.sdp } } })
        }
      })
    }

    setup().catch(() => setError('Erro ao iniciar a chamada.'))

    return () => {
      destroyed = true
      if (timerRef.current) clearInterval(timerRef.current)
      pcRef.current?.close()
      const supabase = createClient()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [callId, type, isCaller]) // eslint-disable-line

  function toggleMic() {
    pcRef.current?.getSenders().filter(s => s.track?.kind === 'audio')
      .forEach(s => { if (s.track) s.track.enabled = micMuted })
    setMicMuted(v => !v)
  }

  function toggleCam() {
    pcRef.current?.getSenders().filter(s => s.track?.kind === 'video')
      .forEach(s => { if (s.track) s.track.enabled = camOff })
    setCamOff(v => !v)
  }

  async function endCall() {
    const supabase = createClient()
    await supabase.from('calls').update({ status: 'ended' }).eq('id', callId)
    pcRef.current?.close()
    onEnd()
  }

  function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  // ─── Error screen ─────────────────────────────────────────────
  if (error) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.96)' }}>
      <div className="text-center p-8 max-w-xs">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="font-semibold text-white mb-2 text-[15px]">{error}</p>
        <button onClick={onEnd}
          className="mt-4 px-6 py-2.5 rounded-full text-sm font-semibold"
          style={{ background: '#ff3b30', color: '#fff' }}>
          Fechar
        </button>
      </div>
    </div>
  )

  // ─── Call screen ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#000' }}>

      {/* ── Video call ─────────────────────────────────── */}
      {type === 'video' ? (
        <div className="flex-1 relative overflow-hidden" style={{ background: '#0a0a0a' }}>
          {/* Remote */}
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {/* Waiting overlay */}
          {!connected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
              <div className="relative">
                {otherAvatar
                  ? <img src={otherAvatar} alt="" className="w-28 h-28 rounded-full object-cover" style={{ border: '3px solid rgba(55,151,240,0.5)' }} />
                  : <div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl" style={{ background: '#1c1c1e' }}>👤</div>
                }
                <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(55,151,240,0.15)' }} />
              </div>
              <p className="font-semibold text-white text-lg">{otherName}</p>
              <p className="text-sm animate-pulse" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {isCaller ? 'A chamar…' : 'A conectar…'}
              </p>
            </div>
          )}

          {/* Local PiP */}
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-28 right-4 w-24 h-36 rounded-2xl object-cover shadow-2xl"
            style={{ border: '1.5px solid rgba(255,255,255,0.2)' }} />

          {/* Duration badge */}
          {connected && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-mono"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', color: 'rgba(255,255,255,0.7)' }}>
              {fmt(duration)}
            </div>
          )}
        </div>
      ) : (
        /* ── Voice call ────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center gap-6"
          style={{ background: 'linear-gradient(180deg,#0f1b2d 0%,#000 100%)' }}>
          <div className="relative">
            {otherAvatar
              ? <img src={otherAvatar} alt="" className="w-32 h-32 rounded-full object-cover"
                  style={{ border: '3px solid rgba(55,151,240,0.4)' }} />
              : <div className="w-32 h-32 rounded-full flex items-center justify-center text-5xl"
                  style={{ background: '#1c1c1e', border: '3px solid rgba(55,151,240,0.3)' }}>👤</div>
            }
            {!connected && (
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(55,151,240,0.12)' }} />
            )}
          </div>
          <div className="text-center">
            <p className="font-semibold text-white text-xl mb-1">{otherName}</p>
            <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {connected
                ? fmt(duration)
                : <span className="animate-pulse">{isCaller ? 'A chamar…' : 'A conectar…'}</span>
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Controls ───────────────────────────────────── */}
      <div className="flex items-center justify-center gap-6 py-8 px-6 shrink-0"
        style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(24px)' }}>

        {/* Mic */}
        <button onClick={toggleMic}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: micMuted ? '#ff3b30' : 'rgba(255,255,255,0.14)' }}
          aria-label={micMuted ? 'Ativar mic' : 'Silenciar'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {micMuted ? (
              <>
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v3M8 23h8"/>
              </>
            ) : (
              <>
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 23h8"/>
              </>
            )}
          </svg>
        </button>

        {/* End call */}
        <button onClick={endCall}
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90"
          style={{ background: '#ff3b30' }}
          aria-label="Terminar chamada">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.927.344 1.888.58 2.85.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2c-3.506-.445-6.866-1.89-9.57-4.1A19.68 19.68 0 013.13 9.72 2 2 0 015 7.54h3a2 2 0 011.72 1.45c.12.962.356 1.923.7 2.85a2 2 0 01-.45 2.11L8.68 15.17"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>

        {/* Camera (video only) */}
        {type === 'video' && (
          <button onClick={toggleCam}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: camOff ? '#ff3b30' : 'rgba(255,255,255,0.14)' }}
            aria-label={camOff ? 'Ligar câmara' : 'Desligar câmara'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {camOff ? (
                <>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h3a2 2 0 012 2v9.34"/>
                  <path d="M15 13a3 3 0 11-4.24-4.24"/>
                </>
              ) : (
                <>
                  <rect x="2" y="6" width="14" height="12" rx="2"/>
                  <polygon points="22 7 16 11 16 13 22 17"/>
                </>
              )}
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
