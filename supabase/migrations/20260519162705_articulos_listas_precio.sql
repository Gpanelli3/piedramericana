-- ============================================================
-- Migración: Maestro de artículos dinámico + Listas de precio
-- Fase 1 — Piedra Americana (MarmoGest)
-- ============================================================

-- ─── 1. Tipos ────────────────────────────────────────────────

create type unidad_articulo as enum ('M2', 'ML', 'UNI');

-- ─── 2. Tabla articulos ──────────────────────────────────────

create table articulos (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null,
  descripcion         text not null,
  unidad              unidad_articulo not null default 'M2',
  calcula_material    boolean not null default true,
  -- Si calcula_material = true y unidad = M2: el precio es por m²
  -- Si calcula_material = true y unidad = ML: el precio es por metro lineal
  -- Si calcula_material = false: el precio es por unidad
  medida_estandar_m2  numeric(10,4) default null,
  -- Si distinto de null: al agregar el ítem se usa ese valor fijo como m² por unidad
  prefer_modo_manual  boolean not null default false,
  -- Si true: al agregar el ítem el modo por defecto es "m² totales"
  activo              boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- índices útiles
create unique index articulos_codigo_unique on articulos (lower(codigo)) where activo = true;
create index articulos_activo_sort on articulos (activo, sort_order, descripcion);

-- trigger updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger articulos_updated_at
  before update on articulos
  for each row execute function set_updated_at();

-- RLS
alter table articulos enable row level security;
-- Lectura pública para usuarios autenticados (vendedores, etc.)
create policy "articulos_select_auth"
  on articulos for select
  to authenticated
  using (true);
-- Solo admin puede escribir (los permisos granulares se amplían en Fase 1.5)
create policy "articulos_insert_admin"
  on articulos for insert
  to authenticated
  with check (
    exists (
      select 1 from usuarios
      where id = auth.uid() and role = 'admin'
    )
  );
create policy "articulos_update_admin"
  on articulos for update
  to authenticated
  using (
    exists (
      select 1 from usuarios
      where id = auth.uid() and role = 'admin'
    )
  );
create policy "articulos_delete_admin"
  on articulos for delete
  to authenticated
  using (
    exists (
      select 1 from usuarios
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── 3. Tabla listas_precio ──────────────────────────────────

create table listas_precio (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null,
  label       text not null,
  -- Moneda base de la lista (los precios de los ítems están en esta moneda)
  moneda      text not null default 'usd' check (moneda in ('ars', 'usd')),
  descripcion text default null,
  activa      boolean not null default true,
  -- Vigencia: si null, no tiene fecha de corte
  vigente_desde date default null,
  vigente_hasta date default null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index listas_precio_codigo_unique on listas_precio (lower(codigo)) where activa = true;
create index listas_precio_activa on listas_precio (activa, sort_order);

create trigger listas_precio_updated_at
  before update on listas_precio
  for each row execute function set_updated_at();

alter table listas_precio enable row level security;
create policy "listas_precio_select_auth"
  on listas_precio for select to authenticated using (true);
create policy "listas_precio_write_admin"
  on listas_precio for all to authenticated
  using (exists (select 1 from usuarios where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from usuarios where id = auth.uid() and role = 'admin'));

-- ─── 4. Tabla listas_precio_items ────────────────────────────

create table listas_precio_items (
  id              uuid primary key default gen_random_uuid(),
  lista_precio_id uuid not null references listas_precio (id) on delete cascade,
  articulo_id     uuid not null references articulos (id) on delete cascade,
  precio          numeric(14,4) not null default 0,
  -- precio en la moneda de la lista padre
  -- precio_override null = usa el precio de esta tabla
  -- En el futuro puede tener descuento_pct o precio por rango de m²
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (lista_precio_id, articulo_id)
);

create index listas_precio_items_lista on listas_precio_items (lista_precio_id, activo);
create index listas_precio_items_articulo on listas_precio_items (articulo_id);

create trigger listas_precio_items_updated_at
  before update on listas_precio_items
  for each row execute function set_updated_at();

alter table listas_precio_items enable row level security;
create policy "listas_precio_items_select_auth"
  on listas_precio_items for select to authenticated using (true);
create policy "listas_precio_items_write_admin"
  on listas_precio_items for all to authenticated
  using (exists (select 1 from usuarios where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from usuarios where id = auth.uid() and role = 'admin'));

-- ─── 5. Función RPC: get_articulos_con_precios ───────────────
-- Devuelve todos los artículos activos con el precio de la lista solicitada.
-- Si el artículo no tiene precio en esa lista, precio = null.

create or replace function get_articulos_con_precios(p_lista_precio_id uuid)
returns table (
  id                  uuid,
  codigo              text,
  descripcion         text,
  unidad              unidad_articulo,
  calcula_material    boolean,
  medida_estandar_m2  numeric,
  prefer_modo_manual  boolean,
  sort_order          integer,
  precio              numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.codigo,
    a.descripcion,
    a.unidad,
    a.calcula_material,
    a.medida_estandar_m2,
    a.prefer_modo_manual,
    a.sort_order,
    lpi.precio
  from articulos a
  left join listas_precio_items lpi
    on lpi.articulo_id = a.id
    and lpi.lista_precio_id = p_lista_precio_id
    and lpi.activo = true
  where a.activo = true
  order by a.sort_order, a.descripcion;
$$;

-- ─── 6. Seed: artículos base ─────────────────────────────────

insert into articulos (codigo, descripcion, unidad, calcula_material, medida_estandar_m2, prefer_modo_manual, sort_order)
values
  ('MES-ALZ',  'Mesada y alzada',                     'M2',  true,  null, false,  10),
  ('MES-ASA',  'Mesada de asador',                    'M2',  true,  null, true,   20),
  ('MES-BAÑ',  'Mesada de baño',                      'M2',  true,  null, false,  30),
  ('MES-LAV',  'Mesada de lavadero',                  'M2',  true,  null, false,  40),
  ('ZOC-ML',   'Zócalo',                              'ML',  true,  null, false,  50),
  ('BIS-ML',   'Biselado',                            'ML',  true,  null, false,  60),
  ('FRI-ML',   'Frentín ingletado',                   'ML',  true,  null, false,  70),
  ('PAT-UNI',  'Pata de isla / soporte',              'UNI', false, null, false,  80),
  ('BACH-MO',  'Bacha integrada — mano de obra',      'UNI', false, null, false,  90),
  ('BACH-INS', 'Instalación de bacha del cliente',    'UNI', false, null, false, 100),
  ('TRAS-UNI', 'Trasforo (perforación circular)',     'UNI', false, null, false, 110),
  ('ESC-UNI',  'Escuadra de apoyo',                   'UNI', false, null, false, 120),
  ('ADO-M2',   'Adoquín 10×10',                       'M2',  true,  null, false, 200),
  ('LAJ-M2',   'Laja irregular',                      'M2',  true,  null, false, 210),
  ('PIR-M2',   'Pirca abierta',                       'M2',  true,  null, false, 220);

-- ─── 7. Seed: listas de precio ───────────────────────────────

with listas as (
  insert into listas_precio (codigo, label, moneda, descripcion, sort_order)
  values
    ('GENERAL',     'Lista general (público)',           'usd', 'Precios de lista para público en general',              10),
    ('ARQUITECTOS', 'Arquitectos y diseñadores',         'usd', 'Precios con descuento para profesionales del diseño',   20)
  returning id, codigo
)
insert into listas_precio_items (lista_precio_id, articulo_id, precio)
select
  l.id,
  a.id,
  case
    -- Lista GENERAL: precios en USD
    when l.codigo = 'GENERAL' then
      case a.codigo
        when 'MES-ALZ'  then 85
        when 'MES-ASA'  then 80
        when 'MES-BAÑ'  then 75
        when 'MES-LAV'  then 70
        when 'ZOC-ML'   then 35
        when 'BIS-ML'   then 40
        when 'FRI-ML'   then 38
        when 'PAT-UNI'  then 25
        when 'BACH-MO'  then 45
        when 'BACH-INS' then 30
        when 'TRAS-UNI' then 20
        when 'ESC-UNI'  then 15
        when 'ADO-M2'   then 55
        when 'LAJ-M2'   then 48
        when 'PIR-M2'   then 42
        else 0
      end
    -- Lista ARQUITECTOS: ~15% menos que GENERAL
    when l.codigo = 'ARQUITECTOS' then
      case a.codigo
        when 'MES-ALZ'  then 72
        when 'MES-ASA'  then 68
        when 'MES-BAÑ'  then 64
        when 'MES-LAV'  then 60
        when 'ZOC-ML'   then 30
        when 'BIS-ML'   then 34
        when 'FRI-ML'   then 32
        when 'PAT-UNI'  then 21
        when 'BACH-MO'  then 38
        when 'BACH-INS' then 25
        when 'TRAS-UNI' then 17
        when 'ESC-UNI'  then 13
        when 'ADO-M2'   then 47
        when 'LAJ-M2'   then 41
        when 'PIR-M2'   then 36
        else 0
      end
    else 0
  end
from listas l
cross join articulos a
where a.activo = true;
