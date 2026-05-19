# Database Setup

Run these SQL files IN ORDER in the Supabase SQL Editor (supabase.com → your project → SQL Editor):

1. `01_profiles.sql` — profiles table + auto-create trigger
2. `02_posts_reactions_comments.sql` — posts, reactions, comments
3. `03_stories_friendships_notifications.sql` — stories, friendships, notifications
4. `04_groups_events_messages.sql` — groups, events, messages

## Storage Buckets

Create these buckets in Supabase Dashboard → Storage (all public):
- `avatars`
- `covers`
- `post-media`
- `story-media`
- `group-covers`

## Auth

Enable Email provider in Supabase Dashboard → Authentication → Providers.
