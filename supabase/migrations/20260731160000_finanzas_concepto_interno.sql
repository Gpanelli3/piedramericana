-- Libro interno: clasificar ingresos/egresos sin conectar bancos.
ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS concepto text;

UPDATE movimientos_caja
SET concepto = CASE
  WHEN referencia_tipo = 'venta_pago' THEN 'trabajo'
  WHEN referencia_tipo = 'transferencia' THEN 'transferencia'
  WHEN tipo IN ('transferencia_entrada', 'transferencia_salida') THEN 'transferencia'
  ELSE 'otro'
END
WHERE concepto IS NULL;

ALTER TABLE movimientos_caja
  ALTER COLUMN concepto SET DEFAULT 'otro';

ALTER TABLE movimientos_caja
  DROP CONSTRAINT IF EXISTS movimientos_caja_concepto_check;

ALTER TABLE movimientos_caja
  ADD CONSTRAINT movimientos_caja_concepto_check
  CHECK (concepto IN ('trabajo', 'insumos', 'gastos', 'sueldos', 'otro', 'transferencia'));

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_concepto
  ON movimientos_caja (concepto);
