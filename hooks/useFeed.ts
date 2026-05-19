'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post, Story } from '@/lib/supabase/types'

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('posts')
      .select(`*, author:profiles(*), reactions(*), comments(count)`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setPosts(data as Post[])
    setLoading(false)
  }, [])

  const fetchStories = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('stories')
      .select(`*, author:profiles(*)`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (data) setStories(data as Story[])
  }, [])

  const react = useCallback(async (postId: string, type: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const existing = posts.find(p => p.id === postId)
      ?.reactions?.find(r => r.user_id === user.id)
    if (existing?.type === type) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('reactions').update({ type }).eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({ post_id: postId, user_id: user.id, type })
    }
    fetchPosts()
  }, [posts, fetchPosts])

  useEffect(() => { fetchPosts(); fetchStories() }, [fetchPosts, fetchStories])

  return { posts, stories, loading, fetchPosts, react }
}
