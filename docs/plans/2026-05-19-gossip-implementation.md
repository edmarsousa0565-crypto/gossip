# GOSSIP Social Network — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build GOSSIP, a Facebook-like dark-mode social network with feed, stories, groups, events, DMs, and real-time notifications.

**Architecture:** Next.js 14 App Router with server/client components, Supabase for auth + PostgreSQL + storage + realtime, GSAP 3 for all animations via `useGSAP`. Route groups `(auth)` for login/register and `(app)` for all authenticated pages behind a middleware guard.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase JS v2, GSAP 3 + `@gsap/react`, Lenis smooth scroll, `next/image`, `react-hook-form`, `zod`

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `C:\Users\pakka\Documents\gossip\` (project root)

**Step 1: Create Next.js app**
```bash
cd C:\Users\pakka\Documents\gossip
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

**Step 2: Install dependencies**
```bash
npm install @supabase/supabase-js @supabase/ssr gsap @gsap/react @studio-freight/lenis react-hook-form zod @hookform/resolvers
npm install -D @types/node
```

**Step 3: Initialize git**
```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 project"
```

---

## Task 2: Configure Tailwind dark theme + globals

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

**Step 1: Update tailwind.config.ts**
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        surface2: '#1a1a1a',
        border: 'rgba(255,255,255,0.08)',
        primary: '#ffffff',
        muted: 'rgba(255,255,255,0.6)',
        subtle: 'rgba(255,255,255,0.3)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
```

**Step 2: Update app/globals.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0a0a0a;
  --foreground: #ffffff;
}

* { box-sizing: border-box; }

body {
  background: #0a0a0a;
  color: #ffffff;
  font-family: var(--font-geist-sans), Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
```

**Step 3: Commit**
```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: configure dark theme tokens and globals"
```

---

## Task 3: Supabase project setup

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `lib/supabase/types.ts`
- Create: `.env.local`
- Modify: `middleware.ts` (root)

**Step 1: Create .env.local**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
> Go to supabase.com → New project → Settings → API → copy URL and anon key.

**Step 2: Create lib/supabase/client.ts**
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 3: Create lib/supabase/server.ts**
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

**Step 4: Create middleware.ts (root)**
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isAppRoute = !isAuthRoute && pathname !== '/'

  if (!user && isAppRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 5: Commit**
```bash
git add lib/ middleware.ts .env.local
git commit -m "feat: add Supabase client, server, and auth middleware"
```

---

## Task 4: Database schema (run in Supabase SQL Editor)

**Step 1: Run profiles table**
```sql
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  full_name text not null,
  avatar_url text,
  cover_url text,
  bio text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, full_name)
  values (new.id, split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4), coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

**Step 2: Run posts + reactions + comments**
```sql
create table posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  content text,
  media_urls text[] default '{}',
  shared_post_id uuid references posts(id),
  group_id uuid,
  created_at timestamptz default now()
);
alter table posts enable row level security;
create policy "Posts readable by all" on posts for select using (true);
create policy "Authenticated can insert" on posts for insert with check (auth.uid() = author_id);
create policy "Authors can delete" on posts for delete using (auth.uid() = author_id);

create table reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  type text check (type in ('like','heart','haha','wow','sad','angry')) not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);
alter table reactions enable row level security;
create policy "Reactions readable" on reactions for select using (true);
create policy "Auth users react" on reactions for insert with check (auth.uid() = user_id);
create policy "Users remove own" on reactions for delete using (auth.uid() = user_id);
create policy "Users update own" on reactions for update using (auth.uid() = user_id);

create table comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  parent_id uuid references comments(id),
  content text not null,
  created_at timestamptz default now()
);
alter table comments enable row level security;
create policy "Comments readable" on comments for select using (true);
create policy "Auth users comment" on comments for insert with check (auth.uid() = author_id);
create policy "Authors delete" on comments for delete using (auth.uid() = author_id);
```

**Step 3: Run stories + friendships + notifications**
```sql
create table stories (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  media_url text not null,
  media_type text default 'image',
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);
alter table stories enable row level security;
create policy "Stories readable" on stories for select using (expires_at > now());
create policy "Auth insert stories" on stories for insert with check (auth.uid() = author_id);
create policy "Authors delete stories" on stories for delete using (auth.uid() = author_id);

