-- Vacaciones y documentos del legajo de empleados.

-- ─── vacaciones_empleado ─────────────────────────────────────
create table if not exists public.vacaciones_empleado (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  desde date not null,
  hasta date not null,
  dias integer not null check (dias > 0),
  notas text,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vacaciones_rango_valido check (hasta >= desde)
);

create index if not exists vacaciones_empleado_empleado_idx
  on public.vacaciones_empleado (empleado_id, desde desc);

alter table public.vacaciones_empleado enable row level security;

drop policy if exists "vacaciones_empleado_select_auth" on public.vacaciones_empleado;
drop policy if exists "vacaciones_empleado_write_auth" on public.vacaciones_empleado;

create policy "vacaciones_empleado_select_auth"
  on public.vacaciones_empleado for select to authenticated using (true);

create policy "vacaciones_empleado_write_auth"
  on public.vacaciones_empleado for all to authenticated using (true) with check (true);

-- ─── empleado_documentos ─────────────────────────────────────
create table if not exists public.empleado_documentos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  tipo text not null default 'otro'
    check (tipo in ('certificado_medico', 'contrato', 'dni', 'cuil', 'otro')),
  nombre text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists empleado_documentos_empleado_idx
  on public.empleado_documentos (empleado_id, created_at desc);

alter table public.empleado_documentos enable row level security;

drop policy if exists "empleado_documentos_select_auth" on public.empleado_documentos;
drop policy if exists "empleado_documentos_write_auth" on public.empleado_documentos;

create policy "empleado_documentos_select_auth"
  on public.empleado_documentos for select to authenticated using (true);

create policy "empleado_documentos_write_auth"
  on public.empleado_documentos for all to authenticated using (true) with check (true);

-- ─── bucket privado para los archivos del legajo ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'empleados-legajo',
  'empleados-legajo',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "empleados_legajo_select_authenticated" on storage.objects;
create policy "empleados_legajo_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'empleados-legajo');

drop policy if exists "empleados_legajo_insert_authenticated" on storage.objects;
create policy "empleados_legajo_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'empleados-legajo');

drop policy if exists "empleados_legajo_update_authenticated" on storage.objects;
create policy "empleados_legajo_update_authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'empleados-legajo')
  with check (bucket_id = 'empleados-legajo');

drop policy if exists "empleados_legajo_delete_authenticated" on storage.objects;
create policy "empleados_legajo_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'empleados-legajo');
