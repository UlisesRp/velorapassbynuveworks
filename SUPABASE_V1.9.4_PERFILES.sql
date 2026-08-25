-- VELORA PASS V1.9.4 · PERFILES EDITABLES
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- NO borra vouchers, cotizaciones, firmas ni auditoría.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "authenticated_read_profiles" on public.profiles;
drop policy if exists "users_insert_own_profile" on public.profiles;
drop policy if exists "users_update_own_profile" on public.profiles;

create policy "authenticated_read_profiles"
on public.profiles for select to authenticated using (true);

create policy "users_insert_own_profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "users_update_own_profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_velora_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, updated_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    new.email,
    now()
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists velora_create_user_profile on auth.users;
create trigger velora_create_user_profile
after insert or update of email on auth.users
for each row execute function public.handle_velora_user_profile();

insert into public.profiles (id, display_name, email, updated_at)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(u.email, 'Usuario'), '@', 1)),
  u.email,
  now()
from auth.users u
on conflict (id) do update set email = excluded.email;
