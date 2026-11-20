-- Tanda 1: precios, piedras y bachas.

-- ─── 1. Piedras vs. productos de cantera ─────────────────────
-- El selector de piedra del presupuesto muestra solo uso = 'piedra'.
-- Los productos de cantera (adoquines, piedritas, despunte) se venden como artículos.
alter table public.materials
  add column if not exists uso text not null default 'piedra';

alter table public.materials
  drop constraint if exists materials_uso_check;
alter table public.materials
  add constraint materials_uso_check check (uso in ('piedra', 'producto'));

update public.materials
set uso = 'producto'
where uso = 'piedra'
  and lower(name) like any (array['adoquines%', 'despunte%', 'piedritas%', 'granza%']);

-- ─── 2. Presupuesto: lista, dólar y descuento en columnas ────────
-- Hasta ahora solo vivían dentro del JSON `payload`.
update public.presupuestos p
set lista_precio_id = l.id
from public.listas_precio l
where p.lista_precio_id is null
  and l.id::text = p.payload ->> 'listaPrecioId';

update public.presupuestos
set cotizacion_usd = (payload ->> 'dolarHoy')::numeric
where cotizacion_usd is null
  and (payload ->> 'dolarHoy') ~ '^[0-9]+(\.[0-9]+)?$';

update public.presupuestos
set descuento_global = replace(payload ->> 'descuentoGlobalPct', ',', '.')::numeric
where coalesce(descuento_global, 0) = 0
  and replace(coalesce(payload ->> 'descuentoGlobalPct', ''), ',', '.') ~ '^[0-9]+(\.[0-9]+)?$';

-- ─── 3. Bachas: precio de venta por modelo ───────────────────
alter table public.bachas_inventario
  add column if not exists precio_venta numeric(14, 2),
  add column if not exists moneda text not null default 'ars';

alter table public.bachas_inventario
  drop constraint if exists bachas_inventario_moneda_check;
alter table public.bachas_inventario
  add constraint bachas_inventario_moneda_check check (moneda in ('ars', 'usd'));

-- ─── 4. Artículo de mano de obra de bacha (bacha del cliente) ──
update public.articulos
set activo = true
where codigo = 'BACHA_MO';
