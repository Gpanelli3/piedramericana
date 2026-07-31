-- Método de pago obligatorio en movimientos; destinos = cajones por forma de pago.

-- ─── Destinos: permitir tipo cheque ─────────────────────────────
ALTER TABLE cuentas_financieras DROP CONSTRAINT IF EXISTS cuentas_financieras_tipo_check;
ALTER TABLE cuentas_financieras
  ADD CONSTRAINT cuentas_financieras_tipo_check
  CHECK (tipo IN ('caja', 'banco', 'tarjeta', 'cheque', 'otro'));

-- Renombrar destinos existentes a forma de pago
UPDATE cuentas_financieras SET nombre = 'Efectivo ARS'
WHERE tipo = 'caja' AND moneda = 'ars' AND nombre IN ('Caja ARS', 'Efectivo ARS');

UPDATE cuentas_financieras SET nombre = 'Efectivo USD'
WHERE tipo = 'caja' AND moneda = 'usd' AND nombre IN ('Caja USD', 'Efectivo USD');

UPDATE cuentas_financieras SET nombre = 'Transferencia ARS'
WHERE tipo = 'banco' AND moneda = 'ars';

UPDATE cuentas_financieras SET nombre = 'Transferencia USD'
WHERE tipo = 'banco' AND moneda = 'usd';

UPDATE cuentas_financieras SET nombre = 'Tarjeta ARS'
WHERE tipo = 'tarjeta' AND moneda = 'ars';

-- Seed Cheque si no existe
INSERT INTO cuentas_financieras (nombre, tipo, moneda, saldo_inicial)
SELECT v.nombre, v.tipo, v.moneda, 0
FROM (VALUES
  ('Cheque ARS', 'cheque', 'ars'),
  ('Cheque USD', 'cheque', 'usd')
) AS v(nombre, tipo, moneda)
WHERE NOT EXISTS (
  SELECT 1 FROM cuentas_financieras c
  WHERE c.tipo = v.tipo AND c.moneda = v.moneda
);

-- Asegurar Efectivo/Transferencia/Tarjeta existen (por si DB vacía parcial)
INSERT INTO cuentas_financieras (nombre, tipo, moneda, saldo_inicial)
SELECT v.nombre, v.tipo, v.moneda, 0
FROM (VALUES
  ('Efectivo ARS', 'caja', 'ars'),
  ('Efectivo USD', 'caja', 'usd'),
  ('Transferencia ARS', 'banco', 'ars'),
  ('Transferencia USD', 'banco', 'usd'),
  ('Tarjeta ARS', 'tarjeta', 'ars')
) AS v(nombre, tipo, moneda)
WHERE NOT EXISTS (
  SELECT 1 FROM cuentas_financieras c
  WHERE c.tipo = v.tipo AND c.moneda = v.moneda
);

-- ─── metodo en movimientos_caja ─────────────────────────────────
ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS metodo text;

UPDATE movimientos_caja m
SET metodo = CASE
  WHEN m.tipo IN ('transferencia_entrada', 'transferencia_salida') THEN 'transferencia'
  WHEN c.tipo = 'caja' THEN 'efectivo'
  WHEN c.tipo = 'banco' THEN 'transferencia'
  WHEN c.tipo = 'tarjeta' THEN 'tarjeta'
  WHEN c.tipo = 'cheque' THEN 'cheque'
  ELSE 'efectivo'
END
FROM cuentas_financieras c
WHERE m.cuenta_id = c.id AND m.metodo IS NULL;

UPDATE movimientos_caja SET metodo = 'efectivo' WHERE metodo IS NULL;

ALTER TABLE movimientos_caja
  ALTER COLUMN metodo SET DEFAULT 'efectivo';

ALTER TABLE movimientos_caja
  ALTER COLUMN metodo SET NOT NULL;

ALTER TABLE movimientos_caja
  DROP CONSTRAINT IF EXISTS movimientos_caja_metodo_check;

ALTER TABLE movimientos_caja
  ADD CONSTRAINT movimientos_caja_metodo_check
  CHECK (metodo IN ('efectivo', 'transferencia', 'cheque', 'tarjeta'));

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_metodo ON movimientos_caja (metodo);
