-- Compat: renombra tablas en inglés a español si existían antes de la migración cantera nueva.
-- Crea chapas_inventario si falta el stock de planchas; define create_remito_with_slabs contra chapas_inventario.

DO $$
BEGIN
  IF to_regclass('public.inventory_lotes') IS NOT NULL AND to_regclass('public.lotes_cantera') IS NULL THEN
    DROP TRIGGER IF EXISTS trg_inventory_lotes_bulk_after_insert ON public.inventory_lotes;
    ALTER TABLE public.inventory_lotes RENAME TO lotes_cantera;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.lotes_cantera') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_inventory_lotes_bulk_after_insert ON public.lotes_cantera';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_lotes_cantera_al_insertar ON public.lotes_cantera';
    EXECUTE $t$
CREATE TRIGGER trg_lotes_cantera_al_insertar
  AFTER INSERT ON public.lotes_cantera
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_lotes_cantera_sumar_stock_kg()
$t$;
    EXECUTE 'ALTER TABLE public.lotes_cantera ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "lotes_cantera_acceso_app" ON public.lotes_cantera';
    EXECUTE $p$
CREATE POLICY "lotes_cantera_acceso_app"
  ON public.lotes_cantera FOR ALL
  USING (true) WITH CHECK (true)
$p$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.material_conversions') IS NOT NULL
     AND to_regclass('public.conversiones_materiales') IS NULL THEN
    ALTER TABLE public.material_conversions RENAME TO conversiones_materiales;
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE public.inventory_slab_estado AS ENUM ('Disponible', 'Reservada');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.inventory_slabs') IS NOT NULL AND to_regclass('public.chapas_inventario') IS NULL THEN
    ALTER TABLE public.inventory_slabs RENAME TO chapas_inventario;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.chapas_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remito_line_id uuid REFERENCES public.remito_lines(id) ON DELETE SET NULL,
  bulto text NOT NULL UNIQUE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_label text NOT NULL,
  largo_cm double precision NOT NULL,
  ancho_cm double precision NOT NULL,
  estado public.inventory_slab_estado NOT NULL DEFAULT 'Disponible'::public.inventory_slab_estado,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chapas_inventario_material_label ON public.chapas_inventario(material_label);
CREATE INDEX IF NOT EXISTS idx_chapas_inventario_estado ON public.chapas_inventario(estado);
CREATE INDEX IF NOT EXISTS idx_chapas_inventario_remito_line_id ON public.chapas_inventario(remito_line_id);

DO $$
BEGIN
  IF to_regclass('public.conversiones_materiales') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.conversiones_materiales ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "conversiones_materiales_acceso_app" ON public.conversiones_materiales';
    EXECUTE $p$
CREATE POLICY "conversiones_materiales_acceso_app"
  ON public.conversiones_materiales FOR ALL
  USING (true) WITH CHECK (true)
$p$;
  END IF;
END $$;

