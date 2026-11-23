-- Pagos de una liquidación: una fila por fecha y monto entregado.
-- El saldo se calcula como total_neto - suma(pagos). Reemplaza en la UI a los
-- tramos pago_efectivo_15 / pago_banco_30 / pago_efectivo_30 (columnas que se conservan).

CREATE TABLE IF NOT EXISTS liquidacion_pagos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id uuid NOT NULL REFERENCES liquidaciones(id) ON DELETE CASCADE,
  fecha          date NOT NULL,
  monto          numeric(14, 2) NOT NULL CHECK (monto > 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS liquidacion_pagos_liquidacion_idx
  ON liquidacion_pagos (liquidacion_id);

ALTER TABLE liquidacion_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liquidacion_pagos_select_auth" ON liquidacion_pagos;
DROP POLICY IF EXISTS "liquidacion_pagos_write_auth"  ON liquidacion_pagos;

CREATE POLICY "liquidacion_pagos_select_auth"
  ON liquidacion_pagos FOR SELECT TO authenticated USING (true);

CREATE POLICY "liquidacion_pagos_write_auth"
  ON liquidacion_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);