create table story_views (
  id uuid default gen_random_uuid() primary key,
  story_id uuid references stories(id) on delete cascade,
  viewer_id uuid references profiles(id) on delete cascade,
  viewed_at timestamptz default now(),
  unique(story_id, viewer_id)
);
alter table story_views enable row level security;
create policy "Story views readable by author" on story_views for select using (
  exists (select 1 from stories where id = story_id and author_id = auth.uid())
);
create policy "Auth insert views" on story_views for insert with check (auth.uid() = viewer_id);

create table friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending','accepted','declined')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);
alter table friendships enable row level security;
create policy "Friendships visible to participants" on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Auth send requests" on friendships for insert with check (auth.uid() = requester_id);
create policy "Addressee update status" on friendships for update using (auth.uid() = addressee_id);

create table notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  actor_id uuid references profiles(id),
  ref_id uuid,
  ref_type text,
  read boolean default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;
create policy "Own notifications" on notifications for select using (auth.uid() = user_id);
create policy "System insert" on notifications for insert with check (true);
create policy "Mark own read" on notifications for update using (auth.uid() = user_id);
```

**Step 4: Run groups + events + messages**
```sql
create table groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  cover_url text,
  creator_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);
alter table groups enable row level security;
create policy "Groups readable" on groups for select using (true);
create policy "Auth create groups" on groups for insert with check (auth.uid() = creator_id);
create policy "Creator update" on groups for update using (auth.uid() = creator_id);

create table group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('admin','member')) default 'member',
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);
alter table group_members enable row level security;
create policy "Members readable" on group_members for select using (true);
create policy "Auth join" on group_members for insert with check (auth.uid() = user_id);
create policy "Self leave" on group_members for delete using (auth.uid() = user_id);

create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  cover_url text,
  creator_id uuid references profiles(id) on delete cascade not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "Events readable" on events for select using (true);
create policy "Auth create events" on events for insert with check (auth.uid() = creator_id);
create policy "Creator update event" on events for update using (auth.uid() = creator_id);

create table event_rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text check (status in ('going','maybe','not_going')) not null,
  unique(event_id, user_id)
);
alter table event_rsvps enable row level security;
create policy "RSVPs readable" on event_rsvps for select using (true);
create policy "Auth rsvp" on event_rsvps for insert with check (auth.uid() = user_id);
create policy "Update own rsvp" on event_rsvps for update using (auth.uid() = user_id);

create table messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);
alter table messages enable row level security;
create policy "Participants read messages" on messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Auth send messages" on messages for insert with check (auth.uid() = sender_id);
create policy "Receiver mark read" on messages for update using (auth.uid() = receiver_id);
```

**Step 5: Create Storage buckets in Supabase Dashboard**
- `avatars` — public
- `covers` — public
- `post-media` — public
- `story-media` — public
- `group-covers` — public

---

## Task 5: TypeScript types

**Files:**
- Create: `lib/supabase/types.ts`

**Step 1: Write types**
```ts
export type Profile = {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  created_at: string
}

export type Post = {
  id: string
  author_id: string
  content: string | null
  media_urls: string[]
  shared_post_id: string | null
  group_id: string | null
  created_at: string
  author?: Profile
  reactions?: Reaction[]
  comments?: Comment[]
  _count?: { reactions: number; comments: number }
}

export type ReactionType = 'like' | 'heart' | 'haha' | 'wow' | 'sad' | 'angry'

export type Reaction = {
  id: string
  post_id: string
  user_id: string
  type: ReactionType
  created_at: string
  user?: Profile
}

export type Comment = {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  content: string
  created_at: string
  author?: Profile
  replies?: Comment[]
}

export type Story = {
  id: string
  author_id: string
  media_url: string
  media_type: string
  expires_at: string
  created_at: string
  author?: Profile
  views?: number
}

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  type: string
  actor_id: string | null
  ref_id: string | null
  ref_type: string | null
  read: boolean
  created_at: string
  actor?: Profile
}

export type Group = {
  id: string
  name: string
  description: string | null
  cover_url: string | null
  creator_id: string
  created_at: string
  members?: GroupMember[]
}

export type GroupMember = {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  user?: Profile
}

export type Event = {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  creator_id: string
  start_at: string
  end_at: string | null
  location: string | null
  created_at: string
  creator?: Profile
  rsvps?: EventRsvp[]
}

