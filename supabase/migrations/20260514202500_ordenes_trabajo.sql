-- Órdenes de trabajo (OT) ligadas a `ventas`. Primera seña → se crea un registro aquí (`crearJobOtSiAusente`).

CREATE TABLE IF NOT EXISTS public.ordenes_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cotizacion uuid,
  id_cliente uuid,
  titulo text NOT NULL,
  -- Mismos literales que `JobStatus` en la app (pending, in_progress, done, cancelled).
  estado text NOT NULL DEFAULT 'pending',
  fecha_programada timestamptz,
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  venta_id uuid,
  etapa text NOT NULL DEFAULT 'medicion',
  pausada boolean NOT NULL DEFAULT false,
  CONSTRAINT ordenes_trabajo_estado_check
    CHECK (estado IN ('pending', 'in_progress', 'done', 'cancelled')),
  CONSTRAINT ordenes_trabajo_etapa_check
    CHECK (etapa IN ('medicion', 'corte', 'produccion', 'despacho'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_trabajo_venta_id_fkey'
  ) THEN
    ALTER TABLE public.ordenes_trabajo
      ADD CONSTRAINT ordenes_trabajo_venta_id_fkey
      FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_ordenes_trabajo_venta_id_unique;
CREATE UNIQUE INDEX idx_ordenes_trabajo_venta_id_unique ON public.ordenes_trabajo (venta_id)
  WHERE venta_id IS NOT NULL;

ALTER TABLE public.ordenes_trabajo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordenes_trabajo_acceso_app" ON public.ordenes_trabajo;
CREATE POLICY "ordenes_trabajo_acceso_app"
  ON public.ordenes_trabajo FOR ALL
  USING (true) WITH CHECK (true);

-- FK opcionales si ya existen `clients` y `quotes` (proyectos que los tengan).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_trabajo_id_cliente_fkey') THEN
    ALTER TABLE public.ordenes_trabajo
      ADD CONSTRAINT ordenes_trabajo_id_cliente_fkey
      FOREIGN KEY (id_cliente) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quotes'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_trabajo_id_cotizacion_fkey') THEN
    ALTER TABLE public.ordenes_trabajo
      ADD CONSTRAINT ordenes_trabajo_id_cotizacion_fkey
      FOREIGN KEY (id_cotizacion) REFERENCES public.quotes(id) ON DELETE SET NULL;
  END IF;
END $$;
