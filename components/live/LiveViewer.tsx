'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

interface Props {
  streamId: string
  streamerName: string
  streamerAvatar?: string | null
  onLeave: () => void
}

export default function LiveViewer({ streamId, streamerName, streamerAvatar, onLeave }: Props) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef          = useRef<RTCPeerConnection | null>(null)
  const channelRef     = useRef<any>(null)
  const viewerIdRef    = useRef(crypto.randomUUID())
  const pendingIceRef  = useRef<RTCIceCandidateInit[]>([])

  const [connected,  setConnected]  = useState(false)
  const [ended,      setEnded]      = useState(false)
  const [chatInput,  setChatInput]  = useState('')
  const [chat,       setChat]       = useState<{ name: string; text: string }[]>([])
  const [myUsername, setMyUsername] = useState('Espetador')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  useEffect(() => {
    let destroyed = false
    const supabase = createClient()
    const viewerId = viewerIdRef.current

    async function setup() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('username').eq('id', user.id).single()
        if (p?.username) setMyUsername(p.username)
      }

      const pc = new RTCPeerConnection({ iceServers: ICE })
      pcRef.current = pc

      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
        setConnected(true)
      }

      const ch = supabase.channel(`live-sig:${streamId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      channelRef.current = ch

      // Broadcaster's answer
      ch.on('broadcast', { event: 'broadcaster-answer' }, async ({ payload }) => {
        if (payload.viewerId !== viewerId || destroyed) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
          // drain pending ICE
          const pending = pendingIceRef.current.splice(0)
          for (const c of pending) try { await pc.addIceCandidate(c) } catch {}
        } catch {}
      })

      // ICE from broadcaster
      ch.on('broadcast', { event: 'broadcaster-ice' }, async ({ payload }) => {
        if (payload.viewerId !== viewerId || destroyed) return
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(payload.candidate) } catch {}
        } else {
          pendingIceRef.current.push(payload.candidate)
        }
      })

      // Stream ended by broadcaster
      ch.on('broadcast', { event: 'stream-end' }, () => setEnded(true))

      // Chat
      ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChat(prev => [...prev.slice(-99), { name: payload.name, text: payload.text }])
      })

      // ICE from us → broadcaster
      pc.onicecandidate = (e) => {
        if (e.candidate)
          ch.send({ type: 'broadcast', event: 'viewer-ice',
            payload: { viewerId, candidate: e.candidate.toJSON() } })
      }

      // Subscribe → send offer
      ch.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || destroyed) return

        const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
        await pc.setLocalDescription(offer)

        ch.send({ type: 'broadcast', event: 'viewer-offer',
          payload: { viewerId, offer: { type: offer.type, sdp: offer.sdp } } })
      })
    }

    setup().catch(() => {})

    return () => {
      destroyed = true
      channelRef.current?.send({ type: 'broadcast', event: 'viewer-leave', payload: { viewerId } })
      pcRef.current?.close()
      const supabase = createClient()
      supabase.removeChannel(channelRef.current)
    }
  }, [streamId])

  function sendChat() {
    const text = chatInput.trim(); if (!text) return
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: { name: myUsername, text } })
    setChat(prev => [...prev.slice(-99), { name: myUsername, text }])
    setChatInput('')
  }

  if (ended) return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6" style={{ background: '#000' }}>
      <p className="text-5xl">📡</p>
      <p className="font-semibold text-white text-lg">O direto terminou</p>
      <button onClick={onLeave} className="px-6 py-2.5 rounded-full text-sm font-semibold" style={{ background: '#3797F0', color: '#fff' }}>
        Voltar
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      {/* ── Video ──────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <video ref={remoteVideoRef} autoPlay playsInline
          className="w-full h-full object-cover" />

        {/* Waiting / connecting */}
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5"
            style={{ background: 'rgba(0,0,0,0.85)' }}>
            {streamerAvatar
              ? <img src={streamerAvatar} alt="" className="w-24 h-24 rounded-full object-cover" style={{ border: '3px solid rgba(255,59,48,0.5)' }} />
              : <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl" style={{ background: '#1c1c1e' }}>📡</div>
            }
            <p className="font-semibold text-white text-lg">{streamerName}</p>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>A ligar ao direto…</p>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4"
          style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)' }}>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold text-white" style={{ background: '#ff3b30' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
            </span>
            <span className="font-semibold text-white text-[14px]">{streamerName}</span>
          </div>
          <button onClick={onLeave}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Chat overlay (bottom, above input) */}
        <div className="absolute bottom-16 left-0 right-0 px-4 space-y-1.5 pointer-events-none"
          style={{ maxHeight: '35%', overflow: 'hidden' }}>
          {chat.slice(-8).map((m, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <span className="text-[12px] font-semibold shrink-0" style={{ color: '#3797F0' }}>{m.name}</span>
              <span className="text-[13px] text-white break-words drop-shadow">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex-1 flex items-center gap-2 rounded-full px-4 py-2.5"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.18)' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendChat() }}
                placeholder="Comentar…"
                className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40" />
            </div>
            {chatInput.trim() && (
              <button onClick={sendChat}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90"
                style={{ background: '#3797F0' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
