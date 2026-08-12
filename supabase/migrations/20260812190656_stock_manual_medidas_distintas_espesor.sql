-- Carga manual: medidas distintas + espesor por plancha

ALTER TABLE public.chapas_inventario
  ADD COLUMN IF NOT EXISTS espesor_cm numeric;

COMMENT ON COLUMN public.chapas_inventario.espesor_cm IS 'Espesor de la plancha en cm (artesanal / medidas distintas)';

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
  v_medidas jsonb;
  v_medida jsonb;
  v_modo text;
  v_chapa_largo numeric;
  v_chapa_ancho numeric;
  v_chapa_esp numeric;
  v_esp_mat numeric;
BEGIN
  v_material_id := NULLIF(p_payload->>'material_id', '')::uuid;
  v_material_label := trim(COALESCE(p_payload->>'material_label', ''));
  v_lote_codigo := NULLIF(trim(COALESCE(p_payload->>'lote_codigo', '')), '');
  v_costo_usd := NULLIF(p_payload->>'costo_usd', '')::numeric;
  v_created_by := NULLIF(p_payload->>'created_by', '')::uuid;
  v_notes := NULLIF(left(trim(COALESCE(p_payload->>'notes', '')), 200), '');
  v_modo := COALESCE(NULLIF(trim(p_payload->>'modo_medidas'), ''), 'iguales');
  v_medidas := p_payload->'medidas';

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

  IF v_modo = 'distintas' THEN
    IF v_medidas IS NULL OR jsonb_typeof(v_medidas) <> 'array' OR jsonb_array_length(v_medidas) < 1 THEN
      RAISE EXCEPTION 'medidas: se requiere al menos una placa';
    END IF;
    IF jsonb_array_length(v_medidas) > 500 THEN
      RAISE EXCEPTION 'medidas: máximo 500 placas';
    END IF;

    -- Espesor del maestro: primer placa con espesor > 0 (si hay)
    SELECT NULLIF((value->>'espesor_cm')::numeric, 0)
    INTO v_esp_mat
    FROM jsonb_array_elements(v_medidas) AS t(value)
    WHERE COALESCE((value->>'espesor_cm')::numeric, 0) > 0
    LIMIT 1;

    IF v_material_id IS NOT NULL THEN
      UPDATE public.materials
      SET
        espesor_mm = CASE
          WHEN v_esp_mat IS NOT NULL AND v_esp_mat > 0 THEN v_esp_mat * 10
          ELSE espesor_mm
        END,
        costo_usd = CASE
          WHEN v_costo_usd IS NOT NULL AND v_costo_usd >= 0 THEN v_costo_usd
          ELSE costo_usd
        END
      WHERE id = v_material_id;
    END IF;

    v_seq := to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');
    v_i := 0;

    FOR v_medida IN SELECT value FROM jsonb_array_elements(v_medidas)
    LOOP
      v_i := v_i + 1;
      v_chapa_largo := COALESCE((v_medida->>'largo_cm')::numeric, 0);
      v_chapa_ancho := COALESCE((v_medida->>'ancho_cm')::numeric, 0);
      v_chapa_esp := NULLIF((v_medida->>'espesor_cm')::numeric, 0);

      IF v_chapa_largo <= 0 OR v_chapa_ancho <= 0 THEN
        RAISE EXCEPTION 'medidas[%]: largo_cm y ancho_cm deben ser > 0', v_i;
      END IF;

      v_bulto := 'MAN-' || v_seq || '-' || lpad(v_i::text, 3, '0');

      INSERT INTO public.chapas_inventario (
        remito_line_id,
        bulto,
        material_id,
        material_label,
        largo_cm,
        ancho_cm,
        espesor_cm,
        estado,
        lote_codigo,
        origen_placa,
        motivo_estado
      ) VALUES (
        NULL,
        v_bulto,
        v_material_id,
        v_material_label,
        v_chapa_largo,
        v_chapa_ancho,
        v_chapa_esp,
        'Disponible',
        v_lote_codigo,
        v_origen,
        CASE WHEN v_notes IS NOT NULL THEN left('Carga manual: ' || v_notes, 200) ELSE 'Carga manual' END
      );

      v_inserted := v_inserted + 1;
    END LOOP;

    RETURN v_inserted;
  END IF;

  -- Modo iguales (default)
  v_qty := COALESCE((p_payload->>'qty_slabs')::int, 0);
  v_largo_cm := COALESCE((p_payload->>'largo_cm')::numeric, 0);
  v_ancho_cm := COALESCE((p_payload->>'ancho_cm')::numeric, 0);
  v_espesor_cm := NULLIF(p_payload->>'espesor_cm', '')::numeric;

  IF v_qty IS NULL OR v_qty < 1 OR v_qty > 500 THEN
    RAISE EXCEPTION 'qty_slabs debe ser entre 1 y 500';
  END IF;

  IF v_largo_cm IS NULL OR v_largo_cm <= 0 OR v_ancho_cm IS NULL OR v_ancho_cm <= 0 THEN
    RAISE EXCEPTION 'largo_cm y ancho_cm deben ser > 0';
  END IF;

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
      espesor_cm,
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
      CASE WHEN v_espesor_cm IS NOT NULL AND v_espesor_cm > 0 THEN v_espesor_cm ELSE NULL END,
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
