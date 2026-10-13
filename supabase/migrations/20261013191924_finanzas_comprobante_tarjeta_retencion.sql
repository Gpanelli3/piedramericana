-- Finanzas entrevista: retención en cobros, tarjeta pendiente de acreditar, comprobante en movimiento.

-- ─── Retención en el cobro de venta ───────────────────────────
ALTER TABLE public.ventas_pagos
  ADD COLUMN IF NOT EXISTS retencion_porcentaje numeric,
  ADD COLUMN IF NOT EXISTS retencion_monto numeric NOT NULL DEFAULT 0;

UPDATE public.ventas_pagos
SET retencion_monto = 0
WHERE retencion_monto IS NULL;

ALTER TABLE public.ventas_pagos
  DROP CONSTRAINT IF EXISTS ventas_pagos_retencion_porcentaje_check;
ALTER TABLE public.ventas_pagos
  ADD CONSTRAINT ventas_pagos_retencion_porcentaje_check
  CHECK (retencion_porcentaje IS NULL OR (retencion_porcentaje >= 0 AND retencion_porcentaje <= 100));

ALTER TABLE public.ventas_pagos
  DROP CONSTRAINT IF EXISTS ventas_pagos_retencion_monto_check;
ALTER TABLE public.ventas_pagos
  ADD CONSTRAINT ventas_pagos_retencion_monto_check
  CHECK (retencion_monto >= 0);

-- ─── Acreditación de tarjeta + comprobante ────────────────────
ALTER TABLE public.movimientos_caja
  ADD COLUMN IF NOT EXISTS comprobante_path text,
  ADD COLUMN IF NOT EXISTS acreditacion text NOT NULL DEFAULT 'no_aplica',
  ADD COLUMN IF NOT EXISTS monto_acreditado numeric,
  ADD COLUMN IF NOT EXISTS fecha_acreditacion date,
  ADD COLUMN IF NOT EXISTS movimiento_origen_id uuid REFERENCES public.movimientos_caja(id) ON DELETE SET NULL;

UPDATE public.movimientos_caja
SET acreditacion = 'no_aplica'
WHERE acreditacion IS NULL;

ALTER TABLE public.movimientos_caja
  DROP CONSTRAINT IF EXISTS movimientos_caja_acreditacion_check;
ALTER TABLE public.movimientos_caja
  ADD CONSTRAINT movimientos_caja_acreditacion_check
  CHECK (acreditacion IN ('no_aplica', 'pendiente', 'acreditado'));

ALTER TABLE public.movimientos_caja
  DROP CONSTRAINT IF EXISTS movimientos_caja_monto_acreditado_check;
ALTER TABLE public.movimientos_caja
  ADD CONSTRAINT movimientos_caja_monto_acreditado_check
  CHECK (monto_acreditado IS NULL OR monto_acreditado > 0);

ALTER TABLE public.movimientos_caja
  DROP CONSTRAINT IF EXISTS movimientos_caja_acreditacion_estado_check;
ALTER TABLE public.movimientos_caja
  ADD CONSTRAINT movimientos_caja_acreditacion_estado_check
  CHECK (
    (acreditacion = 'no_aplica' AND monto_acreditado IS NULL AND fecha_acreditacion IS NULL)
    OR (acreditacion = 'pendiente' AND monto_acreditado IS NULL AND fecha_acreditacion IS NULL)
    OR (acreditacion = 'acreditado' AND monto_acreditado IS NOT NULL AND fecha_acreditacion IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_caja_origen_tarjeta
  ON public.movimientos_caja (movimiento_origen_id)
  WHERE movimiento_origen_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_tarjeta_pendiente
  ON public.movimientos_caja (fecha DESC)
  WHERE acreditacion = 'pendiente';

-- ─── Saldo disponible: tarjeta pendiente/acreditada no suma ───
CREATE OR REPLACE VIEW public.v_saldos_cuentas AS
SELECT
  c.id AS cuenta_id,
  c.nombre,
  c.tipo,
  c.moneda,
  c.saldo_inicial,
  COALESCE(SUM(
    CASE
      WHEN m.acreditacion IN ('pendiente', 'acreditado') THEN 0
      WHEN m.tipo IN ('ingreso', 'transferencia_entrada') THEN m.monto
      WHEN m.tipo IN ('egreso', 'transferencia_salida') THEN -m.monto
      ELSE 0
    END
  ), 0) AS movimientos_neto,
  c.saldo_inicial + COALESCE(SUM(
    CASE
      WHEN m.acreditacion IN ('pendiente', 'acreditado') THEN 0
      WHEN m.tipo IN ('ingreso', 'transferencia_entrada') THEN m.monto
      WHEN m.tipo IN ('egreso', 'transferencia_salida') THEN -m.monto
      ELSE 0
    END
  ), 0) AS saldo_actual
FROM public.cuentas_financieras c
LEFT JOIN public.movimientos_caja m ON m.cuenta_id = c.id
WHERE c.activa = true
GROUP BY c.id, c.nombre, c.tipo, c.moneda, c.saldo_inicial;

-- ─── Storage de comprobantes ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finanzas-comprobantes',
  'finanzas-comprobantes',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "finanzas_comprobantes_select_authenticated" ON storage.objects;
CREATE POLICY "finanzas_comprobantes_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'finanzas-comprobantes');

DROP POLICY IF EXISTS "finanzas_comprobantes_insert_authenticated" ON storage.objects;
CREATE POLICY "finanzas_comprobantes_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finanzas-comprobantes');

DROP POLICY IF EXISTS "finanzas_comprobantes_update_authenticated" ON storage.objects;
CREATE POLICY "finanzas_comprobantes_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'finanzas-comprobantes')
  WITH CHECK (bucket_id = 'finanzas-comprobantes');

DROP POLICY IF EXISTS "finanzas_comprobantes_delete_authenticated" ON storage.objects;
CREATE POLICY "finanzas_comprobantes_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'finanzas-comprobantes');
