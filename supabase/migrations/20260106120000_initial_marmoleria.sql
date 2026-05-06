-- Marmolería Piedra Americana: esquema inicial (ajusta si ya existen objetos en tu proyecto Supabase).

-- Tipos de estado
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
create type public.job_status as enum ('pending', 'in_progress', 'done', 'cancelled');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'void');

create type public.profile_role as enum ('admin', 'staff', 'sales');

-- Perfiles ligados a auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.profile_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  status public.quote_status not null default 'draft',
  title text,
  valid_until date,
  notes text,
  total_cents bigint not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price_cents bigint not null default 0,
  sort_order int not null default 0
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete restrict,
  title text not null,
  status public.job_status not null default 'pending',
  scheduled_for date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  job_id uuid references public.jobs (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  status public.invoice_status not null default 'draft',
  issue_date date,
  due_date date,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price_cents bigint not null default 0,
  sort_order int not null default 0
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'm2',
  stock_qty numeric(14, 3) not null default 0,
  reorder_level numeric(14, 3),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_quotes_client on public.quotes (client_id);
create index idx_jobs_client on public.jobs (client_id);
create index idx_jobs_status on public.jobs (status);
create index idx_invoices_client on public.invoices (client_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row
  execute function public.set_updated_at();

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_updated_at();

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row
  execute function public.set_updated_at();

-- Alta automática de perfil al registrarse en Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.materials enable row level security;

-- Políticas MVP: todo usuario autenticado del taller (refina por rol o sucursal después)
create policy "authenticated_select_profiles"
  on public.profiles for select to authenticated using (true);
create policy "authenticated_update_own_profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "authenticated_all_clients"
  on public.clients for all to authenticated using (true) with check (true);
create policy "authenticated_all_quotes"
  on public.quotes for all to authenticated using (true) with check (true);
create policy "authenticated_all_quote_items"
  on public.quote_items for all to authenticated using (true) with check (true);
create policy "authenticated_all_jobs"
  on public.jobs for all to authenticated using (true) with check (true);
create policy "authenticated_all_invoices"
  on public.invoices for all to authenticated using (true) with check (true);
create policy "authenticated_all_invoice_items"
  on public.invoice_items for all to authenticated using (true) with check (true);
create policy "authenticated_all_materials"
  on public.materials for all to authenticated using (true) with check (true);

grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- service_role ya bypass RLS; permisos por defecto suelen bastar para postgres
