ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS nro_version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.presupuesto_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  nro integer NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  m2 numeric NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presupuesto_versiones_nro_positivo CHECK (nro >= 1),
  CONSTRAINT presupuesto_versiones_unique UNIQUE (presupuesto_id, nro)
);

CREATE INDEX IF NOT EXISTS presupuesto_versiones_presupuesto_id_idx
  ON public.presupuesto_versiones (presupuesto_id, nro DESC);

ALTER TABLE public.presupuesto_versiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presupuesto_versiones_select_auth" ON public.presupuesto_versiones;
DROP POLICY IF EXISTS "presupuesto_versiones_write_auth" ON public.presupuesto_versiones;

CREATE POLICY "presupuesto_versiones_select_auth"
  ON public.presupuesto_versiones FOR SELECT TO authenticated USING (true);

CREATE POLICY "presupuesto_versiones_write_auth"
  ON public.presupuesto_versiones FOR ALL TO authenticated USING (true) WITH CHECK (true);
