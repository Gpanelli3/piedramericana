-- Presupuestos: cabecera + payload JSON del wizard.

DO $$ BEGIN
  CREATE TYPE public.presupuesto_estado AS ENUM ('pendiente', 'aprobado', 'rechazado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  cliente text NOT NULL DEFAULT '',
  total double precision NOT NULL DEFAULT 0,
  moneda text NOT NULL CHECK (moneda IN ('ars', 'usd')),
  status public.presupuesto_estado NOT NULL DEFAULT 'pendiente'::public.presupuesto_estado,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero)
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_status ON public.presupuestos(status);
CREATE INDEX IF NOT EXISTS idx_presupuestos_created_at ON public.presupuestos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presupuestos_status_created_at ON public.presupuestos(status, created_at DESC);

ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presupuestos_acceso_app" ON public.presupuestos;
CREATE POLICY "presupuestos_acceso_app"
  ON public.presupuestos FOR ALL
  USING (true) WITH CHECK (true);
