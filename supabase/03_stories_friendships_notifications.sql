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
