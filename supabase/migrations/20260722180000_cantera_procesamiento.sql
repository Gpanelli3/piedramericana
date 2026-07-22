-- Procesamiento cantera: baja kg de lote bruto → alta stock_qty de productos

CREATE TABLE IF NOT EXISTS public.procesamientos_cantera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.lotes_cantera(id),
  material_bruto_id uuid NOT NULL REFERENCES public.materials(id),
  qty_kg_consumidos numeric NOT NULL CHECK (qty_kg_consumidos > 0),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procesamiento_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procesamiento_id uuid NOT NULL REFERENCES public.procesamientos_cantera(id) ON DELETE CASCADE,
  material_producto_id uuid NOT NULL REFERENCES public.materials(id),
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  unit text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procesamientos_cantera_lote_id
  ON public.procesamientos_cantera(lote_id);

CREATE INDEX IF NOT EXISTS idx_procesamientos_cantera_created_at
  ON public.procesamientos_cantera(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procesamiento_lineas_procesamiento_id
  ON public.procesamiento_lineas(procesamiento_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.procesamientos_cantera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesamiento_lineas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "procesamientos_cantera_select_auth" ON public.procesamientos_cantera;
DROP POLICY IF EXISTS "procesamientos_cantera_write_auth" ON public.procesamientos_cantera;

CREATE POLICY "procesamientos_cantera_select_auth"
  ON public.procesamientos_cantera FOR SELECT TO authenticated USING (true);

CREATE POLICY "procesamientos_cantera_write_auth"
  ON public.procesamientos_cantera FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "procesamiento_lineas_select_auth" ON public.procesamiento_lineas;
DROP POLICY IF EXISTS "procesamiento_lineas_write_auth" ON public.procesamiento_lineas;

CREATE POLICY "procesamiento_lineas_select_auth"
  ON public.procesamiento_lineas FOR SELECT TO authenticated USING (true);

CREATE POLICY "procesamiento_lineas_write_auth"
  ON public.procesamiento_lineas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── RPC ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_cantera_procesamiento(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_id uuid;
  v_qty_kg numeric;
  v_issue_date date;
  v_notes text;
  v_created_by uuid;
  v_lote record;
  v_proc_id uuid;
  v_line jsonb;
  v_producto_id uuid;
  v_cantidad numeric;
  v_unit text;
BEGIN
  v_lote_id := (p_payload->>'lote_id')::uuid;
  v_qty_kg := (p_payload->>'qty_kg_consumidos')::numeric;
  v_issue_date := COALESCE(NULLIF(p_payload->>'issue_date', '')::date, CURRENT_DATE);
  v_notes := NULLIF(trim(p_payload->>'notes'), '');
  v_created_by := NULLIF(p_payload->>'created_by', '')::uuid;

  IF v_lote_id IS NULL THEN
    RAISE EXCEPTION 'lote_id requerido';
  END IF;
  IF v_qty_kg IS NULL OR v_qty_kg <= 0 THEN
    RAISE EXCEPTION 'qty_kg_consumidos debe ser mayor a 0';
  END IF;
  IF p_payload->'lines' IS NULL OR jsonb_array_length(p_payload->'lines') = 0 THEN
    RAISE EXCEPTION 'Se requiere al menos una línea de producto';
  END IF;

  SELECT lc.*, m.bulk_stock_kg AS bulk_stock
  INTO v_lote
  FROM lotes_cantera lc
  JOIN materials m ON m.id = lc.material_id
  WHERE lc.id = v_lote_id
  FOR UPDATE OF lc, m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado';
  END IF;

  IF v_lote.qty_kg_remaining < v_qty_kg THEN
    RAISE EXCEPTION 'Kg insuficientes en el lote (restante: %)', v_lote.qty_kg_remaining;
  END IF;

  UPDATE lotes_cantera
  SET qty_kg_remaining = qty_kg_remaining - v_qty_kg
  WHERE id = v_lote_id;

  UPDATE materials
  SET bulk_stock_kg = GREATEST(bulk_stock_kg - v_qty_kg, 0)
  WHERE id = v_lote.material_id;

  INSERT INTO procesamientos_cantera (
    lote_id,
    material_bruto_id,
    qty_kg_consumidos,
    issue_date,
    notes,
    created_by
  )
  VALUES (
    v_lote_id,
    v_lote.material_id,
    v_qty_kg,
    v_issue_date,
    v_notes,
    v_created_by
  )
  RETURNING id INTO v_proc_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    v_producto_id := (v_line->>'material_producto_id')::uuid;
    v_cantidad := (v_line->>'cantidad')::numeric;

    IF v_producto_id IS NULL THEN
      RAISE EXCEPTION 'material_producto_id requerido en cada línea';
    END IF;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'cantidad debe ser mayor a 0 en cada línea';
    END IF;

    SELECT unit INTO v_unit FROM materials WHERE id = v_producto_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Material producto no encontrado: %', v_producto_id;
    END IF;

    UPDATE materials
    SET stock_qty = stock_qty + v_cantidad
    WHERE id = v_producto_id;

    INSERT INTO procesamiento_lineas (
      procesamiento_id,
      material_producto_id,
      cantidad,
      unit
    )
    VALUES (
      v_proc_id,
      v_producto_id,
      v_cantidad,
      v_unit
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_cantera_procesamiento(jsonb) TO authenticated;
