-- Medición como proceso de venta, ligada al presupuesto (no a la OT).
-- Una visita por obra: sirve aunque el presupuesto siga pendiente y no exista venta.

CREATE TYPE public.medicion_estado AS ENUM (
  'sin_solicitar',
  'listo_para_medir',
  'medido',
  'no_requiere'
);

CREATE TABLE public.presupuesto_mediciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  estado public.medicion_estado NOT NULL DEFAULT 'sin_solicitar',
  solicitado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  solicitado_en timestamptz,
  fecha_programada date,
  medido_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  medido_en timestamptz,
  motivo_salto text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presupuesto_mediciones_presupuesto_unique UNIQUE (presupuesto_id),
  CONSTRAINT presupuesto_mediciones_salto_ck CHECK (
    estado <> 'no_requiere'
    OR (motivo_salto IS NOT NULL AND length(btrim(motivo_salto)) > 0)
  )
);

CREATE INDEX presupuesto_mediciones_estado_fecha_idx
  ON public.presupuesto_mediciones (estado, fecha_programada);

COMMENT ON TABLE public.presupuesto_mediciones IS
  'Estado de medición por presupuesto. Independiente de venta/OT para el 10% que se mide con el presupuesto pendiente.';

CREATE OR REPLACE FUNCTION public.ensure_presupuesto_medicion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.presupuesto_mediciones (presupuesto_id)
  VALUES (NEW.id)
  ON CONFLICT (presupuesto_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER presupuestos_medicion_ai
  AFTER INSERT ON public.presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_presupuesto_medicion();

-- Backfill: una fila por presupuesto existente.
INSERT INTO public.presupuesto_mediciones (presupuesto_id, estado)
SELECT p.id, 'sin_solicitar'::public.medicion_estado
FROM public.presupuestos p
ON CONFLICT (presupuesto_id) DO NOTHING;

-- Cola actual de Técnica (OT en medición, activa) → listo para medir.
UPDATE public.presupuesto_mediciones pm
SET
  estado = 'listo_para_medir',
  solicitado_en = COALESCE(pm.solicitado_en, now()),
  updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.ordenes_trabajo ot
  JOIN public.ventas v ON v.id = ot.venta_id
  WHERE v.presupuesto_id = pm.presupuesto_id
    AND ot.etapa = 'medicion'
    AND ot.estado NOT IN ('done', 'cancelled')
);

-- Ya salió a corte/producción/despacho sin confirmar medidas → saltada (migrado).
UPDATE public.presupuesto_mediciones pm
SET
  estado = 'no_requiere',
  motivo_salto = 'Migrado: la OT ya estaba en producción.',
  notas = COALESCE(pm.notas, 'migrado'),
  updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.ordenes_trabajo ot
  JOIN public.ventas v ON v.id = ot.venta_id
  WHERE v.presupuesto_id = pm.presupuesto_id
    AND ot.etapa IN ('corte', 'produccion', 'despacho')
    AND ot.estado <> 'cancelled'
);

-- Si alguna OT confirmó medidas, gana 'medido' (aunque ya esté en producción).
UPDATE public.presupuesto_mediciones pm
SET
  estado = 'medido',
  medido_en = COALESCE(
    (
      SELECT MIN(ot.fecha_medidas_confirmadas)
      FROM public.ordenes_trabajo ot
      JOIN public.ventas v ON v.id = ot.venta_id
      WHERE v.presupuesto_id = pm.presupuesto_id
        AND ot.medidas_confirmadas
    ),
    now()
  ),
  motivo_salto = NULL,
  updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.ordenes_trabajo ot
  JOIN public.ventas v ON v.id = ot.venta_id
  WHERE v.presupuesto_id = pm.presupuesto_id
    AND ot.medidas_confirmadas
);

ALTER TABLE public.presupuesto_mediciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_mediciones_select_auth"
  ON public.presupuesto_mediciones FOR SELECT TO authenticated USING (true);

CREATE POLICY "presupuesto_mediciones_write_auth"
  ON public.presupuesto_mediciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presupuesto_mediciones TO authenticated;
GRANT ALL ON public.presupuesto_mediciones TO service_role;
