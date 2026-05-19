# GOSSIP — Social Network Design

**Date:** 2026-05-19  
**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase · GSAP 3

---

## Identidade Visual

- **Background:** `#0a0a0a`
- **Surface:** `#111111` / `#1a1a1a` (cards, sidebars)
- **Accent primário:** `#ffffff` (branco puro)
- **Texto:** branco com opacidades (100%, 60%, 30%)
- **Bordas:** `rgba(255,255,255,0.08)`
- **Tipografia:** Geist (Next.js default) ou Inter

---

## Arquitetura

```
gossip/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (app)/
│   │   ├── feed/
│   │   ├── profile/[id]/
│   │   ├── groups/
│   │   ├── groups/[id]/
│   │   ├── events/
│   │   ├── events/[id]/
│   │   ├── notifications/
│   │   ├── messages/
│   │   └── search/
│   └── layout.tsx
├── components/
│   ├── ui/               (Button, Input, Modal, Avatar, Badge)
│   ├── feed/             (PostCard, CreatePost, Stories, StoryViewer, ReactionPicker)
│   ├── profile/          (ProfileHeader, ProfileCover, FriendsList, PhotoGrid)
│   ├── groups/           (GroupCard, GroupHeader, MembersList)
│   ├── events/           (EventCard, EventHeader, RSVPButton)
│   ├── notifications/    (NotificationItem, NotificationList)
│   ├── messages/         (ChatWindow, MessageBubble, ConversationList)
│   └── layout/           (Sidebar, Topbar, MobileNav, CustomCursor)
├── lib/
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── types.ts
└── hooks/
    ├── useAuth.ts
    ├── useFeed.ts
    ├── usePost.ts
    ├── useRealtime.ts
    └── useNotifications.ts
```

---

## Funcionalidades

| Feature | Detalhes |
|---|---|
| **Auth** | Email/senha + OAuth Google via Supabase Auth |
| **Feed** | Posts com texto/foto/vídeo, ordenação cronológica |
| **Reações** | 6 reações: Like ❤️ Haha 😂 Wow 😮 Sad 😢 Angry 😡 |
| **Comentários** | Aninhados (reply), likes em comentários |
| **Compartilhamento** | Repost com ou sem texto adicional |
| **Stories** | 24h, barra de progresso animada, visualizações |
| **Perfil** | Foto, bio, capa, galeria, lista de amigos |
| **Amizades** | Enviar/aceitar/recusar pedido de amizade |
| **Grupos** | Criar grupo, posts dentro do grupo, membros |
| **Eventos** | Criar evento, RSVP (vai / talvez / não vai) |
| **Notificações** | Real-time via Supabase Realtime |
| **Busca** | Pessoas, posts, grupos, eventos |
| **DMs** | Chat direto entre usuários, real-time |

---

## Banco de Dados (Supabase PostgreSQL)

### Tabelas principais

- `profiles` — id, username, full_name, avatar_url, cover_url, bio, created_at
- `posts` — id, author_id, content, media_urls, shared_post_id, group_id, created_at
- `reactions` — id, post_id, user_id, type (like|haha|wow|sad|angry|heart)
- `comments` — id, post_id, author_id, parent_id, content, created_at
- `comment_reactions` — id, comment_id, user_id, type
- `stories` — id, author_id, media_url, expires_at, created_at
- `story_views` — id, story_id, viewer_id, viewed_at
- `groups` — id, name, description, cover_url, creator_id, created_at
- `group_members` — id, group_id, user_id, role (admin|member)
- `events` — id, title, description, cover_url, creator_id, start_at, end_at, location
- `event_rsvps` — id, event_id, user_id, status (going|maybe|not_going)
- `friendships` — id, requester_id, addressee_id, status (pending|accepted|declined)
- `notifications` — id, user_id, type, actor_id, ref_id, ref_type, read, created_at
- `messages` — id, sender_id, receiver_id, content, read, created_at

### Storage Buckets
- `avatars` — fotos de perfil
- `covers` — fotos de capa
- `post-media` — fotos/vídeos de posts
- `story-media` — mídia de stories
- `group-covers` — capas de grupos

---

## Animações GSAP

- **Feed load:** cards entram com stagger (`y: 40 → 0, opacity: 0 → 1`)
- **Stories:** transição com clip-path expand ao abrir
- **Reações:** hover abre picker com `elastic.out`, emojis com stagger
- **Notificações:** slide-in da direita com spring
- **Page transitions:** SVG overlay animado entre rotas
- **Cursor personalizado:** mix-blend-mode `difference` (desktop only)
- **Magnetic buttons:** nos CTAs principais com `elastic.out(1, 0.4)`
- **Modal open:** scale + fade com `back.out(1.7)`

---

## Acessibilidade

- `prefers-reduced-motion` respeita todas as animações
- Contraste AA mínimo em todos os textos
- Focus visible em todos os elementos interativos
- ARIA labels em ícones e botões sem texto