ALTER TABLE public.chapas_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_slabs_all_anon_authenticated" ON public.chapas_inventario;
DROP POLICY IF EXISTS "inventory_slabs_acceso_app" ON public.chapas_inventario;
DROP POLICY IF EXISTS "chapas_inventario_acceso_app" ON public.chapas_inventario;
CREATE POLICY "chapas_inventario_acceso_app"
  ON public.chapas_inventario FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.register_cantera_ingreso(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line jsonb;
  qty_kg numeric;
  uom text;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'lines', '[]'::jsonb))
  LOOP
    uom := COALESCE(line->>'purchase_uom', 'KG');
    qty_kg := CASE upper(uom)
      WHEN 'T' THEN (line->>'quantity')::numeric * 1000
      ELSE (line->>'quantity')::numeric
    END;

    IF qty_kg IS NULL OR qty_kg <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en línea de ingreso';
    END IF;

    INSERT INTO public.lotes_cantera (
      material_id,
      qty_kg_remaining,
      qty_kg_initial,
      purchase_uom,
      supplier_id,
      receipt_ref,
      notes,
      issue_date,
      largo_cm,
      ancho_cm,
      espesor_cm,
      created_by
    ) VALUES (
      (line->>'material_id')::uuid,
      qty_kg,
      qty_kg,
      upper(uom),
      CASE WHEN COALESCE(trim(line->>'supplier_id'), '') = '' THEN NULL ELSE (line->>'supplier_id')::uuid END,
      CASE WHEN trim(COALESCE(line->>'receipt_ref', '')) = '' THEN NULL ELSE trim(line->>'receipt_ref') END,
      CASE WHEN trim(COALESCE(line->>'notes', '')) = '' THEN NULL ELSE trim(line->>'notes') END,
      COALESCE(NULLIF(trim(line->>'issue_date'), '')::date, CURRENT_DATE),
      NULLIF(line->>'largo_cm','')::double precision,
      NULLIF(line->>'ancho_cm','')::double precision,
      NULLIF(line->>'espesor_cm','')::double precision,
      CASE WHEN COALESCE(trim(line->>'created_by'), '') = '' THEN NULL ELSE (line->>'created_by')::uuid END
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_cantera_ingreso(jsonb) TO anon, authenticated, service_role;

-- REPLACE no puede cambiar el tipo de retorno (p. ej. uuid → text).
DROP FUNCTION IF EXISTS public.create_remito_with_slabs(jsonb);

CREATE OR REPLACE FUNCTION public.create_remito_with_slabs(p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remito_id uuid;
  line jsonb;
  v_line_idx int := 0;
  v_line_id uuid;
  v_qty int;
  v_ini bigint;
  v_i int;
  v_mid uuid;
  v_label text;
  v_largo double precision;
  v_ancho double precision;
  v_sort_ord int;
  v_precio double precision;
  v_b text;
BEGIN
  IF p_payload IS NULL OR jsonb_array_length(COALESCE(p_payload->'lines', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'El remito debe tener al menos una línea';
  END IF;

  INSERT INTO public.remitos (
    supplier_id,
    branch_code,
    serial_code,
    issue_date,
    notes,
    created_by
  ) VALUES (
    (p_payload->>'supplier_id')::uuid,
    COALESCE(trim(COALESCE(p_payload->>'branch_code', '')), ''),
    trim(COALESCE(p_payload->>'serial_code', '')),
    CASE
      WHEN NULLIF(trim(p_payload->>'issue_date'), '') IS NULL THEN CURRENT_DATE
      ELSE trim(p_payload->>'issue_date')::date
    END,
    CASE WHEN trim(COALESCE(p_payload->>'notes', '')) = '' THEN NULL ELSE trim(p_payload->>'notes') END,
    CASE WHEN trim(COALESCE(p_payload->>'created_by', '')) = '' THEN NULL ELSE trim(p_payload->>'created_by')::uuid END
  )
  RETURNING id INTO v_remito_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    v_line_idx := v_line_idx + 1;

    v_qty := CASE
      WHEN jsonb_typeof(line->'qty_slabs') = 'number'
        THEN (line->>'qty_slabs')::int
      ELSE trim(line->>'qty_slabs')::int
    END;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad de chapas inválida';
    END IF;

    IF NULLIF(trim(COALESCE(line->>'material_label', '')), '') IS NULL THEN
      RAISE EXCEPTION 'material_label obligatorio por línea';
    END IF;

    v_ini := CASE
      WHEN jsonb_typeof(line->'bulto_numero_inicio') = 'number' THEN floor((line->'bulto_numero_inicio')::numeric)::bigint
      WHEN line->>'bulto_numero_inicio' IS NOT NULL AND trim(line->>'bulto_numero_inicio') <> ''
        THEN trim(line->>'bulto_numero_inicio')::bigint
      ELSE NULL::bigint
    END;

    IF v_ini IS NULL OR v_ini < 1 THEN
      RAISE EXCEPTION 'bulto_numero_inicio inválido por línea';
    END IF;

    v_mid := CASE
      WHEN line->>'material_id' IS NULL OR trim(COALESCE(line->>'material_id', '')) = '' THEN NULL
      ELSE (line->>'material_id')::uuid
    END;
    v_label := trim(line->>'material_label');
    v_largo := CASE
      WHEN jsonb_typeof(line->'largo_cm') = 'number'
        THEN (line->>'largo_cm')::double precision
      ELSE trim(line->>'largo_cm')::double precision
    END;
    v_ancho := CASE
      WHEN jsonb_typeof(line->'ancho_cm') = 'number'
        THEN (line->>'ancho_cm')::double precision
      ELSE trim(line->>'ancho_cm')::double precision
    END;
    IF v_largo IS NULL OR v_largo <= 0 OR v_ancho IS NULL OR v_ancho <= 0 THEN
      RAISE EXCEPTION 'Medidas de chapa inválidas';
    END IF;

    v_sort_ord := CASE
      WHEN jsonb_typeof(line->'sort_order') = 'number' THEN (line->>'sort_order')::int
      WHEN line->>'sort_order' IS NOT NULL AND trim(line->>'sort_order') <> '' THEN trim(line->>'sort_order')::int
      ELSE v_line_idx
    END;

    v_precio := NULL;
    IF line ? 'precio_unitario'
       AND jsonb_typeof(line->'precio_unitario') <> 'null' THEN
      IF jsonb_typeof(line->'precio_unitario') = 'number' THEN
        v_precio := (line->'precio_unitario')::text::double precision;
      ELSIF jsonb_typeof(line->'precio_unitario') = 'string' AND trim(line->>'precio_unitario') <> '' THEN
        v_precio := trim(line->>'precio_unitario')::double precision;
      END IF;
    END IF;

    INSERT INTO public.remito_lines (
      remito_id,
      material_id,
      material_label,
      qty_slabs,
      largo_cm,
      ancho_cm,
      precio_unitario,
      sort_order
    ) VALUES (
      v_remito_id,
      v_mid,
      v_label,
      v_qty,
      v_largo,
      v_ancho,
      v_precio,
      v_sort_ord
    )
    RETURNING id INTO v_line_id;

    FOR v_i IN 0..(v_qty - 1) LOOP
      v_b := '#' || (v_ini + v_i)::text;
      INSERT INTO public.chapas_inventario (
        remito_line_id,
        bulto,
        material_id,
        material_label,
        largo_cm,
        ancho_cm,
        estado
      ) VALUES (
        v_line_id,
        v_b,
        v_mid,
        v_label,
        v_largo,
        v_ancho,
        'Disponible'::public.inventory_slab_estado
      );
    END LOOP;
  END LOOP;

  RETURN v_remito_id::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_remito_with_slabs(jsonb) TO anon, authenticated, service_role;
