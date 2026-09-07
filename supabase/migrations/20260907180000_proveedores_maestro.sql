-- M14 — Maestro de proveedores: campos nuevos + supplier_id en movimientos_caja

-- ─── suppliers: rubros, origen, pais, contact_name, notes, activo ───
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS rubros text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'nacional',
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE suppliers
    ADD CONSTRAINT suppliers_origen_check CHECK (origen IN ('nacional', 'exterior', 'propio'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppliers_activo ON suppliers (activo);
CREATE INDEX IF NOT EXISTS idx_suppliers_rubros ON suppliers USING gin (rubros);

-- ─── movimientos_caja: vincular egreso a proveedor ──────────
ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_supplier ON movimientos_caja (supplier_id, fecha DESC);
