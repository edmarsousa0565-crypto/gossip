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
alter table groups enable row level security;
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