export type EventRsvp = {
  id: string
  event_id: string
  user_id: string
  status: 'going' | 'maybe' | 'not_going'
  user?: Profile
}

export type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at: string
  sender?: Profile
}
```

**Step 2: Commit**
```bash
git add lib/supabase/types.ts
git commit -m "feat: add TypeScript types for all entities"
```

---

## Task 6: Auth pages — Login & Register

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `hooks/useAuth.ts`

**Step 1: Create app/(auth)/layout.tsx**
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-8 tracking-tight">GOSSIP</h1>
        {children}
      </div>
    </main>
  )
}
```

**Step 2: Create hooks/useAuth.ts**
```ts
'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function useAuth() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signUp(email: string, password: string, fullName: string) {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/feed')
  }

  async function signIn(email: string, password: string) {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/feed')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return { signUp, signIn, signOut, loading, error }
}
```

**Step 3: Create app/(auth)/login/page.tsx**
```tsx
'use client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export default function LoginPage() {
  const { signIn, loading, error } = useAuth()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await signIn(fd.get('email') as string, fd.get('password') as string)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input name="email" type="email" placeholder="Email" required
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors" />
      <input name="password" type="password" placeholder="Password" required
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors" />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      <p className="text-center text-muted text-sm">
        No account? <Link href="/register" className="text-white underline">Create one</Link>
      </p>
    </form>
  )
}
```

**Step 4: Create app/(auth)/register/page.tsx**
```tsx
'use client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export default function RegisterPage() {
  const { signUp, loading, error } = useAuth()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await signUp(fd.get('email') as string, fd.get('password') as string, fd.get('fullName') as string)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input name="fullName" placeholder="Full name" required
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors" />
      <input name="email" type="email" placeholder="Email" required
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors" />
      <input name="password" type="password" placeholder="Password (min 6 chars)" minLength={6} required
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors" />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50">
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <p className="text-center text-muted text-sm">
        Have account? <Link href="/login" className="text-white underline">Sign in</Link>
      </p>
    </form>
  )
}
```

**Step 5: Commit**
```bash
git add app/ hooks/
git commit -m "feat: add auth pages (login, register) and useAuth hook"
```

---

## Task 7: App layout — Sidebar, Topbar, MobileNav

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/Topbar.tsx`
- Create: `components/layout/MobileNav.tsx`
- Create: `components/layout/CustomCursor.tsx`

**Step 1: Create components/layout/Sidebar.tsx**
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const links = [
  { href: '/feed', label: 'Feed', icon: '⊞' },
  { href: '/profile/me', label: 'Profile', icon: '◯' },
  { href: '/groups', label: 'Groups', icon: '⬡' },
  { href: '/events', label: 'Events', icon: '◈' },
  { href: '/messages', label: 'Messages', icon: '✉' },
  { href: '/notifications', label: 'Notifications', icon: '◉' },
  { href: '/search', label: 'Search', icon: '⊕' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useAuth()

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-surface border-r border-border p-6 z-40">
      <h1 className="text-2xl font-bold tracking-tight mb-10">GOSSIP</h1>
      <nav className="flex-1 space-y-1">
        {links.map(({ href, label, icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
              ${pathname.startsWith(href) ? 'bg-white/10 text-white' : 'text-muted hover:text-white hover:bg-white/5'}`}>
            <span className="text-lg">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <button onClick={signOut} className="text-muted hover:text-white text-sm px-4 py-3 text-left transition-colors">
        Sign out
      </button>
    </aside>
  )
}
```

**Step 2: Create components/layout/Topbar.tsx**
```tsx
'use client'
import Link from 'next/link'

export default function Topbar() {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-surface/80 backdrop-blur border-b border-border flex items-center justify-between px-4 z-40">
      <h1 className="text-xl font-bold tracking-tight">GOSSIP</h1>
      <Link href="/notifications" className="text-muted hover:text-white transition-colors">◉</Link>
    </header>
  )
}
```

**Step 3: Create components/layout/MobileNav.tsx**
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/feed', icon: '⊞' },
  { href: '/search', icon: '⊕' },
  { href: '/groups', icon: '⬡' },
  { href: '/events', icon: '◈' },
  { href: '/profile/me', icon: '◯' },
]

export default function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur border-t border-border flex items-center justify-around z-40">
      {links.map(({ href, icon }) => (
        <Link key={href} href={href}
          className={`text-2xl p-3 transition-colors ${pathname.startsWith(href) ? 'text-white' : 'text-muted'}`}>
          {icon}
        </Link>
      ))}
    </nav>
  )
}
```

