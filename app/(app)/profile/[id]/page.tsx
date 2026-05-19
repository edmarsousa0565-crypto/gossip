import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileHeader from '@/components/profile/ProfileHeader'
import PostCard from '@/components/feed/PostCard'

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileId = id === 'me' ? user.id : id

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single()
  if (!profile) return <div className="p-8 text-center text-muted">Profile not found</div>

  const { data: posts } = await supabase
    .from('posts')
    .select(`*, author:profiles(*), reactions(*), comments(count)`)
    .eq('author_id', profileId)
    .order('created_at', { ascending: false })

  const { count: friendCount } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
    .eq('status', 'accepted')

  const { data: friendship } = await supabase
    .from('friendships')
    .select('*')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${user.id})`)
    .maybeSingle()

  const friendStatus = !friendship ? 'none' : friendship.status === 'accepted' ? 'accepted' : 'pending'
  const isOwn = user.id === profileId

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <ProfileHeader profile={profile} friendCount={friendCount ?? 0} isOwn={isOwn} friendStatus={friendStatus} />
      <div className="space-y-4">
        {(posts ?? []).map(post => (
          <PostCard key={post.id} post={post as any} currentUserId={user.id} />
        ))}
      </div>
    </div>
  )
}
