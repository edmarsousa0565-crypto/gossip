'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

interface Props {
  streamId: string
  title: string
  onEnd: () => void
}

export default function LiveBroadcast({ streamId, title, onEnd }: Props) {
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pcsRef         = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef     = useRef<any>(null)
  const pendingIceRef  = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const viewerCountRef = useRef(0)

  const [viewerCount, setViewerCount] = useState(0)
  const [micMuted,    setMicMuted]    = useState(false)
  const [camOff,      setCamOff]      = useState(false)
  const [elapsed,     setElapsed]     = useState(0)
  const [chatInput,   setChatInput]   = useState('')
  const [chat,        setChat]        = useState<{ name: string; text: string }[]>([])
  const [error,       setError]       = useState<string | null>(null)
  const [myUsername,  setMyUsername]  = useState('Anfitrião')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  function fmt(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const handleViewerOffer = useCallback(async (viewerId: string, offer: RTCSessionDescriptionInit) => {
    const ch = channelRef.current
    if (!ch || !localStreamRef.current) return
    const supabase = createClient()

    const pc = new RTCPeerConnection({ iceServers: ICE })
    pcsRef.current.set(viewerId, pc)

    localStreamRef.current.getTracks().forEach(t =>
      pc.addTrack(t, localStreamRef.current!))

    pc.onicecandidate = (e) => {
      if (e.candidate)
        ch.send({ type: 'broadcast', event: 'broadcaster-ice',
          payload: { viewerId, candidate: e.candidate.toJSON() } })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pcsRef.current.delete(viewerId)
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    // Drain buffered ICE
    const pending = pendingIceRef.current.get(viewerId) ?? []
    pendingIceRef.current.delete(viewerId)
    for (const c of pending) try { await pc.addIceCandidate(c) } catch {}

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    ch.send({ type: 'broadcast', event: 'broadcaster-answer',
      payload: { viewerId, answer: { type: answer.type, sdp: answer.sdp } } })

    viewerCountRef.current++
    setViewerCount(viewerCountRef.current)
    supabase.from('live_streams').update({ viewer_count: viewerCountRef.current }).eq('id', streamId).then(() => {})
  }, [streamId])

  useEffect(() => {
    let destroyed = false
    const supabase = createClient()

    async function setup() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('username').eq('id', user.id).single()
        if (p?.username) setMyUsername(p.username)
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user', width: 1280, height: 720 } })
      } catch {
        setError('Sem acesso à câmara/microfone. Verifica as permissões do browser.')
        return
      }
      if (destroyed) { stream.getTracks().forEach(t => t.stop()); return }
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      const ch = supabase.channel(`live-sig:${streamId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      channelRef.current = ch

      ch.on('broadcast', { event: 'viewer-offer' }, ({ payload }) => {
        if (!destroyed) handleViewerOffer(payload.viewerId, payload.offer)
      })

      ch.on('broadcast', { event: 'viewer-ice' }, async ({ payload }) => {
        if (destroyed) return
        const { viewerId, candidate } = payload
        const pc = pcsRef.current.get(viewerId)
        if (pc?.remoteDescription) {
          try { await pc.addIceCandidate(candidate) } catch {}
        } else {
          const buf = pendingIceRef.current.get(viewerId) ?? []
          buf.push(candidate); pendingIceRef.current.set(viewerId, buf)
        }
      })

      ch.on('broadcast', { event: 'viewer-leave' }, ({ payload }) => {
        pcsRef.current.get(payload.viewerId)?.close()
        pcsRef.current.delete(payload.viewerId)
        viewerCountRef.current = Math.max(0, viewerCountRef.current - 1)
        setViewerCount(viewerCountRef.current)
        supabase.from('live_streams').update({ viewer_count: viewerCountRef.current }).eq('id', streamId).then(() => {})
      })

      ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChat(prev => [...prev.slice(-99), { name: payload.name, text: payload.text }])
      })

      ch.subscribe()
    }

    setup().catch(() => setError('Erro ao iniciar a transmissão.'))

    return () => {
      destroyed = true
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      pcsRef.current.forEach(pc => pc.close())
      pcsRef.current.clear()
      const supabase = createClient()
      supabase.removeChannel(channelRef.current)
    }
  }, [streamId, handleViewerOffer])

  function toggleMic() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = micMuted })
    setMicMuted(v => !v)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOff })
    setCamOff(v => !v)
  }

  function sendChat() {
    const text = chatInput.trim(); if (!text) return
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: { name: myUsername, text } })
    setChat(prev => [...prev.slice(-99), { name: myUsername, text }])
    setChatInput('')
  }

  async function endStream() {
    channelRef.current?.send({ type: 'broadcast', event: 'stream-end', payload: {} })
    const supabase = createClient()
    await supabase.from('live_streams').update({ ended: true }).eq('id', streamId)
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcsRef.current.forEach(pc => pc.close())
    onEnd()
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6" style={{ background: '#000' }}>
      <p className="text-4xl">⚠️</p>
      <p className="font-semibold text-white">{error}</p>
      <button onClick={onEnd} className="px-6 py-2.5 rounded-full text-sm font-semibold" style={{ background: '#ff3b30', color: '#fff' }}>Fechar</button>
    </div>
  )

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row" style={{ background: '#000' }}>
      {/* ── Camera ──────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <video ref={localVideoRef} autoPlay playsInline muted
          className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />

        {/* Top HUD */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4"
          style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,0.75) 0%,transparent 100%)' }}>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold text-white" style={{ background: '#ff3b30' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
            </span>
            <span className="text-[13px] font-mono text-white/70">{fmt(elapsed)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold text-white"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            {viewerCount}
          </div>
        </div>

        {/* Title */}
        <div className="absolute top-16 left-4">
          <p className="font-semibold text-white text-[14px] drop-shadow">{title}</p>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 p-6"
          style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.8) 0%,transparent 100%)' }}>
          <button onClick={toggleMic}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: micMuted ? '#ff3b30' : 'rgba(255,255,255,0.18)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              {micMuted
                ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2"/><path d="M12 19v3M8 23h8"/></>
                : <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 23h8"/></>}
            </svg>
          </button>

          <button onClick={endStream}
            className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-[13px] text-white shadow-lg active:scale-90"
            style={{ background: '#ff3b30' }}>
            FIM
          </button>

          <button onClick={toggleCam}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: camOff ? '#ff3b30' : 'rgba(255,255,255,0.18)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              {camOff
                ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h3a2 2 0 012 2v9.34"/></>
                : <><rect x="2" y="6" width="14" height="12" rx="2"/><polygon points="22 7 16 11 16 13 22 17"/></>}
            </svg>
          </button>
        </div>
      </div>

      {/* ── Chat sidebar ────────────────────────────────── */}
      <div className="w-full md:w-72 flex flex-col h-48 md:h-auto shrink-0"
        style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.08)', borderLeft: 'none' }}>
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="font-semibold text-white text-[14px]">Chat ao vivo</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'none' }}>
          {chat.length === 0 && <p className="text-center text-[12px] pt-6" style={{ color: 'rgba(255,255,255,0.3)' }}>Sem mensagens ainda</p>}
          {chat.map((m, i) => (
            <div key={i} className="flex gap-2 items-baseline">
              <span className="text-[12px] font-semibold shrink-0" style={{ color: '#3797F0' }}>{m.name}</span>
              <span className="text-[13px] text-white/80 break-words">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 rounded-full px-4 py-2.5"
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendChat() }}
              placeholder="Mensagem…"
              className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30" />
            <button onClick={sendChat} style={{ color: '#3797F0' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
