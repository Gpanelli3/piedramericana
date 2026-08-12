-- Reemplaza el catálogo de sub-ítems: desactiva los artículos viejos
-- y deja activos solo los tipos de cotización (Pieza, Revestimiento, etc.).

with datos (
  codigo, descripcion, unidad, calcula_material, sort_order
) as (
  values
    ('PIEZA',  'Pieza',                 'M2'::unidad_articulo,  true,  10),
    ('REV',    'Revestimiento',         'M2'::unidad_articulo,  true,  20),
    ('FAL',    'Faldón',                'M2'::unidad_articulo,  true,  30),
    ('ING',    'Inglete',               'ML'::unidad_articulo,  true,  40),
    ('ACA',    'Acanalado',             'ML'::unidad_articulo,  true,  50),
    ('COR',    'Corte',                 'UNI'::unidad_articulo, false, 60),
    ('CANTO',  'Terminación de canto',  'ML'::unidad_articulo,  true,  70),
    ('PERF',   'Perforación',           'UNI'::unidad_articulo, false, 80),
    ('ZOC-M2', 'Zócalo',                'M2'::unidad_articulo,  true,  90),
    ('FIJO',   'Precio fijo',           'UNI'::unidad_articulo, false, 100),
    ('BACHA',  'Bacha',                 'UNI'::unidad_articulo, false, 110),
    ('HERR',   'Herrería',              'UNI'::unidad_articulo, false, 120),
    ('MO',     'Mano de obra',          'UNI'::unidad_articulo, false, 130)
),
updated as (
  update articulos a
  set
    descripcion = d.descripcion,
    unidad = d.unidad,
    calcula_material = d.calcula_material,
    medida_estandar_m2 = null,
    prefer_modo_manual = false,
    sort_order = d.sort_order,
    activo = true
  from datos d
  where lower(a.codigo) = lower(d.codigo)
  returning a.codigo
)
insert into articulos (
  codigo, descripcion, unidad, calcula_material,
  medida_estandar_m2, prefer_modo_manual, sort_order, activo
)
select
  d.codigo,
  d.descripcion,
  d.unidad,
  d.calcula_material,
  null,
  false,
  d.sort_order,
  true
from datos d
where not exists (
  select 1 from articulos a where lower(a.codigo) = lower(d.codigo)
);

update articulos
set activo = false
where lower(codigo) not in (
  'pieza', 'rev', 'fal', 'ing', 'aca', 'cor', 'canto',
  'perf', 'zoc-m2', 'fijo', 'bacha', 'herr', 'mo'
);
