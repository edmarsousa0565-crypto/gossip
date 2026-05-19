'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '@/hooks/useNotifications'
import Avatar from '@/components/ui/Avatar'

const typeLabels: Record<string, string> = {
  like: 'reacted to your post',
  comment: 'commented on your post',
  friend_request: 'sent you a friend request',
  friend_accept: 'accepted your friend request',
}

export default function NotificationsPage() {
  const [userId, setUserId] = useState('')
  const { notifications, markAllRead } = useNotifications(userId)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={markAllRead} className="text-sm text-muted hover:text-white transition-colors">
          Mark all read
        </button>
      </div>
      <div className="space-y-1">
        {notifications.map(n => (
          <div key={n.id}
            className={`flex items-center gap-3 p-4 rounded-xl transition-colors ${n.read ? 'opacity-60' : 'bg-surface border border-border'}`}>
            <Avatar src={n.actor?.avatar_url} name={n.actor?.full_name ?? '?'} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{n.actor?.full_name}</span>
                {' '}{typeLabels[n.type] ?? n.type}
              </p>
              <p className="text-xs text-muted">{new Date(n.created_at).toLocaleDateString()}</p>
            </div>
            {!n.read && <div className="w-2 h-2 rounded-full bg-white flex-shrink-0" />}
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="text-center text-muted py-16">No notifications yet</p>
        )}
      </div>
    </div>
  )
}
