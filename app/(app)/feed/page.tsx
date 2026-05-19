'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFeed } from '@/hooks/useFeed'
import PostCard from '@/components/feed/PostCard'
import CreatePost from '@/components/feed/CreatePost'
import Stories from '@/components/feed/Stories'
import StoryViewer from '@/components/feed/StoryViewer'
import type { Story, Profile } from '@/lib/supabase/types'

export default function FeedPage() {
  const { posts, stories, loading, fetchPosts, react } = useFeed()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [viewingStory, setViewingStory] = useState<Story | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  )

  const storyIndex = stories.findIndex(s => s.id === viewingStory?.id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {stories.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4">
          <Stories stories={stories} onView={setViewingStory} />
        </div>
      )}
      {profile && <CreatePost profile={profile} onPost={fetchPosts} />}
      <div className="space-y-4">
        {posts.map(post => (
          <PostCard key={post.id} post={post} currentUserId={profile?.id} onReact={react} />
        ))}
      </div>
      {viewingStory && (
        <StoryViewer stories={stories} startIndex={storyIndex} onClose={() => setViewingStory(null)} />
      )}
    </div>
  )
}
