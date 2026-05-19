'use client'
import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ReactionType } from '@/lib/supabase/types'

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
]

interface Props {
  currentReaction?: ReactionType | null
  onReact: (type: ReactionType) => void
}

export default function ReactionPicker({ currentReaction, onReact }: Props) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  let timer: ReturnType<typeof setTimeout>

  useGSAP(() => {
    if (!pickerRef.current) return
    if (visible) {
      gsap.fromTo(pickerRef.current,
        { opacity: 0, y: 8, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'back.out(1.7)' }
      )
      gsap.from(pickerRef.current.querySelectorAll('.emoji-btn'),
        { opacity: 0, y: 10, scale: 0.5, stagger: 0.04, duration: 0.3, ease: 'back.out(2)' }
      )
    }
  }, { dependencies: [visible] })

  function show() { clearTimeout(timer); setVisible(true) }
  function hide() { timer = setTimeout(() => setVisible(false), 300) }

  const active = REACTIONS.find(r => r.type === currentReaction)

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors
        ${currentReaction ? 'text-white font-medium' : 'text-muted hover:text-white hover:bg-white/5'}`}>
        <span>{active?.emoji ?? '👍'}</span>
        <span>{active?.label ?? 'Like'}</span>
      </button>

      {visible && (
        <div ref={pickerRef}
          className="absolute bottom-full left-0 mb-2 flex gap-1 bg-surface2 border border-border rounded-2xl p-2 shadow-xl z-10"
          style={{ willChange: 'transform, opacity' }}>
          {REACTIONS.map(r => (
            <button key={r.type} onClick={() => { onReact(r.type); setVisible(false) }}
              title={r.label}
              className="emoji-btn text-2xl p-1.5 rounded-xl hover:bg-white/10 transition-transform hover:scale-125">
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
