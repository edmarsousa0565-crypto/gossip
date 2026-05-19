'use client'
import { useRef, useState, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Image from 'next/image'
import type { Story } from '@/lib/supabase/types'

interface Props {
  stories: Story[]
  startIndex?: number
  onClose: () => void
}

export default function StoryViewer({ stories, startIndex = 0, onClose }: Props) {
  const [current, setCurrent] = useState(startIndex)
  const progressRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const DURATION = 5

  useGSAP(() => {
    gsap.fromTo(overlayRef.current,
      { opacity: 0, scale: 0.95 },
      { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }
    )
  })

  useEffect(() => {
    if (!progressRef.current) return
    gsap.fromTo(progressRef.current, { scaleX: 0 }, {
      scaleX: 1, duration: DURATION, ease: 'none',
      onComplete: () => {
        if (current < stories.length - 1) setCurrent(c => c + 1)
        else onClose()
      }
    })
    return () => { gsap.killTweensOf(progressRef.current) }
  }, [current, stories.length, onClose])

  const story = stories[current]
  if (!story) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={onClose}>
      <div ref={overlayRef} className="relative w-full max-w-sm h-full max-h-[700px] rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()} style={{ willChange: 'transform, opacity' }}>
        <Image src={story.media_url} alt="" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />

        <div className="absolute top-3 left-3 right-3 flex gap-1">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div ref={i === current ? progressRef : null}
                className="h-full bg-white rounded-full origin-left"
                style={{ transform: i < current ? 'scaleX(1)' : i > current ? 'scaleX(0)' : undefined }} />
            </div>
          ))}
        </div>

        <div className="absolute top-8 left-4 flex items-center gap-2">
          {story.author?.avatar_url && (
            <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/50">
              <Image src={story.author.avatar_url} alt="" width={32} height={32} className="object-cover" />
            </div>
          )}
          <span className="text-sm font-medium text-white drop-shadow">{story.author?.full_name}</span>
        </div>

        <button onClick={onClose} className="absolute top-8 right-4 text-white/80 hover:text-white text-xl">✕</button>

        <div className="absolute inset-y-0 left-0 w-1/2" onClick={() => current > 0 && setCurrent(c => c - 1)} />
        <div className="absolute inset-y-0 right-0 w-1/2" onClick={() => current < stories.length - 1 ? setCurrent(c => c + 1) : onClose()} />
      </div>
    </div>
  )
}