**Step 4: Create components/layout/CustomCursor.tsx**
```tsx
'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const xTo = gsap.quickTo(cursorRef.current, 'x', { duration: 0.4, ease: 'power3' })
    const yTo = gsap.quickTo(cursorRef.current, 'y', { duration: 0.4, ease: 'power3' })
    const onMove = (e: MouseEvent) => { xTo(e.clientX); yTo(e.clientY) }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  })

  return (
    <div ref={cursorRef}
      className="pointer-events-none fixed top-0 left-0 w-5 h-5 rounded-full bg-white mix-blend-difference z-[9999] -translate-x-1/2 -translate-y-1/2"
      style={{ willChange: 'transform' }} />
  )
}
```

**Step 5: Create app/(app)/layout.tsx**
```tsx
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import MobileNav from '@/components/layout/MobileNav'
import CustomCursor from '@/components/layout/CustomCursor'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomCursor />
      <Topbar />
      <Sidebar />
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        {children}
      </main>
      <MobileNav />
    </>
  )
}
```

**Step 6: Commit**
```bash
git add app/ components/layout/
git commit -m "feat: add app layout with sidebar, topbar, mobile nav, and custom cursor"
```

---

## Task 8: PostCard component

**Files:**
- Create: `components/feed/PostCard.tsx`
- Create: `components/feed/ReactionPicker.tsx`
- Create: `components/ui/Avatar.tsx`

**Step 1: Create components/ui/Avatar.tsx**
```tsx
import Image from 'next/image'

interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  className?: string
}

export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  if (src) {
    return <Image src={src} alt={name} width={size} height={size}
      className={`rounded-full object-cover flex-shrink-0 ${className}`} />
  }
  return (
    <div style={{ width: size, height: size }}
      className={`rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold flex-shrink-0 ${className}`}>
      {initials}
    </div>
  )
}
```

