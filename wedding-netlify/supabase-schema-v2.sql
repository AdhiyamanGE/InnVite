-- ══════════════════════════════════════════════════════════════════════════════
-- InnVite — Supabase Schema v2 (Multi-User + Auth)
--
-- Run this ENTIRE file in: Supabase Dashboard → SQL Editor → New Query → Run
-- This REPLACES the v1 schema. Run once on a fresh project.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 1 — DROP LEGACY (v1) TABLES if they exist
-- ══════════════════════════════════════════════════════════════════════════════
drop table if exists public.audit_logs     cascade;
drop table if exists public.edit_locks     cascade;
drop table if exists public.permissions    cascade;
drop table if exists public.access_requests cascade;
drop table if exists public.pairs          cascade;
drop table if exists public.rooms          cascade;
drop table if exists public.guests         cascade;
drop table if exists public.app_state      cascade;
drop table if exists public.profiles       cascade;

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2 — CREATE TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Extended user profile, auto-created via trigger when auth.users row is inserted.
create table public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  email        text        not null unique,
  display_name text        not null default '',
  created_at   timestamptz not null default now()
);

-- ── guests ───────────────────────────────────────────────────────────────────
create table public.guests (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles (id) on delete cascade,
  name            text        not null,
  gender          text        not null default 'Male'
                              check (gender in ('Male', 'Female', 'Other')),
  side            text        not null
                              check (side in (
                                'bride_dad','bride_mom','groom_dad',
                                'groom_mom','bride_friends','groom_friends'
                              )),
  family          text        not null default '',
  confirmed       boolean     not null default true,
  version         integer     not null default 1,
  last_edited_by  uuid        references public.profiles (id) on delete set null,
  last_edited_at  timestamptz,
  created_at      timestamptz not null default now()
);

-- ── rooms ─────────────────────────────────────────────────────────────────────
create table public.rooms (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles (id) on delete cascade,
  number          text        not null,
  floor           text        not null default 'Ground'
                              check (floor in ('Ground','1st','2nd','3rd','4th','5th')),
  capacity        integer     not null default 2 check (capacity >= 1 and capacity <= 50),
  notes           text        not null default '',
  version         integer     not null default 1,
  last_edited_by  uuid        references public.profiles (id) on delete set null,
  last_edited_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, number)
);

-- ── pairs ─────────────────────────────────────────────────────────────────────
create table public.pairs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  a           uuid        not null references public.guests (id) on delete cascade,
  b           uuid        not null references public.guests (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint  no_self_pair check (a <> b),
  unique (user_id, a, b)
);

-- ── app_state ─────────────────────────────────────────────────────────────────
-- One row per user: persists active tab + allocation result.
create table public.app_state (
  user_id     uuid        primary key references public.profiles (id) on delete cascade,
  active_tab  text        not null default 'guests',
  result      jsonb,
  updated_at  timestamptz not null default now()
);

