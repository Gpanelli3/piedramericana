-- Stock unitario (productos de cantera) reservable / consumible por OT.
-- No mezcla adoquines con chapas: baja materials.stock_qty al reservar.

CREATE TABLE IF NOT EXISTS public.ot_stock_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_id uuid NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id),
  qty_reservada numeric NOT NULL DEFAULT 0 CHECK (qty_reservada >= 0),
  qty_consumida numeric NOT NULL DEFAULT 0 CHECK (qty_consumida >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ot_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_ot_stock_unidades_ot
  ON public.ot_stock_unidades (ot_id);

CREATE INDEX IF NOT EXISTS idx_ot_stock_unidades_material_reservada
  ON public.ot_stock_unidades (material_id)
  WHERE qty_reservada > 0;

ALTER TABLE public.ot_stock_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ot_stock_unidades_select_auth" ON public.ot_stock_unidades;
DROP POLICY IF EXISTS "ot_stock_unidades_write_auth" ON public.ot_stock_unidades;

CREATE POLICY "ot_stock_unidades_select_auth"
  ON public.ot_stock_unidades FOR SELECT TO authenticated USING (true);

CREATE POLICY "ot_stock_unidades_write_auth"
  ON public.ot_stock_unidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Reservar ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservar_ot_stock_unidades(
  p_ot_id uuid,
  p_material_id uuid,
  p_qty numeric,
  p_created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mat record;
  v_row public.ot_stock_unidades%ROWTYPE;
  v_detalle text;
BEGIN
  IF p_ot_id IS NULL THEN
    RAISE EXCEPTION 'ot_id requerido';
  END IF;
  IF p_material_id IS NULL THEN
    RAISE EXCEPTION 'material_id requerido';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad a reservar debe ser mayor a 0';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM ordenes_trabajo WHERE id = p_ot_id) THEN
    RAISE EXCEPTION 'OT no encontrada';
  END IF;

  SELECT id, name, unit, stock_qty
  INTO v_mat
  FROM materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF COALESCE(v_mat.stock_qty, 0) < p_qty THEN
    RAISE EXCEPTION 'Stock insuficiente de % (disponible: % %)',
      v_mat.name, COALESCE(v_mat.stock_qty, 0), COALESCE(v_mat.unit, 'u.');
  END IF;

  UPDATE materials
  SET stock_qty = stock_qty - p_qty
  WHERE id = p_material_id;

  SELECT * INTO v_row
  FROM ot_stock_unidades
  WHERE ot_id = p_ot_id AND material_id = p_material_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE ot_stock_unidades
    SET qty_reservada = qty_reservada + p_qty,
        updated_at = now()
    WHERE id = v_row.id;
  ELSE
    INSERT INTO ot_stock_unidades (ot_id, material_id, qty_reservada, qty_consumida)
    VALUES (p_ot_id, p_material_id, p_qty, 0);
  END IF;

  v_detalle := format(
    '%s: %s %s',
    v_mat.name,
    trim(trailing '.' from trim(trailing '0' from p_qty::text)),
    COALESCE(NULLIF(v_mat.unit, ''), 'u.')
  );

  INSERT INTO stock_movimientos (chapa_id, ot_id, tipo, detalle, created_by)
  VALUES (NULL, p_ot_id, 'reserva', v_detalle, p_created_by);

  UPDATE ordenes_trabajo
  SET requiere_reserva_stock = false,
      actualizado_en = now()
  WHERE id = p_ot_id;
END;
$$;

-- ─── Consumir ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consumir_ot_stock_unidades(
  p_ot_id uuid,
  p_material_id uuid,
  p_qty numeric DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ot_stock_unidades%ROWTYPE;
  v_qty numeric;
  v_name text;
  v_unit text;
  v_detalle text;
BEGIN
  IF p_ot_id IS NULL OR p_material_id IS NULL THEN
    RAISE EXCEPTION 'ot_id y material_id requeridos';
  END IF;

  SELECT * INTO v_row
  FROM ot_stock_unidades
  WHERE ot_id = p_ot_id AND material_id = p_material_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.qty_reservada <= 0 THEN
    RAISE EXCEPTION 'No hay unidades reservadas de este producto en la OT';
  END IF;

  v_qty := COALESCE(p_qty, v_row.qty_reservada);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad a consumir debe ser mayor a 0';
  END IF;
  IF v_qty > v_row.qty_reservada THEN
    RAISE EXCEPTION 'No se puede consumir más de lo reservado (%)', v_row.qty_reservada;
  END IF;

  UPDATE ot_stock_unidades
  SET qty_reservada = qty_reservada - v_qty,
      qty_consumida = qty_consumida + v_qty,
      updated_at = now()
  WHERE id = v_row.id;

  SELECT name, unit INTO v_name, v_unit FROM materials WHERE id = p_material_id;

  v_detalle := format(
    '%s: %s %s',
    COALESCE(v_name, 'Producto'),
    trim(trailing '.' from trim(trailing '0' from v_qty::text)),
    COALESCE(NULLIF(v_unit, ''), 'u.')
  );

  INSERT INTO stock_movimientos (chapa_id, ot_id, tipo, detalle, created_by)
  VALUES (NULL, p_ot_id, 'consumo', v_detalle, p_created_by);
END;
$$;

-- ─── Liberar ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.liberar_ot_stock_unidades(
  p_ot_id uuid,
  p_material_id uuid,
  p_qty numeric DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ot_stock_unidades%ROWTYPE;
  v_qty numeric;
  v_name text;
  v_unit text;
  v_detalle text;
BEGIN
  IF p_ot_id IS NULL OR p_material_id IS NULL THEN
    RAISE EXCEPTION 'ot_id y material_id requeridos';
  END IF;

  SELECT * INTO v_row
  FROM ot_stock_unidades
  WHERE ot_id = p_ot_id AND material_id = p_material_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.qty_reservada <= 0 THEN
    RAISE EXCEPTION 'No hay unidades reservadas de este producto en la OT';
  END IF;

  v_qty := COALESCE(p_qty, v_row.qty_reservada);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad a liberar debe ser mayor a 0';
  END IF;
  IF v_qty > v_row.qty_reservada THEN
    RAISE EXCEPTION 'No se puede liberar más de lo reservado (%)', v_row.qty_reservada;
  END IF;

  PERFORM 1 FROM materials WHERE id = p_material_id FOR UPDATE;

  UPDATE materials
  SET stock_qty = stock_qty + v_qty
  WHERE id = p_material_id;

  UPDATE ot_stock_unidades
  SET qty_reservada = qty_reservada - v_qty,
      updated_at = now()
  WHERE id = v_row.id;

  DELETE FROM ot_stock_unidades
  WHERE id = v_row.id
    AND qty_reservada = 0
    AND qty_consumida = 0;

  SELECT name, unit INTO v_name, v_unit FROM materials WHERE id = p_material_id;

  v_detalle := format(
    '%s: %s %s',
    COALESCE(v_name, 'Producto'),
    trim(trailing '.' from trim(trailing '0' from v_qty::text)),
    COALESCE(NULLIF(v_unit, ''), 'u.')
  );

  INSERT INTO stock_movimientos (chapa_id, ot_id, tipo, detalle, created_by)
  VALUES (NULL, p_ot_id, 'liberacion', v_detalle, p_created_by);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reservar_ot_stock_unidades(uuid, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_ot_stock_unidades(uuid, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_ot_stock_unidades(uuid, uuid, numeric, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reservar_ot_stock_unidades(uuid, uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumir_ot_stock_unidades(uuid, uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.liberar_ot_stock_unidades(uuid, uuid, numeric, uuid) FROM PUBLIC;
