-- Historia del precio: lo que se le mostró al cliente y cada cambio.
CREATE TABLE IF NOT EXISTS public.presupuesto_eventos_precio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT presupuesto_eventos_precio_tipo_check
    CHECK (tipo IN ('primer_precio', 'enviado_pdf', 'version_nueva', 'ajuste')),
  CONSTRAINT presupuesto_eventos_precio_moneda_check
    CHECK (moneda IN ('ars', 'usd'))
);

CREATE INDEX IF NOT EXISTS presupuesto_eventos_precio_presupuesto_id_idx
  ON public.presupuesto_eventos_precio (presupuesto_id, created_at DESC);

ALTER TABLE public.presupuesto_eventos_precio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presupuesto_eventos_precio_select_auth" ON public.presupuesto_eventos_precio;
DROP POLICY IF EXISTS "presupuesto_eventos_precio_write_auth" ON public.presupuesto_eventos_precio;

CREATE POLICY "presupuesto_eventos_precio_select_auth"
  ON public.presupuesto_eventos_precio FOR SELECT TO authenticated USING (true);

CREATE POLICY "presupuesto_eventos_precio_write_auth"
  ON public.presupuesto_eventos_precio FOR ALL TO authenticated USING (true) WITH CHECK (true);
