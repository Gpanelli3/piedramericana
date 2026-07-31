-- M09 huecos: lote obligatorio, origen de placa, flag reserva pendiente en OT, RPC remito con origen.

-- ─── Origen de placa ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'origen_placa') THEN
    CREATE TYPE origen_placa AS ENUM ('nacional', 'importado', 'cantera', 'otro');
  END IF;
END $$;

ALTER TABLE remitos
  ADD COLUMN IF NOT EXISTS origen_placa origen_placa NOT NULL DEFAULT 'nacional';

ALTER TABLE remito_lines
  ADD COLUMN IF NOT EXISTS origen_placa origen_placa NOT NULL DEFAULT 'nacional';

ALTER TABLE chapas_inventario
  ADD COLUMN IF NOT EXISTS origen_placa origen_placa NOT NULL DEFAULT 'nacional';

-- ─── OT: reserva de stock pendiente ────────────────────────────
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS requiere_reserva_stock boolean NOT NULL DEFAULT false;

-- ─── Lote obligatorio en NUEVOS ingresos (no rompe filas viejas sin lote) ───
-- Trigger en remito_lines: exige lote no vacío
CREATE OR REPLACE FUNCTION public.enforce_lote_codigo_remito_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lote_codigo IS NULL OR length(trim(NEW.lote_codigo)) = 0 THEN
    RAISE EXCEPTION 'lote_codigo es obligatorio en cada línea de remito';
  END IF;
  NEW.lote_codigo := trim(NEW.lote_codigo);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lote_remito_line ON remito_lines;
CREATE TRIGGER trg_enforce_lote_remito_line
  BEFORE INSERT ON remito_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_codigo_remito_line();

-- Trigger en chapas: exige lote solo si viene de remito (remito_line_id not null)
CREATE OR REPLACE FUNCTION public.enforce_lote_codigo_chapa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.remito_line_id IS NOT NULL THEN
    IF NEW.lote_codigo IS NULL OR length(trim(NEW.lote_codigo)) = 0 THEN
      RAISE EXCEPTION 'lote_codigo es obligatorio para chapas de remito';
    END IF;
    NEW.lote_codigo := trim(NEW.lote_codigo);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lote_chapa ON chapas_inventario;
CREATE TRIGGER trg_enforce_lote_chapa
  BEFORE INSERT ON chapas_inventario
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_codigo_chapa();

