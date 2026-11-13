-- Agregar soporte de espesor_cm a la función create_remito_with_slabs

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
  v_espesor numeric;
  v_bulto_inicio integer;
  v_precio numeric;
  v_lote_codigo text;
  v_line_origen origen_placa;
  v_sort integer;
  v_i integer;
  v_bulto text;
  v_modo modo_medidas_remito;
  v_medidas jsonb;
  v_medida jsonb;
  v_line_largo numeric;
  v_line_ancho numeric;
  v_m2_total numeric;
  v_chapa_largo numeric;
  v_chapa_ancho numeric;
  v_chapa_espesor numeric;
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
    v_bulto_inicio := COALESCE((v_line->>'bulto_numero_inicio')::int, 0);
    v_precio := NULLIF(v_line->>'precio_unitario', '')::numeric;
    v_lote_codigo := trim(COALESCE(v_line->>'lote_codigo', ''));
    v_line_origen := COALESCE(NULLIF(v_line->>'origen_placa', '')::origen_placa, v_origen);
    v_sort := COALESCE((v_line->>'sort_order')::int, 0);
    v_modo := COALESCE(
      NULLIF(v_line->>'modo_medidas', '')::modo_medidas_remito,
      'iguales'::modo_medidas_remito
    );
    v_medidas := v_line->'medidas';
    v_espesor := NULLIF(v_line->>'espesor_cm', '')::numeric;

    IF v_material_label = '' THEN
      RAISE EXCEPTION 'material_label requerido en cada línea';
    END IF;
    IF v_lote_codigo = '' THEN
      RAISE EXCEPTION 'lote_codigo es obligatorio en cada línea de remito';
    END IF;
    IF v_qty < 1 THEN
      RAISE EXCEPTION 'qty_slabs debe ser >= 1';
    END IF;
    IF v_bulto_inicio < 1 THEN
      RAISE EXCEPTION 'bulto_numero_inicio debe ser >= 1';
    END IF;

    v_m2_total := 0;
    v_line_largo := NULL;
    v_line_ancho := NULL;

    IF v_modo = 'iguales' THEN
      v_largo := COALESCE((v_line->>'largo_cm')::numeric, 0);
      v_ancho := COALESCE((v_line->>'ancho_cm')::numeric, 0);
      IF v_largo <= 0 OR v_ancho <= 0 THEN
        RAISE EXCEPTION 'largo_cm y ancho_cm deben ser > 0 en modo iguales';
      END IF;
      v_line_largo := v_largo;
      v_line_ancho := v_ancho;
      v_m2_total := (v_largo / 100.0) * (v_ancho / 100.0) * v_qty;
    ELSE
      IF v_medidas IS NULL OR jsonb_typeof(v_medidas) <> 'array' THEN
        RAISE EXCEPTION 'medidas[] requerido en modo distintas';
      END IF;
      IF jsonb_array_length(v_medidas) <> v_qty THEN
        RAISE EXCEPTION 'medidas[] debe tener la misma cantidad que qty_slabs';
      END IF;
      FOR v_i IN 0..(v_qty - 1) LOOP
        v_medida := v_medidas->v_i;
        v_chapa_largo := COALESCE((v_medida->>'largo_cm')::numeric, 0);
        v_chapa_ancho := COALESCE((v_medida->>'ancho_cm')::numeric, 0);
        IF v_chapa_largo <= 0 OR v_chapa_ancho <= 0 THEN
          RAISE EXCEPTION 'Cada medida en modo distintas debe tener largo_cm y ancho_cm > 0';
        END IF;
        v_m2_total := v_m2_total + (v_chapa_largo / 100.0) * (v_chapa_ancho / 100.0);
      END LOOP;
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
      origen_placa,
      modo_medidas,
      m2_total
    )
    VALUES (
      v_remito_id,
      v_material_id,
      v_material_label,
      v_qty,
      v_line_largo,
      v_line_ancho,
      v_precio,
      v_lote_codigo,
      v_sort,
      v_line_origen,
      v_modo,
      v_m2_total
    )
    RETURNING id INTO v_line_id;

    FOR v_i IN 0..(v_qty - 1) LOOP
      v_bulto := '#' || (v_bulto_inicio + v_i)::text;
      IF v_modo = 'iguales' THEN
        v_chapa_largo := v_line_largo;
        v_chapa_ancho := v_line_ancho;
        v_chapa_espesor := v_espesor;
      ELSE
        v_medida := v_medidas->v_i;
        v_chapa_largo := (v_medida->>'largo_cm')::numeric;
        v_chapa_ancho := (v_medida->>'ancho_cm')::numeric;
        v_chapa_espesor := NULLIF(v_medida->>'espesor_cm', '')::numeric;
      END IF;

      INSERT INTO chapas_inventario (
        remito_line_id,
        bulto,
        material_id,
        material_label,
        largo_cm,
        ancho_cm,
        espesor_cm,
        lote_codigo,
        estado,
        origen_placa
      )
      VALUES (
        v_line_id,
        v_bulto,
        v_material_id,
        v_material_label,
        v_chapa_largo,
        v_chapa_ancho,
        v_chapa_espesor,
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
