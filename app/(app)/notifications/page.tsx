'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '@/hooks/useNotifications'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useHaptic } from '@/hooks/useHaptic'
import Avatar from '@/components/ui/Avatar'
import FriendButton from '@/components/ui/FriendButton'

const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

const typeLabels: Record<string, { icon: string; text: string }> = {
  like:           { icon: '❤️',  text: 'reagiu ao teu post' },
  heart:          { icon: '❤️',  text: 'amou o teu post' },
  comment:        { icon: '💬',  text: 'comentou o teu post' },
  follow:         { icon: '👤',  text: 'começou a seguir-te' },
  friend_request: { icon: '🤝',  text: 'enviou-te um pedido de amizade' },
  friend_accept:  { icon: '✅',  text: 'aceitou o teu pedido de amizade' },
  mention:        { icon: '@',   text: 'mencionou-te numa publicação' },
  story_reaction: { icon: '✨',  text: 'reagiu ao teu story' },
  message:        { icon: '💬',  text: 'enviou-te uma mensagem' },
  new_user:       { icon: '🆕',  text: 'acabou de se registar' },
  live_start:     { icon: '🔴',  text: 'está ao vivo agora!' },
}

export default function NotificationsPage() {
  const [userId, setUserId] = useState('')
  const { notifications, markAllRead } = useNotifications(userId)
  const { tap } = useHaptic()
  const router = useRouter()

  async function refresh() {
    if (!userId) return
    // Refetch by toggling userId briefly via direct query
    const supabase = createClient()
    await supabase.from('notifications')
      .select(`*, actor:profiles(*)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
  }

  const { pullY, refreshing, triggered, handlers } = usePullToRefresh(refresh, { threshold: 56 })

  useEffect(() => {
    if (IS_DEMO) return
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6"
      style={{ paddingTop: `calc(1.5rem + ${pullY}px)`, transition: pullY === 0 ? 'padding-top 0.3s ease' : 'none' }}
      {...handlers}>

      {/* PTR indicator */}
      {(pullY > 0 || refreshing) && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
          style={{
            top: `calc(3.5rem + ${pullY * 0.5}px)`,
            opacity: Math.min(1, pullY / 40),
            transform: `translateX(-50%) scale(${0.6 + pullY / 180})`,
          }}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}
            style={{
              background: 'var(--color-ink)',
              border: `1px solid ${triggered ? 'var(--color-rust)' : 'var(--color-edge)'}`,
              rotate: refreshing ? undefined : `${pullY * 3}deg`,
            }}>
            {refreshing
              ? <div className="w-3.5 h-3.5 rounded-full border border-current/30 border-t-current animate-spin" style={{ color: 'var(--color-paper)' }} />
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                  style={{ color: triggered ? 'var(--color-rust-soft)' : 'var(--color-ash)' }}>
                  <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
            }
          </div>
        </div>
      )}

      {/* Editorial masthead */}
      <div className="mb-6 pb-5" style={{ borderBottom: '1px solid var(--color-edge)' }}>
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--color-ash)' }}>
            Atividade · Notificações
          </p>
          {unread > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--color-rust-soft)' }}>
              {unread} {unread === 1 ? 'nova' : 'novas'}
            </p>
          )}
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-display italic font-semibold leading-none"
            style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', letterSpacing: '-0.025em' }}>
            Notificações
          </h1>
          {!IS_DEMO && unread > 0 && (
            <button onClick={() => { tap(); markAllRead() }}
              className="px-4 py-2 transition-colors"
              style={{ border: '1px solid var(--color-edge)', color: 'var(--color-paper)' }}>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
                Marcar como lidas
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        {IS_DEMO && <DemoNotifications />}
        {!IS_DEMO && notifications.map(n => {
          const meta = typeLabels[n.type]
          const isLive = n.type === 'live_start'
          return (
            <div key={n.id}
              onClick={isLive && n.ref_id ? () => router.push(`/live/${n.ref_id}?role=viewer`) : undefined}
              className={`flex items-center gap-3 p-4 rounded-2xl transition-colors ${
                n.read ? 'opacity-55' : 'bg-surface border border-border'
              } ${isLive ? 'cursor-pointer hover:border-red-500/40 active:scale-[0.99]' : ''}`}>
              {/* Icon badge over avatar */}
              <div className="relative flex-shrink-0">
                <Avatar src={n.actor?.avatar_url} name={n.actor?.full_name ?? '?'} size={44} />
                {meta && (
                  <span className="absolute -bottom-1 -right-1 text-base leading-none">{meta.icon}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{n.actor?.full_name ?? 'Utilizador'}</span>
                  {' '}<span className="text-white/70">{meta?.text ?? n.type}</span>
                  {n.type === 'new_user' && (n as any).content && (
                    <span className="text-muted"> {(n as any).content}</span>
                  )}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {new Date(n.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {n.type === 'friend_request' && !n.read && (
                <div className="flex-shrink-0">
                  <FriendButton targetUserId={n.actor_id!} currentUserId={userId} />
                </div>
              )}
              {!n.read && n.type !== 'friend_request' && (
                <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
              )}
            </div>
          )
        })}
        {!IS_DEMO && notifications.length === 0 && (
          <p className="text-center text-muted py-16">Ainda não há notificações</p>
        )}
      </div>
    </div>
  )
}

function DemoNotifications() {
  return (
    <>
      <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border">
        <Avatar src={null} name="Bob Silva" size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-semibold">Bob Silva</span>
            {' '}enviou-lhe um pedido de amizade
          </p>
          <p className="text-xs text-muted">2 minutes ago</p>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <FriendButton targetUserId="bob" currentUserId="demo-user" demoStatus="received" />
          <div className="w-2 h-2 rounded-full bg-white flex-shrink-0" />
        </div>
      </div>
      <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border">
        <Avatar src={null} name="Alice Mendes" size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-semibold">Alice Mendes</span>
            {' '}aceitou o seu pedido de amizade
          </p>
          <p className="text-xs text-muted">1 hour ago</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-white flex-shrink-0" />
      </div>
    </>
  )
}
