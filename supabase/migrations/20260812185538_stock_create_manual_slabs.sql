-- M09.F6: alta de planchas sin remito (carga manual)

CREATE OR REPLACE FUNCTION public.create_manual_slabs(p_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_id uuid;
  v_material_label text;
  v_qty integer;
  v_largo_cm numeric;
  v_ancho_cm numeric;
  v_espesor_cm numeric;
  v_lote_codigo text;
  v_costo_usd numeric;
  v_origen origen_placa;
  v_created_by uuid;
  v_notes text;
  v_i integer;
  v_bulto text;
  v_seq text;
  v_inserted integer := 0;
BEGIN
  v_material_id := NULLIF(p_payload->>'material_id', '')::uuid;
  v_material_label := trim(COALESCE(p_payload->>'material_label', ''));
  v_qty := COALESCE((p_payload->>'qty_slabs')::int, 0);
  v_largo_cm := COALESCE((p_payload->>'largo_cm')::numeric, 0);
  v_ancho_cm := COALESCE((p_payload->>'ancho_cm')::numeric, 0);
  v_espesor_cm := NULLIF(p_payload->>'espesor_cm', '')::numeric;
  v_lote_codigo := NULLIF(trim(COALESCE(p_payload->>'lote_codigo', '')), '');
  v_costo_usd := NULLIF(p_payload->>'costo_usd', '')::numeric;
  v_created_by := NULLIF(p_payload->>'created_by', '')::uuid;
  v_notes := NULLIF(left(trim(COALESCE(p_payload->>'notes', '')), 200), '');

  BEGIN
    v_origen := COALESCE(NULLIF(p_payload->>'origen_placa', '')::origen_placa, 'otro');
  EXCEPTION WHEN others THEN
    v_origen := 'otro';
  END;

  IF v_created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_created_by) THEN
    v_created_by := NULL;
  END IF;

  IF v_material_id IS NULL AND v_material_label = '' THEN
    RAISE EXCEPTION 'material_id o material_label requerido';
  END IF;

  IF v_material_id IS NOT NULL THEN
    SELECT name INTO v_material_label
    FROM public.materials
    WHERE id = v_material_id;
    IF v_material_label IS NULL THEN
      RAISE EXCEPTION 'Material no encontrado';
    END IF;
  END IF;

  IF v_qty IS NULL OR v_qty < 1 OR v_qty > 500 THEN
    RAISE EXCEPTION 'qty_slabs debe ser entre 1 y 500';
  END IF;

  IF v_largo_cm IS NULL OR v_largo_cm <= 0 OR v_ancho_cm IS NULL OR v_ancho_cm <= 0 THEN
    RAISE EXCEPTION 'largo_cm y ancho_cm deben ser > 0';
  END IF;

  -- Actualizar maestro (espesor / costo) si corresponde
  IF v_material_id IS NOT NULL THEN
    UPDATE public.materials
    SET
      espesor_mm = CASE
        WHEN v_espesor_cm IS NOT NULL AND v_espesor_cm > 0 THEN v_espesor_cm * 10
        ELSE espesor_mm
      END,
      costo_usd = CASE
        WHEN v_costo_usd IS NOT NULL AND v_costo_usd >= 0 THEN v_costo_usd
        ELSE costo_usd
      END
    WHERE id = v_material_id;
  END IF;

  v_seq := to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');

  FOR v_i IN 1..v_qty LOOP
    v_bulto := 'MAN-' || v_seq || '-' || lpad(v_i::text, 3, '0');

    INSERT INTO public.chapas_inventario (
      remito_line_id,
      bulto,
      material_id,
      material_label,
      largo_cm,
      ancho_cm,
      estado,
      lote_codigo,
      origen_placa,
      motivo_estado
    ) VALUES (
      NULL,
      v_bulto,
      v_material_id,
      v_material_label,
      v_largo_cm,
      v_ancho_cm,
      'Disponible',
      v_lote_codigo,
      v_origen,
      CASE WHEN v_notes IS NOT NULL THEN left('Carga manual: ' || v_notes, 200) ELSE 'Carga manual' END
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_slabs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_manual_slabs(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_slabs(jsonb) TO service_role;
