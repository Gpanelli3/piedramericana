-- Ventas 1:1 con presupuesto aprobado, pagos de seña N:1 y extensión de jobs como OT desde la primera seña.

-- Literales ASCII (sin ñ): deben coincidir con VentaEstado en la app (`aprobado_sin_sena`, `senado`).
DO $$
BEGIN
  CREATE TYPE public.venta_estado AS ENUM (
    'aprobado_sin_sena',
    'senado',
    'en_produccion',
    'finalizado',
    'entregado'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL UNIQUE REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  estado public.venta_estado NOT NULL DEFAULT 'aprobado_sin_sena'::public.venta_estado,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ventas_estado ON public.ventas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON public.ventas(created_at DESC);

CREATE TABLE IF NOT EXISTS public.ventas_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  monto numeric(14, 2) NOT NULL CHECK (monto > 0),
  moneda text NOT NULL CHECK (moneda IN ('ars', 'usd')),
  fecha date NOT NULL,
  metodo text NOT NULL,
  nota text,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ventas_pagos_venta_id ON public.ventas_pagos(venta_id);

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ventas_acceso_app" ON public.ventas;
CREATE POLICY "ventas_acceso_app"
  ON public.ventas FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ventas_pagos_acceso_app" ON public.ventas_pagos;
CREATE POLICY "ventas_pagos_acceso_app"
  ON public.ventas_pagos FOR ALL
  USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs ALTER COLUMN client_id DROP NOT NULL;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS venta_id uuid;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS etapa_ot text;
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pausada boolean NOT NULL DEFAULT false;

    UPDATE public.jobs SET etapa_ot = 'medicion' WHERE etapa_ot IS NULL;
    ALTER TABLE public.jobs ALTER COLUMN etapa_ot SET DEFAULT 'medicion';
    ALTER TABLE public.jobs ALTER COLUMN etapa_ot SET NOT NULL;

    ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_etapa_ot_check;
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_etapa_ot_check
      CHECK (etapa_ot IN ('medicion', 'corte', 'produccion', 'despacho'));

    DROP INDEX IF EXISTS idx_jobs_venta_id_unique;
    CREATE UNIQUE INDEX idx_jobs_venta_id_unique ON public.jobs (venta_id)
      WHERE venta_id IS NOT NULL;

    ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_venta_id_fkey;
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_venta_id_fkey
      FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;
  END IF;
END $$;
