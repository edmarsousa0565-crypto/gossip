'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Image from 'next/image'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import ReactionPicker from './ReactionPicker'
import type { Post, ReactionType } from '@/lib/supabase/types'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  post: Post
  currentUserId?: string
  onReact?: (postId: string, type: ReactionType) => void
  onComment?: (postId: string) => void
}

export default function PostCard({ post, currentUserId, onReact, onComment }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const author = post.author!
  const myReaction = post.reactions?.find(r => r.user_id === currentUserId)?.type ?? null
  const reactionsCount = post._count?.reactions ?? post.reactions?.length ?? 0
  const commentsCount = post._count?.comments ?? post.comments?.length ?? 0

  useGSAP(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
        scrollTrigger: { trigger: cardRef.current, start: 'top 90%', toggleActions: 'play none none none' } }
    )
  })

  return (
    <div ref={cardRef} className="bg-surface border border-border rounded-2xl overflow-hidden"
      style={{ willChange: 'transform, opacity' }}>
      <div className="flex items-center gap-3 p-4">
        <Link href={`/profile/${author.id}`}>
          <Avatar src={author.avatar_url} name={author.full_name} size={42} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${author.id}`}
            className="font-semibold text-sm hover:underline">{author.full_name}</Link>
          <p className="text-subtle text-xs">
            {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {post.content && (
        <p className="px-4 pb-3 text-sm leading-relaxed text-white/90">{post.content}</p>
      )}

      {post.media_urls?.length > 0 && (
        <div className={`grid gap-0.5 ${post.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {post.media_urls.slice(0, 4).map((url, i) => (
            <div key={i} className="relative aspect-square">
              <Image src={url} alt="" fill className="object-cover" />
              {i === 3 && post.media_urls.length > 4 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-2xl font-bold">
                  +{post.media_urls.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(reactionsCount > 0 || commentsCount > 0) && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted border-t border-border/50">
          {reactionsCount > 0 && <span>{reactionsCount} reactions</span>}
          {commentsCount > 0 && <span>{commentsCount} comments</span>}
        </div>
      )}

      <div className="flex items-center border-t border-border">
        <ReactionPicker currentReaction={myReaction} onReact={(type) => onReact?.(post.id, type)} />
        <button onClick={() => onComment?.(post.id)}
          className="flex items-center gap-2 text-sm px-3 py-2 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors">
          <span>💬</span><span>Comment</span>
        </button>
        <button className="flex items-center gap-2 text-sm px-3 py-2 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors ml-auto">
          <span>↗</span><span>Share</span>
        </button>
      </div>
    </div>
  )
}
