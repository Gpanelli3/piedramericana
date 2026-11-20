-- Módulo Planificación: agenda de entregas/colocaciones, mediciones y tareas manuales.
-- La fecha prometida al cliente sigue en ordenes_trabajo.fecha_programada;
-- lo agendado de verdad (día + horario + empleados) vive en planificacion_eventos.

-- ─── Tipo de entrega por OT ──────────────────────────────────
alter table public.ordenes_trabajo
  add column if not exists tipo_entrega text not null default 'retira',
  add column if not exists entregada_en timestamptz;

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_tipo_entrega_check;
alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_tipo_entrega_check
  check (tipo_entrega in ('retira', 'logistica', 'colocacion'));

-- Relleno desde los servicios cargados en el presupuesto:
-- colocación > entrega con logística > retira en fábrica.
update public.ordenes_trabajo ot
set tipo_entrega = case
    when p.payload -> 'mColocacionGlobal' = 'true'::jsonb then 'colocacion'
    when p.payload -> 'mEntregaGlobal' = 'true'::jsonb then 'logistica'
    else 'retira'
  end
from public.ventas v
join public.presupuestos p on p.id = v.presupuesto_id
where ot.venta_id = v.id;

-- Las OTs ya entregadas toman como fecha de entrega su última actualización.
update public.ordenes_trabajo
set entregada_en = actualizado_en
where estado = 'done' and entregada_en is null;

-- ─── Agenda ──────────────────────────────────────────────────
create table if not exists public.planificacion_eventos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrega', 'medicion', 'tarea')),
  ot_id uuid references public.ordenes_trabajo(id) on delete cascade,
  medicion_id uuid references public.presupuesto_mediciones(id) on delete cascade,
  venta_id uuid references public.ventas(id) on delete set null,
  fecha date not null,
  hora_desde time,
  hora_hasta time,
  titulo text,
  direccion text,
  notas text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'hecho', 'cancelado')),
  hecho_en timestamptz,
  hecho_por uuid references public.usuarios(id) on delete set null,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planificacion_eventos_origen_check check (
    (tipo = 'entrega' and ot_id is not null)
    or (tipo = 'medicion' and medicion_id is not null)
    or (tipo = 'tarea' and nullif(trim(titulo), '') is not null)
  ),
  constraint planificacion_eventos_horario_check check (
    hora_desde is null
    or hora_hasta is null
    or hora_hasta > hora_desde
  ),
  constraint planificacion_eventos_hasta_requiere_desde check (
    hora_hasta is null or hora_desde is not null
  )
);

create index if not exists planificacion_eventos_fecha_idx
  on public.planificacion_eventos (fecha, hora_desde);

create index if not exists planificacion_eventos_ot_idx
  on public.planificacion_eventos (ot_id);

create index if not exists planificacion_eventos_medicion_idx
  on public.planificacion_eventos (medicion_id);

-- Una sola entrega pendiente por OT y una sola visita pendiente por medición.
create unique index if not exists planificacion_eventos_entrega_pendiente_uq
  on public.planificacion_eventos (ot_id)
  where tipo = 'entrega' and estado = 'pendiente';

create unique index if not exists planificacion_eventos_medicion_pendiente_uq
  on public.planificacion_eventos (medicion_id)
  where tipo = 'medicion' and estado = 'pendiente';

alter table public.planificacion_eventos enable row level security;

drop policy if exists "planificacion_eventos_select_auth" on public.planificacion_eventos;
drop policy if exists "planificacion_eventos_write_auth" on public.planificacion_eventos;

create policy "planificacion_eventos_select_auth"
  on public.planificacion_eventos for select to authenticated using (true);

create policy "planificacion_eventos_write_auth"
  on public.planificacion_eventos for all to authenticated using (true) with check (true);

-- ─── Empleados asignados a cada evento ───────────────────────
create table if not exists public.planificacion_evento_empleados (
  evento_id uuid not null references public.planificacion_eventos(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  primary key (evento_id, empleado_id)
);

create index if not exists planificacion_evento_empleados_empleado_idx
  on public.planificacion_evento_empleados (empleado_id);

alter table public.planificacion_evento_empleados enable row level security;

drop policy if exists "planificacion_evento_empleados_select_auth" on public.planificacion_evento_empleados;
drop policy if exists "planificacion_evento_empleados_write_auth" on public.planificacion_evento_empleados;

create policy "planificacion_evento_empleados_select_auth"
  on public.planificacion_evento_empleados for select to authenticated using (true);

create policy "planificacion_evento_empleados_write_auth"
  on public.planificacion_evento_empleados for all to authenticated using (true) with check (true);
