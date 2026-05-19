'use client'
import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Avatar from '@/components/ui/Avatar'
import type { Profile } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  profile: Profile
  onPost?: () => void
}

export default function CreatePost({ profile, onPost }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const expandRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!expandRef.current || !expanded) return
    gsap.fromTo(expandRef.current,
      { height: 0, opacity: 0 },
      { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' }
    )
  }, { dependencies: [expanded] })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('posts').insert({ content, author_id: profile.id })
    setContent(''); setExpanded(false); setLoading(false)
    onPost?.()
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <Avatar src={profile.avatar_url} name={profile.full_name} size={42} />
        <button onClick={() => setExpanded(true)}
          className="flex-1 text-left bg-surface2 hover:bg-white/5 border border-border rounded-xl px-4 py-3 text-sm text-muted transition-colors">
          What&apos;s on your mind?
        </button>
      </div>

      {expanded && (
        <div ref={expandRef} style={{ overflow: 'hidden' }}>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind?" rows={4} autoFocus
              className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted" />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setExpanded(false)}
                className="text-sm text-muted hover:text-white px-4 py-2 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading || !content.trim()}
                className="bg-white text-black text-sm font-semibold px-5 py-2 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-40">
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
