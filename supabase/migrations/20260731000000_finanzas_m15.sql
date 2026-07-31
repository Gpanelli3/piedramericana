-- M15 liviano: cuentas financieras, movimientos de caja, cierres y vínculo con cobros.

-- ─── Cuentas (caja / banco / tarjeta) ─────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_financieras (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('caja', 'banco', 'tarjeta', 'otro')),
  moneda        text NOT NULL CHECK (moneda IN ('ars', 'usd')),
  saldo_inicial numeric NOT NULL DEFAULT 0,
  activa        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_financieras_activa ON cuentas_financieras (activa);

-- ─── Movimientos de caja ──────────────────────────────────────
-- En remoto puede existir un esquema legacy (sin cuenta_id). Está vacío: reemplazamos.
DROP TABLE IF EXISTS movimientos_caja CASCADE;

CREATE TABLE movimientos_caja (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id             uuid NOT NULL REFERENCES cuentas_financieras(id) ON DELETE RESTRICT,
  tipo                  text NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'transferencia_entrada', 'transferencia_salida')),
  monto                 numeric NOT NULL CHECK (monto > 0),
  moneda                text NOT NULL CHECK (moneda IN ('ars', 'usd')),
  fecha                 date NOT NULL,
  descripcion           text,
  referencia_tipo       text,
  referencia_id         uuid,
  cuenta_contraparte_id uuid REFERENCES cuentas_financieras(id) ON DELETE SET NULL,
  transferencia_grupo_id uuid,
  created_by            uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_cuenta_fecha ON movimientos_caja (cuenta_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_fecha ON movimientos_caja (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_referencia ON movimientos_caja (referencia_tipo, referencia_id);

-- ─── Cierres de caja diarios ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cierres_caja (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha            date NOT NULL,
  cuenta_id        uuid NOT NULL REFERENCES cuentas_financieras(id) ON DELETE RESTRICT,
  saldo_calculado  numeric NOT NULL,
  saldo_arqueo     numeric,
  notas            text,
  cerrado_por      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha, cuenta_id)
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_fecha ON cierres_caja (fecha DESC);

-- ─── Vínculo cobro → cuenta ─────────────────────────────────────
ALTER TABLE ventas_pagos
  ADD COLUMN IF NOT EXISTS cuenta_id uuid REFERENCES cuentas_financieras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_pagos_cuenta ON ventas_pagos (cuenta_id);

-- ─── RLS ────────────────────────────────────────────────────────
ALTER TABLE cuentas_financieras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cuentas_financieras_select_auth" ON cuentas_financieras;
DROP POLICY IF EXISTS "cuentas_financieras_write_auth" ON cuentas_financieras;
CREATE POLICY "cuentas_financieras_select_auth"
  ON cuentas_financieras FOR SELECT TO authenticated USING (true);
CREATE POLICY "cuentas_financieras_write_auth"
  ON cuentas_financieras FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cierres_caja_select_auth" ON cierres_caja;
DROP POLICY IF EXISTS "cierres_caja_write_auth" ON cierres_caja;
CREATE POLICY "cierres_caja_select_auth"
  ON cierres_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "cierres_caja_write_auth"
  ON cierres_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- movimientos_caja RLS (recrear tras DROP)
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movimientos_caja_select_auth" ON movimientos_caja;
DROP POLICY IF EXISTS "movimientos_caja_write_auth" ON movimientos_caja;

CREATE POLICY "movimientos_caja_select_auth"
  ON movimientos_caja FOR SELECT TO authenticated USING (true);

CREATE POLICY "movimientos_caja_write_auth"
  ON movimientos_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Cuentas iniciales ──────────────────────────────────────────
INSERT INTO cuentas_financieras (nombre, tipo, moneda, saldo_inicial)
SELECT v.nombre, v.tipo, v.moneda, 0
FROM (VALUES
  ('Caja ARS', 'caja', 'ars'),
  ('Caja USD', 'caja', 'usd'),
  ('Banco ARS', 'banco', 'ars'),
  ('Banco USD', 'banco', 'usd'),
  ('Tarjeta / POS ARS', 'tarjeta', 'ars')
) AS v(nombre, tipo, moneda)
WHERE NOT EXISTS (SELECT 1 FROM cuentas_financieras LIMIT 1);

-- ─── Saldo calculado por cuenta (vista) ─────────────────────────
CREATE OR REPLACE VIEW v_saldos_cuentas AS
SELECT
  c.id AS cuenta_id,
  c.nombre,
  c.tipo,
  c.moneda,
  c.saldo_inicial,
  COALESCE(SUM(
    CASE
      WHEN m.tipo IN ('ingreso', 'transferencia_entrada') THEN m.monto
      WHEN m.tipo IN ('egreso', 'transferencia_salida') THEN -m.monto
      ELSE 0
    END
  ), 0) AS movimientos_neto,
  c.saldo_inicial + COALESCE(SUM(
    CASE
      WHEN m.tipo IN ('ingreso', 'transferencia_entrada') THEN m.monto
      WHEN m.tipo IN ('egreso', 'transferencia_salida') THEN -m.monto
      ELSE 0
    END
  ), 0) AS saldo_actual
FROM cuentas_financieras c
LEFT JOIN movimientos_caja m ON m.cuenta_id = c.id
WHERE c.activa = true
GROUP BY c.id, c.nombre, c.tipo, c.moneda, c.saldo_inicial;
