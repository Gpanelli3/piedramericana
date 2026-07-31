-- M09: reserva a OT, consumo, baja por rotura, retazos como chapas, auditoría.

-- Nuevo estado Baja (Usada ya existe en remoto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'inventory_slab_estado' AND e.enumlabel = 'Baja'
  ) THEN
    ALTER TYPE inventory_slab_estado ADD VALUE 'Baja';
  END IF;
END $$;

ALTER TABLE chapas_inventario
  ADD COLUMN IF NOT EXISTS motivo_estado text,
  ADD COLUMN IF NOT EXISTS chapa_origen_id uuid REFERENCES chapas_inventario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_chapas_inventario_ot_reserva
  ON chapas_inventario (ot_reserva_id)
  WHERE ot_reserva_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chapas_inventario_estado
  ON chapas_inventario (estado);

-- Auditoría de movimientos de stock
CREATE TABLE IF NOT EXISTS stock_movimientos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapa_id    uuid REFERENCES chapas_inventario(id) ON DELETE SET NULL,
  ot_id       uuid REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  tipo        text NOT NULL CHECK (tipo IN (
    'reserva', 'liberacion', 'consumo', 'baja', 'retazo_alta'
  )),
  detalle     text,
  created_by  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movimientos_ot ON stock_movimientos (ot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movimientos_chapa ON stock_movimientos (chapa_id, created_at DESC);

ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movimientos_select_auth" ON stock_movimientos;
DROP POLICY IF EXISTS "stock_movimientos_write_auth" ON stock_movimientos;

CREATE POLICY "stock_movimientos_select_auth"
  ON stock_movimientos FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_movimientos_write_auth"
  ON stock_movimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);
