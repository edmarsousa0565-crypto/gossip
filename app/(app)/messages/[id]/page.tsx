'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import MentionTextarea from '@/components/feed/MentionTextarea'
import CallView from '@/components/calls/CallView'
import AudioRecorder from '@/components/messages/AudioRecorder'
import QuickReplies from '@/components/messages/QuickReplies'
import { useNetworkInfo } from '@/hooks/useNetworkInfo'
import { useHaptic } from '@/hooks/useHaptic'
import type { Message, Profile } from '@/lib/supabase/types'

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type MsgGroup = { senderId: string; messages: Message[]; isMe: boolean }

function groupMessages(msgs: Message[], myId: string): MsgGroup[] {
  const groups: MsgGroup[] = []
  for (const m of msgs) {
    const last = groups[groups.length - 1]
    const isMe = m.sender_id === myId
    if (last && last.senderId === m.sender_id) {
      const gap = new Date(m.created_at).getTime() - new Date(last.messages[last.messages.length - 1].created_at).getTime()
      if (gap < 3 * 60 * 1000) { last.messages.push(m); continue }
    }
    groups.push({ senderId: m.sender_id, messages: [m], isMe })
  }
  return groups
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const [otherId, setOtherId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [me, setMe] = useState<Profile | null>(null)
  const [other, setOther] = useState<Profile | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [activeCall, setActiveCall] = useState<{ callId: string; roomName: string; token: string; type: 'voice' | 'video' } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [playedOnce, setPlayedOnce] = useState<Set<string>>(new Set())
  const [mediaUploading, setMediaUploading] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdMovedRef = useRef(false)
  const router = useRouter()
  const network = useNetworkInfo()
  const { tap } = useHaptic()

  useEffect(() => { params.then(p => setOtherId(p.id)) }, [params])

  useEffect(() => {
    if (!otherId || !me) return
    try {
      const h = localStorage.getItem(`hidden-msgs-${me.id}-${otherId}`)
      if (h) setHiddenIds(new Set(JSON.parse(h)))
      const p = localStorage.getItem(`played-once-${me.id}`)
      if (p) setPlayedOnce(new Set(JSON.parse(p)))
    } catch {}
  }, [otherId, me?.id])

  useEffect(() => {
    if (!selectedMsgId) return
    function close(e: MouseEvent) {
      const target = e.target as Element
      if (!target.closest('[data-msg-bubble]')) setSelectedMsgId(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('touchstart', close as any)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('touchstart', close as any)
    }
  }, [selectedMsgId])

  useEffect(() => {
    if (!otherId) return
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel>

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: myProfile }, { data: otherProfile }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('profiles').select('*').eq('id', otherId).single(),
      ])
      if (myProfile) setMe(myProfile)
      if (otherProfile) setOther(otherProfile)

      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      if (data) setMessages(data as Message[])

      supabase.from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id).eq('sender_id', otherId).eq('read', false)
        .then(() => {})

      channel = supabase.channel(`conv:${[user.id, otherId].sort().join(':')}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          const msg = payload.new as Message
          if (
            (msg.sender_id === user.id && msg.receiver_id === otherId) ||
            (msg.sender_id === otherId && msg.receiver_id === user.id)
          ) {
            setMessages(prev => [...prev, msg])
            if (msg.sender_id === otherId)
              supabase.from('messages').update({ read: true }).eq('id', msg.id).then(() => {})
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } as Message : m))
        })
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [otherId, router])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function startCall(type: 'voice' | 'video') {
    if (!me) return
    const supabase = createClient()
    const roomName = `call-${me.id}-${otherId}-${Date.now()}`
    const { data: callRow, error } = await supabase
      .from('calls').insert({ caller_id: me.id, callee_id: otherId, room_name: roomName, type, status: 'ringing' })
      .select().single()
    if (error || !callRow) return
    const res = await fetch('/api/livekit-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantName: me.id, role: 'publisher' }),
    })
    if (!res.ok) {
      alert('Chamadas não configuradas. Adiciona NEXT_PUBLIC_LIVEKIT_URL ao Vercel.')
      await supabase.from('calls').update({ status: 'ended' }).eq('id', callRow.id)
      return
    }
    const { token } = await res.json()
    setActiveCall({ callId: callRow.id, roomName, token, type })
  }

  async function endCall() {
    if (!activeCall) return
    const supabase = createClient()
    await supabase.from('calls').update({ status: 'ended' }).eq('id', activeCall.callId)
    setActiveCall(null)
  }

  async function send() {
    const text = input.trim()
    if (!text || !me || sending) return
    tap()
    setSending(true)
    setInput('')
    const supabase = createClient()
    await supabase.from('messages').insert({ sender_id: me.id, receiver_id: otherId, content: text })
    setSending(false)
  }

  async function quickSend(text: string) {
    if (!me) return
    const supabase = createClient()
    await supabase.from('messages').insert({ sender_id: me.id, receiver_id: otherId, content: text })
  }

  async function sendAudio(audioUrl: string, duration: number, viewOnce: boolean) {
    if (!me) return
    const prefix = viewOnce ? '[audio-once]' : '[audio]'
    const supabase = createClient()
    await supabase.from('messages').insert({
      sender_id: me.id, receiver_id: otherId,
      content: `${prefix}:${audioUrl}:${duration}`,
    })
  }

  async function sendMedia(file: File) {
    if (!me) return
    if (file.size > 500 * 1024 * 1024) { alert('Ficheiro demasiado grande (máx 500 MB)'); return }
    setMediaUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('messages').upload(path, file, { cacheControl: '31536000', upsert: false })
    if (error || !data) { setMediaUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('messages').getPublicUrl(path)
    const isVideo = file.type.startsWith('video/')
    const prefix = isVideo ? '[video]' : '[image]'
    await supabase.from('messages').insert({ sender_id: me.id, receiver_id: otherId, content: `${prefix}:${publicUrl}` })
    setMediaUploading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function startEdit(msg: Message) {
    setEditingId(msg.id)
    setEditText(msg.content)
    setSelectedMsgId(null)
  }

  async function saveEdit(msgId: string) {
    const text = editText.trim()
    if (!text) return
    const supabase = createClient()
    await supabase.from('messages').update({ content: text }).eq('id', msgId)
    setEditingId(null)
  }

  function cancelEdit() { setEditingId(null); setEditText('') }

  function deleteForMe(msgId: string) {
    const next = new Set(hiddenIds)
    next.add(msgId)
    setHiddenIds(next)
    if (me) localStorage.setItem(`hidden-msgs-${me.id}-${otherId}`, JSON.stringify([...next]))
    setSelectedMsgId(null)
  }

  async function deleteForAll(msgId: string) {
    if (!me) return
    const supabase = createClient()
    await supabase.from('messages').update({ content: '[deleted]' }).eq('id', msgId).eq('sender_id', me.id)
    setSelectedMsgId(null)
  }

  function markPlayed(msgId: string) {
    const next = new Set(playedOnce)
    next.add(msgId)
    setPlayedOnce(next)
    if (me) localStorage.setItem(`played-once-${me.id}`, JSON.stringify([...next]))
  }

  function startHold(msgId: string) {
    holdMovedRef.current = false
    holdTimerRef.current = setTimeout(() => {
      if (!holdMovedRef.current) {
        setSelectedMsgId(prev => prev === msgId ? null : msgId)
        if (navigator.vibrate) navigator.vibrate(40)
      }
    }, 500)
  }

  function cancelHold() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
  }

  // ─── Bubble renderer ──────────────────────────────────────────
  function renderBubble(m: Message, group: MsgGroup, isLastInGroup: boolean) {
    if (hiddenIds.has(m.id)) return null

    const isSelected = selectedMsgId === m.id
    const isDeleted = m.content === '[deleted]'
    const isAudioOnce = m.content.startsWith('[audio-once]:')
    const isAudio = m.content.startsWith('[audio]:')
    const isImage = m.content.startsWith('[image]:')
    const isVideo = m.content.startsWith('[video]:')

    // ─── Sent bubble radius: round on all except bottom-right corner (tail)
    // ─── Received: all round except bottom-left corner
    const sentR = `18px 18px ${isLastInGroup ? '4px' : '18px'} 18px`
    const recvR = `18px 18px 18px ${isLastInGroup ? '4px' : '18px'}`
    const bubbleRadius = group.isMe ? sentR : recvR

    const sentBg = '#3797F0'
    const recvBg = '#262626'

    const actionBar = isSelected && (
      <div className={`flex items-center gap-1.5 mt-1.5 ${group.isMe ? 'justify-end' : 'justify-start'}`}>
        {group.isMe && !isDeleted && (
          <button onClick={() => startEdit(m)}
            className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full transition-colors"
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
            Editar
          </button>
        )}
        <button onClick={() => deleteForMe(m.id)}
          className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full transition-colors"
          style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
          Para mim
        </button>
        {group.isMe && (
          <button onClick={() => deleteForAll(m.id)}
            className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full transition-colors"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            Para todos
          </button>
        )}
        <button onClick={() => setSelectedMsgId(null)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-colors"
          style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
          ✕
        </button>
      </div>
    )

    if (isDeleted) {
      return (
        <div className="flex flex-col gap-1">
          <div className="px-4 py-2.5 text-sm italic text-white/30 rounded-[18px] border border-white/10">
            🚫 Mensagem apagada
          </div>
          {actionBar}
        </div>
      )
    }

    if (isAudioOnce || isAudio) {
      const rest = m.content.slice((isAudioOnce ? '[audio-once]:' : '[audio]:').length)
      const dur = Number(rest.split(':').pop())
      const url = rest.slice(0, rest.lastIndexOf(':'))
      const alreadyPlayed = playedOnce.has(m.id)

      let bubbleContent: React.ReactNode

      if (isAudioOnce && group.isMe) {
        bubbleContent = (
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: sentBg, borderRadius: bubbleRadius }}>
            <span>👁</span>
            <span className="text-sm text-white">Uma vez · {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, '0')}</span>
          </div>
        )
      } else if (isAudioOnce && !group.isMe) {
        bubbleContent = alreadyPlayed ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-[18px]" style={{ background: recvBg }}>
            <span>🔊</span>
            <span className="text-sm text-white/50">Ouvido</span>
          </div>
        ) : (
          <button onClick={() => { markPlayed(m.id); new Audio(url).play().catch(() => {}) }}
            className="flex items-center gap-3 px-4 py-3 rounded-[18px] transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,149,0,0.2)', border: '1px solid rgba(255,149,0,0.35)' }}>
            <span className="text-xl">🎧</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Ouvir (uma vez)</p>
              <p className="text-xs text-white/50">{Math.floor(dur / 60)}:{String(dur % 60).padStart(2, '0')}</p>
            </div>
          </button>
        )
      } else {
        bubbleContent = (
          <div className="flex items-center gap-3 px-4 py-3 min-w-[180px] max-w-[260px]"
            style={{ background: group.isMe ? sentBg : recvBg, borderRadius: bubbleRadius }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3zm7 9a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.08A7 7 0 0019 11z"/>
            </svg>
            <audio src={url} controls preload="metadata" className="h-8 flex-1" />
            <span className="text-[10px] text-white/60 shrink-0">{Math.floor(dur / 60)}:{String(dur % 60).padStart(2, '0')}</span>
          </div>
        )
      }

      return (
        <div data-msg-bubble className="flex flex-col gap-1">
          <div onPointerDown={() => startHold(m.id)} onPointerUp={cancelHold} onPointerCancel={cancelHold}
            onPointerMove={() => { holdMovedRef.current = true; cancelHold() }}
            onContextMenu={e => e.preventDefault()}
            className={`transition-opacity select-none cursor-pointer ${isSelected ? 'opacity-70' : ''}`}
            style={{ touchAction: 'pan-y' }}>
            {bubbleContent}
          </div>
          {actionBar}
        </div>
      )
    }

    if (isImage || isVideo) {
      const url = m.content.slice(isImage ? '[image]:'.length : '[video]:'.length)
      return (
        <div data-msg-bubble className="flex flex-col gap-1">
          <div onPointerDown={() => startHold(m.id)} onPointerUp={cancelHold} onPointerCancel={cancelHold}
            onPointerMove={() => { holdMovedRef.current = true; cancelHold() }}
            onContextMenu={e => e.preventDefault()}
            className={`overflow-hidden select-none cursor-pointer transition-opacity max-w-[260px] ${isSelected ? 'opacity-70' : ''}`}
            style={{ borderRadius: bubbleRadius, touchAction: 'pan-y' }}>
            {isVideo ? (
              <video src={url} controls playsInline preload="metadata" className="w-full max-h-64 object-cover bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="media" loading="lazy" decoding="async" className="w-full max-h-64 object-cover" />
            )}
          </div>
          {actionBar}
        </div>
      )
    }

    // Text bubble
    return (
      <div data-msg-bubble className="flex flex-col gap-1">
        <div onPointerDown={() => startHold(m.id)} onPointerUp={cancelHold} onPointerCancel={cancelHold}
          onPointerMove={() => { holdMovedRef.current = true; cancelHold() }}
          onContextMenu={e => e.preventDefault()}
          className={`px-4 py-2.5 text-[14px] leading-snug break-words select-none cursor-pointer transition-opacity ${isSelected ? 'opacity-70 scale-[0.98]' : ''}`}
          style={{
            background: group.isMe ? sentBg : recvBg,
            color: '#fff',
            borderRadius: bubbleRadius,
            touchAction: 'pan-y',
            willChange: 'opacity',
          }}>
          {m.content}
        </div>
        {actionBar}
      </div>
    )
  }

  const groups = groupMessages(messages, me?.id ?? '')
  const lastSentIdx = [...messages].reverse().findIndex(m => m.sender_id === me?.id)
  const lastSentId = lastSentIdx >= 0 ? messages[messages.length - 1 - lastSentIdx]?.id : null

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#000' }}>

      {/* ─── Header ─────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-2 border-b shrink-0 z-10"
        style={{
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(12px)',
          borderColor: 'rgba(255,255,255,0.08)',
          paddingTop: `calc(0.625rem + env(safe-area-inset-top, 0px))`,
          paddingBottom: '0.625rem',
        }}>

        <button onClick={() => router.back()}
          className="p-2 rounded-full transition-colors hover:bg-white/[0.06] shrink-0"
          style={{ color: '#3797F0' }}
          aria-label="Voltar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {other ? (
          <Link href={`/profile/${other.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <div className="relative shrink-0">
              <Avatar src={other.avatar_url} name={other.full_name} size={38} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white leading-tight truncate">{other.full_name ?? other.username}</p>
              <p className="text-[12px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>@{other.username}</p>
            </div>
          </Link>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full animate-pulse bg-white/10" />
            <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
          </div>
        )}

        {network.speed === 'offline' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">
            Offline
          </span>
        )}

        <button onClick={() => startCall('voice')}
          className="p-2.5 rounded-full transition-colors hover:bg-white/[0.06] shrink-0"
          style={{ color: 'rgba(255,255,255,0.8)' }}
          aria-label="Chamada de voz">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 015 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
        </button>
        <button onClick={() => startCall('video')}
          className="p-2.5 rounded-full transition-colors hover:bg-white/[0.06] shrink-0"
          style={{ color: 'rgba(255,255,255,0.8)' }}
          aria-label="Vídeo chamada">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="14" height="12" rx="2"/><polygon points="22 7 16 11 16 13 22 17"/>
          </svg>
        </button>
      </header>

      {/* ─── Messages ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 px-4 space-y-1" style={{ background: '#000' }}>

        {/* Empty state */}
        {messages.length === 0 && other && (
          <div className="flex flex-col items-center py-16 text-center">
            <Avatar src={other.avatar_url} name={other.full_name} size={80} />
            <p className="font-semibold text-white text-[17px] mt-4 leading-tight">{other.full_name ?? other.username}</p>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>@{other.username}</p>
            <p className="text-[14px] mt-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Envia uma mensagem para começar a conversa
            </p>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={gi} className={`flex items-end gap-2 ${group.isMe ? 'flex-row-reverse' : 'flex-row'}`}>

            {/* Avatar — only for received, only beside last bubble in group */}
            <div className="shrink-0 w-8">
              {!group.isMe && (
                <Avatar src={other?.avatar_url} name={other?.full_name ?? '?'} size={28} />
              )}
            </div>

            <div className={`flex flex-col gap-[3px] max-w-[75%] ${group.isMe ? 'items-end' : 'items-start'}`}>
              {group.messages.map((m, mi) => {
                const isLastInGroup = mi === group.messages.length - 1
                const isEditing = editingId === m.id
                if (hiddenIds.has(m.id)) return null

                return (
                  <div key={m.id} className="w-full">
                    {isEditing ? (
                      <div className="rounded-2xl px-3 py-2.5 min-w-[160px]"
                        style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.15)' }}>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(m.id) }
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          autoFocus rows={2}
                          className="w-full bg-transparent text-[14px] text-white outline-none resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-1">
                          <button onClick={cancelEdit}
                            className="text-[12px] px-2.5 py-1 rounded-full transition-colors"
                            style={{ color: 'rgba(255,255,255,0.5)' }}>
                            Cancelar
                          </button>
                          <button onClick={() => saveEdit(m.id)}
                            className="text-[12px] font-semibold px-3 py-1 rounded-full transition-colors"
                            style={{ background: '#3797F0', color: '#fff' }}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : renderBubble(m, group, isLastInGroup)}

                    {/* Timestamp + read receipt under last bubble */}
                    {isLastInGroup && !isEditing && !hiddenIds.has(m.id) && (
                      <div className={`flex items-center gap-1.5 mt-1 ${group.isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {timeLabel(m.created_at)}
                        </span>
                        {group.isMe && m.id === lastSentId && (
                          <span className="text-[11px]" style={{ color: m.read ? '#3797F0' : 'rgba(255,255,255,0.35)' }}>
                            {m.read ? '· Visto' : '· Enviado'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ─── Quick replies ───────────────────────────────── */}
      {me && <QuickReplies onSend={quickSend} conversationId={otherId} />}

      {/* ─── Input bar ──────────────────────────────────── */}
      <div className="shrink-0 flex items-end gap-2.5 px-3"
        style={{
          background: '#000',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '0.625rem',
          paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
        }}>

        {/* Audio recorder (compact) */}
        {me && (
          <div className="shrink-0">
            <AudioRecorder userId={me.id} onSend={sendAudio} />
          </div>
        )}

        {/* Gallery / media */}
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/mpeg"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) sendMedia(f); e.target.value = '' }}
        />
        <button
          onClick={() => mediaInputRef.current?.click()}
          disabled={mediaUploading}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] disabled:opacity-40"
          style={{ color: '#3797F0' }}
          title="Enviar imagem ou vídeo">
          {mediaUploading ? (
            <div className="w-4 h-4 rounded-full border-2 border-[#3797F0]/30 border-t-[#3797F0] animate-spin" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          )}
        </button>

        {/* Pill input */}
        <div className="flex-1 flex items-end gap-1.5 rounded-[22px] px-4 py-2.5 min-h-[44px] transition-colors focus-within:border-white/30"
          style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.14)' }}>
          <MentionTextarea
            value={input}
            onChange={setInput}
            placeholder="Mensagem…"
            rows={1}
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none resize-none max-h-32 overflow-y-auto leading-snug self-center"
            autoFocus={false}
            onKeyDown={handleKeyDown}
          />
          {/* Emoji */}
          <button className="shrink-0 self-end pb-0.5 transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.45)', fontSize: '20px', lineHeight: 1 }}
            type="button">
            😊
          </button>
        </div>

        {/* Send or heart */}
        {input.trim() ? (
          <button
            onClick={send}
            disabled={sending}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50 active:scale-95"
            style={{ background: '#3797F0' }}
            aria-label="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={() => quickSend('❤️')}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            aria-label="Enviar coração"
            style={{ fontSize: '22px', lineHeight: 1 }}>
            🤍
          </button>
        )}
      </div>

      {/* ─── Active call overlay ─────────────────────────── */}
      {activeCall && (
        <CallView
          roomName={activeCall.roomName}
          token={activeCall.token}
          type={activeCall.type}
          callerName={other?.full_name}
          callerAvatar={other?.avatar_url}
          onEnd={endCall}
        />
      )}
    </div>
  )
}
