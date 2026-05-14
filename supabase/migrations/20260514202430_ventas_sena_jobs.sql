-- Ventas 1:1 con presupuesto aprobado, pagos de seña N:1. La tabla OT está en `ordenes_trabajo` (migración siguiente).

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