-- ── access_requests ───────────────────────────────────────────────────────────
-- from_user requests access to to_user's data.
create table public.access_requests (
  id           uuid        primary key default gen_random_uuid(),
  from_user    uuid        not null references public.profiles (id) on delete cascade,
  to_user      uuid        not null references public.profiles (id) on delete cascade,
  access_type  text        not null check (access_type in ('view','edit','both')),
  status       text        not null default 'pending'
                           check (status in ('pending','accepted','rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint   no_self_request check (from_user <> to_user)
);

-- ── permissions ───────────────────────────────────────────────────────────────
-- Granted access: granter_id owns data, grantee_id has been granted access.
-- Permissions are ADDITIVE — accepting a 'view' request then an 'edit' request
-- sets both can_view=true, can_edit=true.
create table public.permissions (
  id          uuid        primary key default gen_random_uuid(),
  granter_id  uuid        not null references public.profiles (id) on delete cascade,
  grantee_id  uuid        not null references public.profiles (id) on delete cascade,
  can_view    boolean     not null default false,
  can_edit    boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (granter_id, grantee_id),
  constraint  no_self_permission check (granter_id <> grantee_id)
);

-- ── edit_locks ────────────────────────────────────────────────────────────────
-- Pessimistic edit locks to prevent concurrent conflicting edits.
-- TTL: 45 seconds. Heartbeat from client refreshes expires_at every 20s.
-- Owner can always force-release any lock on their data.
create table public.edit_locks (
  id              uuid        primary key default gen_random_uuid(),
  record_type     text        not null check (record_type in ('guest','room','pair')),
  record_id       uuid        not null,
  data_owner_id   uuid        not null references public.profiles (id) on delete cascade,
  locked_by       uuid        not null references public.profiles (id) on delete cascade,
  locked_by_name  text        not null default '',
  expires_at      timestamptz not null,
  unique (record_type, record_id)
);

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Immutable append-only audit trail. No UPDATE or DELETE policies.
create table public.audit_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  action_type text        not null,
  entity_type text,
  entity_id   uuid,
  owner_id    uuid        references public.profiles (id) on delete set null,
  description text        not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 3 — INDEXES
-- ══════════════════════════════════════════════════════════════════════════════
create index guests_user_idx          on public.guests (user_id);
create index guests_side_idx          on public.guests (user_id, side);
create index rooms_user_idx           on public.rooms (user_id);
create index pairs_user_idx           on public.pairs (user_id);
create index pairs_a_idx              on public.pairs (a);
create index pairs_b_idx              on public.pairs (b);
create index requests_from_idx        on public.access_requests (from_user);
create index requests_to_idx          on public.access_requests (to_user);
create index permissions_granter_idx  on public.permissions (granter_id);
create index permissions_grantee_idx  on public.permissions (grantee_id);
create index locks_owner_idx          on public.edit_locks (data_owner_id);
create index locks_expires_idx        on public.edit_locks (expires_at);
create index audit_user_idx           on public.audit_logs (user_id);
create index audit_owner_idx          on public.audit_logs (owner_id);
create index audit_created_idx        on public.audit_logs (created_at desc);

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 4 — ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════
alter table public.profiles       enable row level security;
alter table public.guests         enable row level security;
alter table public.rooms          enable row level security;
alter table public.pairs          enable row level security;
alter table public.app_state      enable row level security;
alter table public.access_requests enable row level security;
alter table public.permissions    enable row level security;
alter table public.edit_locks     enable row level security;
alter table public.audit_logs     enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Any authenticated user can read profiles (needed for email lookup when sending requests).
create policy "profiles_read_all"  on public.profiles for select to authenticated using (true);
create policy "profiles_own_write" on public.profiles for update to authenticated using (id = auth.uid());

-- ── guests ───────────────────────────────────────────────────────────────────
-- Owner has full control.
create policy "guests_owner_all" on public.guests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grantee with view permission can select.
create policy "guests_viewer_select" on public.guests for select to authenticated
  using (
    exists (
      select 1 from public.permissions p
      where p.granter_id = guests.user_id
        and p.grantee_id = auth.uid()
        and p.can_view = true
    )
  );

-- Grantee with edit permission can insert/update/delete.
create policy "guests_editor_insert" on public.guests for insert to authenticated
  with check (
    exists (
      select 1 from public.permissions p
      where p.granter_id = guests.user_id
        and p.grantee_id = auth.uid()
        and p.can_edit = true
    )
  );

create policy "guests_editor_update" on public.guests for update to authenticated
  using (
    exists (
      select 1 from public.permissions p
      where p.granter_id = guests.user_id
        and p.grantee_id = auth.uid()
        and p.can_edit = true
    )
  )
  with check (
    exists (
      select 1 from public.permissions p
      where p.granter_id = guests.user_id
        and p.grantee_id = auth.uid()
        and p.can_edit = true
    )
  );

create policy "guests_editor_delete" on public.guests for delete to authenticated
  using (
    exists (
      select 1 from public.permissions p
      where p.granter_id = guests.user_id
        and p.grantee_id = auth.uid()
        and p.can_edit = true
    )
  );

-- ── rooms ─────────────────────────────────────────────────────────────────────
create policy "rooms_owner_all" on public.rooms for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rooms_viewer_select" on public.rooms for select to authenticated
  using (
    exists (select 1 from public.permissions p where p.granter_id = rooms.user_id and p.grantee_id = auth.uid() and p.can_view = true)
  );

create policy "rooms_editor_insert" on public.rooms for insert to authenticated
  with check (
    exists (select 1 from public.permissions p where p.granter_id = rooms.user_id and p.grantee_id = auth.uid() and p.can_edit = true)
  );

create policy "rooms_editor_update" on public.rooms for update to authenticated
  using  (exists (select 1 from public.permissions p where p.granter_id = rooms.user_id and p.grantee_id = auth.uid() and p.can_edit = true))
  with check (exists (select 1 from public.permissions p where p.granter_id = rooms.user_id and p.grantee_id = auth.uid() and p.can_edit = true));

create policy "rooms_editor_delete" on public.rooms for delete to authenticated
  using (exists (select 1 from public.permissions p where p.granter_id = rooms.user_id and p.grantee_id = auth.uid() and p.can_edit = true));

-- ── pairs ─────────────────────────────────────────────────────────────────────
create policy "pairs_owner_all" on public.pairs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "pairs_viewer_select" on public.pairs for select to authenticated
  using (exists (select 1 from public.permissions p where p.granter_id = pairs.user_id and p.grantee_id = auth.uid() and p.can_view = true));

create policy "pairs_editor_write" on public.pairs for all to authenticated
  using  (exists (select 1 from public.permissions p where p.granter_id = pairs.user_id and p.grantee_id = auth.uid() and p.can_edit = true))
  with check (exists (select 1 from public.permissions p where p.granter_id = pairs.user_id and p.grantee_id = auth.uid() and p.can_edit = true));

-- ── app_state ─────────────────────────────────────────────────────────────────
create policy "appstate_owner_all" on public.app_state for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Editors can update the result (e.g. after running allocation on shared data).
create policy "appstate_editor_update" on public.app_state for update to authenticated
  using  (exists (select 1 from public.permissions p where p.granter_id = app_state.user_id and p.grantee_id = auth.uid() and p.can_edit = true))
  with check (exists (select 1 from public.permissions p where p.granter_id = app_state.user_id and p.grantee_id = auth.uid() and p.can_edit = true));

-- Viewers can read the state.
create policy "appstate_viewer_select" on public.app_state for select to authenticated
  using (exists (select 1 from public.permissions p where p.granter_id = app_state.user_id and p.grantee_id = auth.uid() and p.can_view = true));

-- ── access_requests ───────────────────────────────────────────────────────────
-- Only sender can create. Both parties can read. Only recipient can update status.
create policy "requests_sender_insert" on public.access_requests for insert to authenticated
  with check (from_user = auth.uid());

create policy "requests_parties_select" on public.access_requests for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

create policy "requests_recipient_update" on public.access_requests for update to authenticated
  using (to_user = auth.uid());

-- ── permissions ───────────────────────────────────────────────────────────────
-- Both parties can read. Only granter (data owner) can create/update/delete.
create policy "perms_parties_select" on public.permissions for select to authenticated
  using (granter_id = auth.uid() or grantee_id = auth.uid());

create policy "perms_granter_write" on public.permissions for all to authenticated
  using (granter_id = auth.uid()) with check (granter_id = auth.uid());

-- ── edit_locks ────────────────────────────────────────────────────────────────
-- All authenticated users can read locks (to check if a record is locked).
create policy "locks_read_all"   on public.edit_locks for select to authenticated using (true);
-- Only lock holder can insert their own lock.
create policy "locks_holder_insert" on public.edit_locks for insert to authenticated
  with check (locked_by = auth.uid());
-- Lock holder OR data owner can update/delete.
create policy "locks_holder_update" on public.edit_locks for update to authenticated
  using (locked_by = auth.uid() or data_owner_id = auth.uid());
create policy "locks_release" on public.edit_locks for delete to authenticated
  using (locked_by = auth.uid() or data_owner_id = auth.uid());

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Append-only: users can insert their own logs, read logs they're involved in.
create policy "audit_insert_own" on public.audit_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "audit_read_relevant" on public.audit_logs for select to authenticated
  using (user_id = auth.uid() or owner_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 5 — TRIGGER: auto-create profile on registration
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 6 — REALTIME publications
-- ══════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.guests;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.pairs;
alter publication supabase_realtime add table public.app_state;
alter publication supabase_realtime add table public.access_requests;
alter publication supabase_realtime add table public.permissions;
alter publication supabase_realtime add table public.edit_locks;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE.
-- In Supabase Dashboard → Authentication → Settings:
--   • Disable "Enable email confirmations" (recommended for private InnVite app)
--   • Set Site URL to your Netlify URL
-- ══════════════════════════════════════════════════════════════════════════════
