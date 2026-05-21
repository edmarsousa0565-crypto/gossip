'use client'
import { useState, useEffect, useRef } from 'react'

const DEFAULTS = ['👍', '❤️', '😂', 'Ok!', 'Sim 😊', 'Não posso', 'Já vou!', 'Obrigado!', 'Boa noite!', '🔥']
const STORAGE_KEY = 'gossip-quick-replies'

interface Props {
  onSend: (text: string) => void
  conversationId: string
  inputValue?: string
}

export default function QuickReplies({ onSend, conversationId, inputValue = '' }: Props) {
  const [custom, setCustom] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setCustom(JSON.parse(stored))
    } catch {}
  }, [])

  function save(list: string[]) {
    setCustom(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  function addReply() {
    const t = draft.trim()
    if (!t) return
    save([...custom, t])
    setDraft('')
    setShowAdd(false)
  }

  function removeReply(i: number) {
    save(custom.filter((_, idx) => idx !== i))
  }

  function handleSend(text: string) {
    onSend(text)
    setSent(text)
    setTimeout(() => setSent(null), 800)
  }

  // Hide when user is typing
  if (inputValue.trim()) return null

  const all = [...DEFAULTS, ...custom]

  return (
    <div style={{ background: '#000', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Add custom reply input */}
      {showAdd && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addReply()
              if (e.key === 'Escape') { setShowAdd(false); setDraft('') }
            }}
            placeholder="Nova resposta rápida…"
            autoFocus
            maxLength={60}
            className="flex-1 text-[14px] text-white placeholder:text-white/30 outline-none"
            style={{
              background: '#1c1c1e',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '8px 16px',
            }}
          />
          <button
            onClick={addReply}
            className="text-[13px] font-semibold shrink-0 transition-opacity hover:opacity-70"
            style={{ color: '#3797F0' }}>
            Adicionar
          </button>
          <button
            onClick={() => { setShowAdd(false); setDraft('') }}
            className="text-[13px] shrink-0 transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.45)' }}>
            ✕
          </button>
        </div>
      )}

      {/* Chips row */}
      <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {all.map((r, i) => {
          const isCustom = i >= DEFAULTS.length
          const isSent = sent === r
          return (
            <div key={r + i} className="flex-shrink-0 group relative">
              <button
                onClick={() => handleSend(r)}
                className="whitespace-nowrap text-[13px] font-medium transition-all active:scale-95"
                style={{
                  background: isSent ? '#3797F0' : 'rgba(255,255,255,0.08)',
                  color: isSent ? '#fff' : 'rgba(255,255,255,0.85)',
                  border: `1px solid ${isSent ? '#3797F0' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '20px',
                  padding: '6px 14px',
                  transform: isSent ? 'scale(0.95)' : undefined,
                }}>
                {r}
              </button>
              {isCustom && (
                <button
                  onClick={() => removeReply(i - DEFAULTS.length)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full hidden group-hover:flex items-center justify-center text-[10px] font-bold"
                  style={{ background: '#ff3b30', color: '#fff' }}>
                  ×
                </button>
              )}
            </div>
          )
        })}

        {/* Add button */}
        <button
          onClick={() => { setShowAdd(v => !v); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '18px',
            lineHeight: 1,
          }}
          title="Adicionar resposta rápida">
          +
        </button>
      </div>
    </div>
  )
}
