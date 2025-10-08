-- Enable pgcrypto extension for UUID generation
create extension if not exists "pgcrypto";

-- Update existing wishlist table to support text item_id for flexibility
-- First drop the existing table since we need to change the item_id type
drop table if exists public.wishlist cascade;-- Create wishlist table for events and lost-and-found items
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('event', 'lost_found')),
  item_id text not null, -- References events.id or lost_found.id as text for flexibility
  item_name text not null, -- Cached item name for quick display
  item_description text, -- Cached item description
  item_url text, -- Optional URL for the item
  item_image_url text, -- Cached image URL
  added_at timestamptz default now(),
  
  -- Ensure a user can only add the same item once
  unique(profile_id, item_type, item_id)
);

-- Create indexes for performance
create index if not exists wishlist_profile_id_idx on public.wishlist(profile_id);
create index if not exists wishlist_item_type_idx on public.wishlist(item_type);
create index if not exists wishlist_added_at_idx on public.wishlist(added_at desc);
create index if not exists wishlist_composite_idx on public.wishlist(profile_id, item_type);

-- Enable Row Level Security
alter table public.wishlist enable row level security;

-- Drop policies if they already exist
drop policy if exists "Users can view their own wishlist items" on public.wishlist;
drop policy if exists "Users can insert their own wishlist items" on public.wishlist;
drop policy if exists "Users can delete their own wishlist items" on public.wishlist;

-- RLS Policies: Users can only access their own wishlist items
create policy "Users can view their own wishlist items" on public.wishlist
  for select using (profile_id = auth.uid());

create policy "Users can insert their own wishlist items" on public.wishlist
  for insert with check (profile_id = auth.uid());

create policy "Users can delete their own wishlist items" on public.wishlist
  for delete using (profile_id = auth.uid());

-- No UPDATE policy - users cannot modify wishlist items, only add/remove

-- Function to ensure user profile exists
create or replace function public.ensure_user_profile(user_id uuid, user_email text default null, user_name text default null)
returns uuid as $$
declare
  profile_id uuid;
begin
  -- Check if profile already exists
  select id into profile_id from public.profiles where id = user_id;
  
  if profile_id is null then
    -- Create profile if it doesn't exist
    insert into public.profiles (id, full_name)
    values (user_id, user_name)
    returning id into profile_id;
  end if;
  
  return profile_id;
end;
$$ language plpgsql security definer;

-- Trigger function to create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user signup (only if it doesn't exist)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Drop existing functions if they exist to avoid conflicts
drop function if exists public.add_lost_found_to_wishlist(uuid);
drop function if exists public.add_lost_found_to_wishlist(text);
drop function if exists public.add_event_to_wishlist(uuid);
drop function if exists public.add_event_to_wishlist(text);

-- Function to add lost-and-found item to wishlist
create or replace function public.add_lost_found_to_wishlist(lost_found_id text)
returns text as $$
declare
  user_id uuid;
  lost_found_record record;
  wishlist_id text;
begin
  -- Get the current user
  user_id := auth.uid();
  if user_id is null then
    raise exception 'User not authenticated';
  end if;
  
  -- Ensure user profile exists
  perform public.ensure_user_profile(user_id);
  
  -- Get lost-and-found details (using existing field names)
  select id, title, description, image_url into lost_found_record
  from public.lost_found
  where id = lost_found_id::uuid;
  
  if not found then
    raise exception 'Lost and found item not found';
  end if;
  
  -- Insert into wishlist (unique constraint prevents duplicates)
  insert into public.wishlist (
    profile_id, 
    item_type, 
    item_id, 
    item_name, 
    item_description, 
    item_image_url
  ) values (
    user_id,
    'lost_found',
    lost_found_record.id,
    lost_found_record.title,
    lost_found_record.description,
    lost_found_record.image_url
  ) returning id into wishlist_id;
  
  return wishlist_id;
end;
$$ language plpgsql security definer;

-- Optional: Function to add event to wishlist (similar pattern)
create or replace function public.add_event_to_wishlist(event_id text)
returns text as $$
declare
  user_id uuid;
  event_record record;
  wishlist_id text;
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'User not authenticated';
  end if;
  
  -- Ensure user profile exists
  perform public.ensure_user_profile(user_id);

  select id, title, description, image_url into event_record
  from public.events
  where id = event_id::bigint;

  if not found then
    raise exception 'Event not found';
  end if;

  insert into public.wishlist (
    profile_id,
    item_type,
    item_id,
    item_name,
    item_description,
    item_image_url
  ) values (
    user_id,
    'event',
    event_record.id,
    event_record.title,
    event_record.description,
    event_record.image_url
  ) returning id into wishlist_id;

  return wishlist_id;
end;
$$ language plpgsql security definer;
