'use client'
import Image from 'next/image'
import Avatar from '@/components/ui/Avatar'
import type { Profile } from '@/lib/supabase/types'

interface Props {
  profile: Profile
  friendCount: number
  isOwn: boolean
  friendStatus?: 'none' | 'pending' | 'accepted'
  onAddFriend?: () => void
  onMessage?: () => void
}

export default function ProfileHeader({ profile, friendCount, isOwn, friendStatus, onAddFriend, onMessage }: Props) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="relative h-48 bg-surface2">
        {profile.cover_url && (
          <Image src={profile.cover_url} alt="" fill className="object-cover" />
        )}
      </div>
      <div className="px-6 pb-6">
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div className="ring-4 ring-surface rounded-full">
            <Avatar src={profile.avatar_url} name={profile.full_name} size={80} />
          </div>
          <div className="flex-1 pb-1">
            <h2 className="text-xl font-bold">{profile.full_name}</h2>
            <p className="text-muted text-sm">@{profile.username} · {friendCount} friends</p>
          </div>
          {!isOwn && (
            <div className="flex gap-2">
              {friendStatus === 'accepted' ? (
                <span className="bg-white/10 text-sm px-4 py-2 rounded-xl font-medium">Friends ✓</span>
              ) : friendStatus === 'pending' ? (
                <span className="bg-white/10 text-sm px-4 py-2 rounded-xl font-medium text-muted">Pending</span>
              ) : (
                <button onClick={onAddFriend} className="bg-white text-black text-sm px-4 py-2 rounded-xl font-semibold hover:bg-white/90 transition-colors">
                  Add Friend
                </button>
              )}
              <button onClick={onMessage} className="bg-surface2 border border-border text-sm px-4 py-2 rounded-xl font-medium hover:bg-white/5 transition-colors">
                Message
              </button>
            </div>
          )}
          {isOwn && (
            <button className="bg-surface2 border border-border text-sm px-4 py-2 rounded-xl font-medium hover:bg-white/5 transition-colors">
              Edit profile
            </button>
          )}
        </div>
        {profile.bio && <p className="text-sm text-muted">{profile.bio}</p>}
      </div>
    </div>
  )
}
