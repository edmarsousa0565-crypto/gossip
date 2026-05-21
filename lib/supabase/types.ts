export type Plan = 'free' | 'premium' | 'creator'

export type Profile = {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  profession: string | null
  interests: string[]
  website: string | null
  location: string | null
  school: string | null
  phone: string | null
  hobbies: string[]
  verified: boolean
  followers_boost?: number
  likes_boost?: number
  comments_boost?: number
  plan?: Plan
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
  music_title: string | null
  music_artist: string | null
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
  actor_name: string | null
  content: string | null
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

export type Highlight = {
  id: string
  user_id: string
  title: string
  cover_url: string | null
  created_at: string
  stories?: Story[]
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
