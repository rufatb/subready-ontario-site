-- =====================================================================
-- SubReady Ontario — Supabase schema (Phase 1 platform)
-- Run this whole file once in the Supabase SQL editor (see README.md).
-- Contains NO keys or secrets.
--
-- IMPORTANT: check/document statuses are stored inside orders.intake
-- (jsonb) per document and use EXACTLY this vocabulary:
--   MET_FROM_DOCUMENT, MISSING, MISMATCH, EXPIRED, NOT_APPLICABLE,
--   INDEPENDENTLY_VERIFIED, UNVERIFIED, REVIEW_REQUIRED
-- INDEPENDENTLY_VERIFIED may only be set by the operator after a
-- separate permitted confirmation — never from a COI alone, and never
-- collapsed into a single green "approved" badge.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- order status ----------
do $$ begin
  create type order_status as enum (
    'waitlist',          -- submitted before payments opened / joined list
    'pending_payment',   -- intake saved, Stripe payment not confirmed
    'paid',              -- payment confirmed (set by operator/webhook later)
    'in_review',         -- documents being compared to requirements
    'needs_info',        -- documents/info outstanding from customer or sub
    'report_ready',      -- dated readiness report + evidence pack delivered
    'declined',          -- cannot process, no charge taken
    'refunded'
  );
exception when duplicate_object then null; end $$;

-- ---------- profiles (one row per auth user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company text,          -- the GC company
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- orders (one readiness packet per subcontractor) ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  product text not null default 'Subcontractor Readiness Packet (1 sub)',
  price_cad numeric(10,2) not null default 59,
  currency text not null default 'CAD',
  status order_status not null default 'waitlist',
  intake jsonb not null default '{}'::jsonb,   -- GC, project, sub, contract requirements, document checklist
  stripe_payment_link_id text,                  -- filled in Phase 2 (webhook reconciliation)
  stripe_checkout_session_id text,
  report_url text,                              -- signed/private link set when report_ready
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, company)
  values (new.id,
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'company')
  on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer set search_path = public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security: users see ONLY their own rows ----------
alter table public.profiles enable row level security;
alter table public.orders enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "orders: read own" on public.orders;
create policy "orders: read own" on public.orders
  for select using (auth.uid() = user_id);
drop policy if exists "orders: insert own" on public.orders;
create policy "orders: insert own" on public.orders
  for insert with check (auth.uid() = user_id);
drop policy if exists "orders: update own intake while editable" on public.orders;
create policy "orders: update own intake while editable" on public.orders
  for update using (auth.uid() = user_id and status in ('waitlist','pending_payment','needs_info'))
  with check (auth.uid() = user_id);
-- Status changes past intake are operator-only (service_role, private
-- console) — never from this public site. No delete policy on purpose.

-- ---------- Storage bucket for sub documents (private) ----------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
-- Per-user folder convention: documents/<auth user id>/<order id>/<file>
drop policy if exists "documents: read own files" on storage.objects;
create policy "documents: read own files" on storage.objects
  for select using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "documents: upload own files" on storage.objects;
create policy "documents: upload own files" on storage.objects
  for insert with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
-- Retention is customer-selectable and disclosed; WSIB principals must
-- retain clearances at least 3 years — do NOT auto-delete evidence
-- before the contracted archive period (operator policy, Phase 2).