-- ─── RPC create_remito_with_slabs con origen + lote obligatorio ─
CREATE OR REPLACE FUNCTION public.create_remito_with_slabs(p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid;
  v_branch_code text;
  v_serial_code text;
  v_issue_date date;
  v_notes text;
  v_created_by uuid;
  v_origen origen_placa;
  v_remito_id uuid;
  v_line jsonb;
  v_line_id uuid;
  v_material_id uuid;
  v_material_label text;
  v_qty integer;
  v_largo numeric;
  v_ancho numeric;
  v_bulto_inicio integer;
  v_precio numeric;
  v_lote_codigo text;
  v_line_origen origen_placa;
  v_sort integer;
  v_i integer;
  v_bulto text;
BEGIN
  v_supplier_id := NULLIF(p_payload->>'supplier_id', '')::uuid;
  v_branch_code := COALESCE(trim(p_payload->>'branch_code'), '');
  v_serial_code := COALESCE(trim(p_payload->>'serial_code'), '');
  v_issue_date := NULLIF(p_payload->>'issue_date', '')::date;
  v_notes := NULLIF(left(trim(COALESCE(p_payload->>'notes', '')), 200), '');
  v_created_by := NULLIF(p_payload->>'created_by', '')::uuid;
  v_origen := COALESCE(NULLIF(p_payload->>'origen_placa', '')::origen_placa, 'nacional');

  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'supplier_id requerido';
  END IF;
  IF v_issue_date IS NULL THEN
    RAISE EXCEPTION 'issue_date requerido';
  END IF;
  IF p_payload->'lines' IS NULL OR jsonb_array_length(p_payload->'lines') = 0 THEN
    RAISE EXCEPTION 'Se requiere al menos una línea de remito';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = v_supplier_id) THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  INSERT INTO remitos (
    supplier_id,
    branch_code,
    serial_code,
    issue_date,
    notes,
    created_by,
    origen_placa
  )
  VALUES (
    v_supplier_id,
    v_branch_code,
    v_serial_code,
    v_issue_date,
    v_notes,
    v_created_by,
    v_origen
  )
  RETURNING id INTO v_remito_id;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(p_payload->'lines')
    ORDER BY COALESCE((value->>'sort_order')::int, 0)
  LOOP
    v_material_id := NULLIF(v_line->>'material_id', '')::uuid;
    v_material_label := trim(COALESCE(v_line->>'material_label', ''));
    v_qty := COALESCE((v_line->>'qty_slabs')::int, 0);
    v_largo := COALESCE((v_line->>'largo_cm')::numeric, 0);
    v_ancho := COALESCE((v_line->>'ancho_cm')::numeric, 0);
    v_bulto_inicio := COALESCE((v_line->>'bulto_numero_inicio')::int, 0);
    v_precio := NULLIF(v_line->>'precio_unitario', '')::numeric;
    v_lote_codigo := trim(COALESCE(v_line->>'lote_codigo', ''));
    v_line_origen := COALESCE(NULLIF(v_line->>'origen_placa', '')::origen_placa, v_origen);
    v_sort := COALESCE((v_line->>'sort_order')::int, 0);

    IF v_material_label = '' THEN
      RAISE EXCEPTION 'material_label requerido en cada línea';
    END IF;
    IF v_lote_codigo = '' THEN
      RAISE EXCEPTION 'lote_codigo es obligatorio en cada línea de remito';
    END IF;
    IF v_qty < 1 THEN
      RAISE EXCEPTION 'qty_slabs debe ser >= 1';
    END IF;
    IF v_largo <= 0 OR v_ancho <= 0 THEN
      RAISE EXCEPTION 'largo_cm y ancho_cm deben ser > 0';
    END IF;
    IF v_bulto_inicio < 1 THEN
      RAISE EXCEPTION 'bulto_numero_inicio debe ser >= 1';
    END IF;

    FOR v_i IN 0..(v_qty - 1) LOOP
      v_bulto := '#' || (v_bulto_inicio + v_i)::text;
      IF EXISTS (SELECT 1 FROM chapas_inventario WHERE lower(bulto) = lower(v_bulto)) THEN
        RAISE EXCEPTION 'El bulto % ya existe', v_bulto;
      END IF;
    END LOOP;

    INSERT INTO remito_lines (
      remito_id,
      material_id,
      material_label,
      qty_slabs,
      largo_cm,
      ancho_cm,
      precio_unitario,
      lote_codigo,
      sort_order,
      origen_placa
    )
    VALUES (
      v_remito_id,
      v_material_id,
      v_material_label,
      v_qty,
      v_largo,
      v_ancho,
      v_precio,
      v_lote_codigo,
      v_sort,
      v_line_origen
    )
    RETURNING id INTO v_line_id;

    FOR v_i IN 0..(v_qty - 1) LOOP
      v_bulto := '#' || (v_bulto_inicio + v_i)::text;
      INSERT INTO chapas_inventario (
        remito_line_id,
        bulto,
        material_id,
        material_label,
        largo_cm,
        ancho_cm,
        lote_codigo,
        estado,
        origen_placa
      )
      VALUES (
        v_line_id,
        v_bulto,
        v_material_id,
        v_material_label,
        v_largo,
        v_ancho,
        v_lote_codigo,
        'Disponible',
        v_line_origen
      );
    END LOOP;
  END LOOP;

  RETURN v_remito_id::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_remito_with_slabs(jsonb) TO authenticated;
