'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Image from 'next/image'
import type { Story } from '@/lib/supabase/types'

interface Props {
  stories: Story[]
  onView?: (story: Story) => void
}

export default function Stories({ stories, onView }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const items = containerRef.current?.querySelectorAll('.story-item')
    if (!items?.length) return
    gsap.from(items, { opacity: 0, x: -20, stagger: 0.06, duration: 0.4, ease: 'power2.out' })
  }, { scope: containerRef, dependencies: [stories.length] })

  return (
    <div ref={containerRef} className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
      {stories.map(story => (
        <button key={story.id} onClick={() => onView?.(story)}
          className="story-item flex-shrink-0 flex flex-col items-center gap-2 group">
          <div className="relative w-16 h-16 rounded-full ring-2 ring-white/50 ring-offset-2 ring-offset-bg overflow-hidden">
            <Image src={story.media_url} alt="" fill className="object-cover" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
          </div>
          <span className="text-xs text-muted truncate w-16 text-center">
            {story.author?.full_name.split(' ')[0]}
          </span>
        </button>
      ))}
    </div>
  )
}