**Step 2: Create components/feed/ReactionPicker.tsx**
```tsx
'use client'
import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ReactionType } from '@/lib/supabase/types'

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
]

interface Props {
  currentReaction?: ReactionType | null
  onReact: (type: ReactionType) => void
}

export default function ReactionPicker({ currentReaction, onReact }: Props) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  let timer: ReturnType<typeof setTimeout>

  useGSAP(() => {
    if (!pickerRef.current) return
    if (visible) {
      gsap.fromTo(pickerRef.current,
        { opacity: 0, y: 8, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'back.out(1.7)' }
      )
      gsap.from(pickerRef.current.querySelectorAll('.emoji-btn'),
        { opacity: 0, y: 10, scale: 0.5, stagger: 0.04, duration: 0.3, ease: 'back.out(2)' }
      )
    }
  }, { dependencies: [visible] })

  function show() { clearTimeout(timer); setVisible(true) }
  function hide() { timer = setTimeout(() => setVisible(false), 300) }

  const active = REACTIONS.find(r => r.type === currentReaction)

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors
        ${currentReaction ? 'text-white font-medium' : 'text-muted hover:text-white hover:bg-white/5'}`}>
        <span>{active?.emoji ?? '👍'}</span>
        <span>{active?.label ?? 'Like'}</span>
      </button>

      {visible && (
        <div ref={pickerRef}
          className="absolute bottom-full left-0 mb-2 flex gap-1 bg-surface2 border border-border rounded-2xl p-2 shadow-xl z-10"
          style={{ willChange: 'transform, opacity' }}>
          {REACTIONS.map(r => (
            <button key={r.type} onClick={() => { onReact(r.type); setVisible(false) }}
              title={r.label}
              className="emoji-btn text-2xl p-1.5 rounded-xl hover:bg-white/10 transition-transform hover:scale-125">
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Create components/feed/PostCard.tsx**
```tsx
'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Image from 'next/image'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import ReactionPicker from './ReactionPicker'
import type { Post, ReactionType } from '@/lib/supabase/types'

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
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
        scrollTrigger: { trigger: cardRef.current, start: 'top 90%', toggleActions: 'play none none none' } }
    )
  })

  return (
    <div ref={cardRef} className="bg-surface border border-border rounded-2xl overflow-hidden"
      style={{ willChange: 'transform, opacity' }}>
      {/* Header */}
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

      {/* Content */}
      {post.content && (
        <p className="px-4 pb-3 text-sm leading-relaxed text-white/90">{post.content}</p>
      )}

      {/* Media */}
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

      {/* Stats */}
      {(reactionsCount > 0 || commentsCount > 0) && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted border-t border-border/50">
          {reactionsCount > 0 && <span>{reactionsCount} reactions</span>}
          {commentsCount > 0 && <span>{commentsCount} comments</span>}
        </div>
      )}

      {/* Actions */}
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
```

**Step 4: Commit**
```bash
git add components/
git commit -m "feat: add PostCard, ReactionPicker, Avatar components"
```

---

## Task 9: CreatePost component

**Files:**
- Create: `components/feed/CreatePost.tsx`

**Step 1: Create components/feed/CreatePost.tsx**
```tsx
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
    if (!expandRef.current) return
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
          What's on your mind?
        </button>
      </div>

      {expanded && (
        <div ref={expandRef}>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind?" rows={4} autoFocus
              className="w-full bg-transparent text-sm resize-none outline-none placeholder-muted" />
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
```

**Step 2: Commit**
```bash
git add components/feed/CreatePost.tsx
git commit -m "feat: add CreatePost component with animated expand"
```

---

## Task 10: Stories component

**Files:**
- Create: `components/feed/Stories.tsx`
- Create: `components/feed/StoryViewer.tsx`

**Step 1: Create components/feed/Stories.tsx**
```tsx
'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Image from 'next/image'
import Avatar from '@/components/ui/Avatar'
import type { Story } from '@/lib/supabase/types'

interface Props {
  stories: Story[]
  onView?: (story: Story) => void
}

export default function Stories({ stories, onView }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from(containerRef.current!.querySelectorAll('.story-item'),
      { opacity: 0, x: -20, stagger: 0.06, duration: 0.4, ease: 'power2.out' }
    )
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
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
```

**Step 2: Create components/feed/StoryViewer.tsx**
```tsx
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
  const DURATION = 5000

  useGSAP(() => {
    gsap.fromTo(overlayRef.current,
      { opacity: 0, scale: 0.95 },
      { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }
    )
  })

  useEffect(() => {
    if (!progressRef.current) return
    gsap.fromTo(progressRef.current, { scaleX: 0 }, {
      scaleX: 1, duration: DURATION / 1000, ease: 'none',
      onComplete: () => {
        if (current < stories.length - 1) setCurrent(c => c + 1)
        else onClose()
      }
    })
    return () => { gsap.killTweensOf(progressRef.current) }
  }, [current])

  const story = stories[current]

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={onClose}>
      <div ref={overlayRef} className="relative w-full max-w-sm h-full max-h-[700px] rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()} style={{ willChange: 'transform, opacity' }}>
        <Image src={story.media_url} alt="" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />

        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div ref={i === current ? progressRef : null}
                className="h-full bg-white rounded-full origin-left"
                style={{ transform: i < current ? 'scaleX(1)' : i > current ? 'scaleX(0)' : undefined }} />
            </div>
          ))}
        </div>

        {/* Author */}
        <div className="absolute top-8 left-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/50">
            <Image src={story.author?.avatar_url ?? ''} alt="" width={32} height={32} className="object-cover" />
          </div>
          <span className="text-sm font-medium text-white drop-shadow">{story.author?.full_name}</span>
        </div>

        {/* Close */}
        <button onClick={onClose} className="absolute top-8 right-4 text-white/80 hover:text-white text-xl">✕</button>

        {/* Navigation */}
        <div className="absolute inset-y-0 left-0 w-1/2" onClick={() => current > 0 && setCurrent(c => c - 1)} />
        <div className="absolute inset-y-0 right-0 w-1/2" onClick={() => current < stories.length - 1 ? setCurrent(c => c + 1) : onClose()} />
      </div>
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add components/feed/
git commit -m "feat: add Stories and StoryViewer with GSAP progress animation"
```

---

## Task 11: Feed page

**Files:**
- Create: `app/(app)/feed/page.tsx`
- Create: `hooks/useFeed.ts`

**Step 1: Create hooks/useFeed.ts**
```ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post, Story } from '@/lib/supabase/types'

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select(`*, author:profiles(*), reactions(*), comments(count)`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setPosts(data as Post[])
    setLoading(false)
  }, [])

  const fetchStories = useCallback(async () => {
    const { data } = await supabase
      .from('stories')
      .select(`*, author:profiles(*)`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (data) setStories(data as Story[])
  }, [])

  async function react(postId: string, type: string) {
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
  }

  useEffect(() => { fetchPosts(); fetchStories() }, [])

  return { posts, stories, loading, fetchPosts, react }
}
```

**Step 2: Create app/(app)/feed/page.tsx**
```tsx
'use client'
import { useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { createClient } from '@/lib/supabase/client'
import { useFeed } from '@/hooks/useFeed'
import PostCard from '@/components/feed/PostCard'
import CreatePost from '@/components/feed/CreatePost'
import Stories from '@/components/feed/Stories'
import StoryViewer from '@/components/feed/StoryViewer'
import type { Story } from '@/lib/supabase/types'
import { useEffect, useState as useStateEffect } from 'react'
import type { Profile } from '@/lib/supabase/types'

gsap.registerPlugin(ScrollTrigger)

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
```

**Step 3: Commit**
```bash
git add app/\(app\)/feed/ hooks/useFeed.ts
git commit -m "feat: add feed page with posts, stories, and reactions"
```

---

## Task 12: Profile page

**Files:**
- Create: `app/(app)/profile/[id]/page.tsx`
- Create: `components/profile/ProfileHeader.tsx`

**Step 1: Create components/profile/ProfileHeader.tsx**
```tsx
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
      {/* Cover */}
      <div className="relative h-48 bg-surface2">
        {profile.cover_url && (
          <Image src={profile.cover_url} alt="" fill className="object-cover" />
        )}
      </div>

      {/* Info */}
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
                <button className="bg-white/10 text-sm px-4 py-2 rounded-xl font-medium">Friends ✓</button>
              ) : friendStatus === 'pending' ? (
                <button className="bg-white/10 text-sm px-4 py-2 rounded-xl font-medium text-muted">Pending</button>
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
```

**Step 2: Create app/(app)/profile/[id]/page.tsx**
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileHeader from '@/components/profile/ProfileHeader'
import PostCard from '@/components/feed/PostCard'

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileId = params.id === 'me' ? user.id : params.id

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
    .single()

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
```

**Step 3: Commit**
```bash
git add app/\(app\)/profile/ components/profile/
git commit -m "feat: add profile page with header, friend status, and posts"
```

---

## Task 13: Groups page

**Files:**
- Create: `app/(app)/groups/page.tsx`
- Create: `app/(app)/groups/[id]/page.tsx`
- Create: `components/groups/GroupCard.tsx`

**Step 1: Create components/groups/GroupCard.tsx**
```tsx
import Image from 'next/image'
import Link from 'next/link'
import type { Group } from '@/lib/supabase/types'

export default function GroupCard({ group }: { group: Group }) {
  return (
    <Link href={`/groups/${group.id}`}
      className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-white/20 transition-colors block">
      <div className="relative h-32 bg-surface2">
        {group.cover_url && <Image src={group.cover_url} alt="" fill className="object-cover" />}
      </div>
      <div className="p-4">
        <h3 className="font-semibold">{group.name}</h3>
        {group.description && <p className="text-muted text-sm mt-1 line-clamp-2">{group.description}</p>}
        <p className="text-subtle text-xs mt-2">{group.members?.length ?? 0} members</p>
      </div>
    </Link>
  )
}
```

**Step 2: Create app/(app)/groups/page.tsx**
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupCard from '@/components/groups/GroupCard'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: groups } = await supabase
    .from('groups')
    .select(`*, members:group_members(count)`)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <button className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors">
          + Create Group
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(groups ?? []).map(group => (
          <GroupCard key={group.id} group={group as any} />
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add app/\(app\)/groups/ components/groups/
git commit -m "feat: add groups listing page and GroupCard component"
```

---

## Task 14: Events page

**Files:**
- Create: `app/(app)/events/page.tsx`
- Create: `components/events/EventCard.tsx`

**Step 1: Create components/events/EventCard.tsx**
```tsx
import Image from 'next/image'
import Link from 'next/link'
import type { Event } from '@/lib/supabase/types'

export default function EventCard({ event }: { event: Event }) {
  const start = new Date(event.start_at)
  return (
    <Link href={`/events/${event.id}`}
      className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-white/20 transition-colors block">
      <div className="relative h-40 bg-surface2">
        {event.cover_url && <Image src={event.cover_url} alt="" fill className="object-cover" />}
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur rounded-xl px-3 py-1.5 text-center min-w-[50px]">
          <div className="text-xs font-semibold text-muted uppercase">{start.toLocaleDateString('en', { month: 'short' })}</div>
          <div className="text-xl font-bold leading-none">{start.getDate()}</div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold">{event.title}</h3>
        {event.location && <p className="text-muted text-sm mt-1">📍 {event.location}</p>}
        {event.description && <p className="text-subtle text-xs mt-2 line-clamp-2">{event.description}</p>}
      </div>
    </Link>
  )
}
```

**Step 2: Create app/(app)/events/page.tsx**
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EventCard from '@/components/events/EventCard'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: events } = await supabase
    .from('events')
    .select(`*, creator:profiles(*), rsvps:event_rsvps(count)`)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Events</h1>
        <button className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors">
          + Create Event
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(events ?? []).map(event => (
          <EventCard key={event.id} event={event as any} />
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add app/\(app\)/events/ components/events/
git commit -m "feat: add events page and EventCard component"
```

---

## Task 15: Notifications page (realtime)

**Files:**
- Create: `app/(app)/notifications/page.tsx`
- Create: `hooks/useNotifications.ts`

**Step 1: Create hooks/useNotifications.ts**
```ts
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/supabase/types'

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('notifications')
      .select(`*, actor:profiles(*)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setNotifications(data as Notification[]) })

    const channel = supabase.channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return { notifications, markAllRead }
}
```

**Step 2: Create app/(app)/notifications/page.tsx**
```tsx
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
```

**Step 3: Commit**
```bash
git add app/\(app\)/notifications/ hooks/useNotifications.ts
git commit -m "feat: add notifications page with Supabase Realtime"
```

---

## Task 16: Messages (DMs)

**Files:**
- Create: `app/(app)/messages/page.tsx`
- Create: `app/(app)/messages/[id]/page.tsx`

**Step 1: Create app/(app)/messages/page.tsx**
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: messages } = await supabase
    .from('messages')
    .select(`*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)`)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  // Dedupe conversations
  const seen = new Set<string>()
  const conversations = (messages ?? []).filter(m => {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (seen.has(otherId)) return false
    seen.add(otherId); return true
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      <div className="space-y-1">
        {conversations.map(m => {
          const other = m.sender_id === user.id ? m.receiver : m.sender
          return (
            <Link key={m.id} href={`/messages/${other.id}`}
              className="flex items-center gap-3 p-4 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
              <Avatar src={other.avatar_url} name={other.full_name} size={48} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{other.full_name}</p>
                <p className="text-muted text-xs truncate">{m.content}</p>
              </div>
            </Link>
          )
        })}
        {conversations.length === 0 && (
          <p className="text-center text-muted py-16">No conversations yet</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create app/(app)/messages/[id]/page.tsx**
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import type { Message, Profile } from '@/lib/supabase/types'

export default function ConversationPage({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [me, setMe] = useState<Profile | null>(null)
  const [other, setOther] = useState<Profile | null>(null)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: otherProfile } = await supabase.from('profiles').select('*').eq('id', params.id).single()
      setMe(myProfile); setOther(otherProfile)

      const { data } = await supabase.from('messages')
        .select(`*, sender:profiles!sender_id(*)`)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${params.id}),and(sender_id.eq.${params.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      if (data) setMessages(data as Message[])

      const channel = supabase.channel('messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          payload => setMessages(prev => [...prev, payload.new as Message]))
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [params.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !me) return
    await supabase.from('messages').insert({ sender_id: me.id, receiver_id: params.id, content: input })
    setInput('')
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-screen lg:h-[calc(100vh-0px)]">
      <div className="flex items-center gap-3 p-4 border-b border-border bg-surface/80 backdrop-blur sticky top-0">
        <Avatar src={other?.avatar_url} name={other?.full_name ?? '?'} size={40} />
        <span className="font-semibold">{other?.full_name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => {
          const isMine = m.sender_id === me?.id
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm
                ${isMine ? 'bg-white text-black rounded-br-sm' : 'bg-surface2 border border-border rounded-bl-sm'}`}>
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-3 p-4 border-t border-border">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Message..." className="flex-1 bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white/30 transition-colors" />
        <button type="submit" disabled={!input.trim()}
          className="bg-white text-black font-semibold px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-40 text-sm">
          Send
        </button>
      </form>
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add app/\(app\)/messages/
git commit -m "feat: add messages list and real-time conversation pages"
```

---

## Task 17: Search page

**Files:**
- Create: `app/(app)/search/page.tsx`

**Step 1: Create app/(app)/search/page.tsx**
```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'
import type { Profile, Group, Event } from '@/lib/supabase/types'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)

  async function search(q: string) {
    setQuery(q)
    if (q.length < 2) { setProfiles([]); setGroups([]); setEvents([]); return }
    setLoading(true)
    const supabase = createClient()
    const [p, g, e] = await Promise.all([
      supabase.from('profiles').select('*').ilike('full_name', `%${q}%`).limit(5),
      supabase.from('groups').select('*').ilike('name', `%${q}%`).limit(5),
      supabase.from('events').select('*').ilike('title', `%${q}%`).limit(5),
    ])
    setProfiles(p.data ?? []); setGroups(g.data ?? []); setEvents(e.data ?? [])
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <input value={query} onChange={e => search(e.target.value)}
        placeholder="Search people, groups, events..." autoFocus
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors mb-6" />

      {loading && <div className="text-center text-muted">Searching...</div>}

      {profiles.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">People</h2>
          <div className="space-y-2">
            {profiles.map(p => (
              <Link key={p.id} href={`/profile/${p.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
                <Avatar src={p.avatar_url} name={p.full_name} size={40} />
                <div><p className="font-medium text-sm">{p.full_name}</p><p className="text-muted text-xs">@{p.username}</p></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Groups</h2>
          <div className="space-y-2">
            {groups.map(g => (
              <Link key={g.id} href={`/groups/${g.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
                <div className="w-10 h-10 rounded-xl bg-surface2 flex items-center justify-center text-lg">⬡</div>
                <p className="font-medium text-sm">{g.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Events</h2>
          <div className="space-y-2">
            {events.map(e => (
              <Link key={e.id} href={`/events/${e.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface border border-transparent hover:border-border transition-colors">
                <div className="w-10 h-10 rounded-xl bg-surface2 flex items-center justify-center text-lg">◈</div>
                <div><p className="font-medium text-sm">{e.title}</p><p className="text-muted text-xs">{new Date(e.start_at).toLocaleDateString()}</p></div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add app/\(app\)/search/
git commit -m "feat: add search page for people, groups, and events"
```

---

## Task 18: Root redirect + app/page.tsx

**Files:**
- Modify: `app/page.tsx`

**Step 1: Update app/page.tsx**
```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/feed')
}
```

**Step 2: Commit**
```bash
git add app/page.tsx
git commit -m "feat: redirect root to feed"
```

---

## Task 19: Final verification

**Step 1: Run dev server**
```bash
npm run dev
```
Expected: Server starts at http://localhost:3000, no TypeScript errors.

**Step 2: Verify flows**
- [ ] `/login` — renders form, can sign in
- [ ] `/register` — creates account, redirects to feed
- [ ] `/feed` — shows posts, stories, create post
- [ ] `/profile/me` — shows own profile
- [ ] `/groups` — shows groups grid
- [ ] `/events` — shows upcoming events
- [ ] `/notifications` — shows notifications, realtime works
- [ ] `/messages` — shows conversations list
- [ ] `/search` — shows search results live

**Step 3: Build check**
```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 4: Final commit**
```bash
git add .
git commit -m "feat: GOSSIP social network v1.0 complete"
```

---

## Environment Setup Checklist

Before running Task 1, ensure:

1. **Node.js 18+** installed — `node --version`
2. **Supabase account** — create free project at supabase.com
3. **Copy URL + anon key** into `.env.local` (Task 3, Step 1)
4. **Run all SQL** from Task 4 in Supabase SQL Editor
5. **Create Storage buckets** from Task 4, Step 5
6. Enable **Email auth** in Supabase → Authentication → Providers

---
