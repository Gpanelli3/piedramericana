-- M06: una OT de taller por mesada del presupuesto + reposición ligada al origen
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS orden_key text,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ot_origen_id uuid REFERENCES public.ordenes_trabajo(id) ON DELETE SET NULL;

ALTER TABLE public.ordenes_trabajo
  DROP CONSTRAINT IF EXISTS ordenes_trabajo_tipo_check;

ALTER TABLE public.ordenes_trabajo
  ADD CONSTRAINT ordenes_trabajo_tipo_check CHECK (tipo IN ('normal', 'reposicion'));

CREATE INDEX IF NOT EXISTS ordenes_trabajo_ot_origen_id_idx
  ON public.ordenes_trabajo (ot_origen_id)
  WHERE ot_origen_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ordenes_trabajo_venta_orden_key_normal_idx
  ON public.ordenes_trabajo (venta_id, orden_key)
  WHERE tipo = 'normal' AND orden_key IS NOT NULL AND venta_id IS NOT NULL;

COMMENT ON COLUMN public.ordenes_trabajo.orden_key IS 'Clave de payload.ordenes[].key; nula en OTs legacy (1 por venta).';
COMMENT ON COLUMN public.ordenes_trabajo.tipo IS 'normal = OT de venta; reposicion = OT hija por rotura/reproceso.';
COMMENT ON COLUMN public.ordenes_trabajo.ot_origen_id IS 'OT de origen cuando tipo = reposicion.';
