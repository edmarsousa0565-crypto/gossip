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
