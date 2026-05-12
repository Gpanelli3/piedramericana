-- Piedra desde cantera: categoría material, peso/m², lotes a granel, conversiones BOM, RPC ingreso.
-- Nombres de tablas en español: lotes_cantera, conversiones_materiales.
-- Las planchas importadas siguen en la tabla existente chapas_inventario (renombrada desde inventory_slabs en migración compat).

DO $$ BEGIN
  CREATE TYPE public.material_kind AS ENUM ('marmol', 'otra_piedra', 'agglomerado_otro');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS material_kind public.material_kind NOT NULL DEFAULT 'marmol';

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS peso_por_m2_kg double precision;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS espesor_mm double precision;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS bulk_stock_kg double precision NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.materials.peso_por_m2_kg IS 'Kg por m² (estimación presupuesto / ton equiv).';
COMMENT ON COLUMN public.materials.bulk_stock_kg IS 'Stock a granel (kg) sumado al ingresar lotes de cantera.';

CREATE TABLE IF NOT EXISTS public.lotes_cantera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  qty_kg_remaining double precision NOT NULL CHECK (qty_kg_remaining >= 0),
  qty_kg_initial double precision NOT NULL CHECK (qty_kg_initial > 0),
  purchase_uom text NOT NULL DEFAULT 'KG' CHECK (purchase_uom IN ('KG', 'T', 'ML', 'M2')),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  receipt_ref text,
  notes text,
  issue_date date NOT NULL DEFAULT (CURRENT_DATE),
  largo_cm double precision,
  ancho_cm double precision,
  espesor_cm double precision,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotes_cantera_material_id ON public.lotes_cantera(material_id);
CREATE INDEX IF NOT EXISTS idx_lotes_cantera_issue_date ON public.lotes_cantera(issue_date DESC);

CREATE TABLE IF NOT EXISTS public.conversiones_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  child_material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  kg_parent_per_m2_child double precision NOT NULL CHECK (kg_parent_per_m2_child > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_material_id, child_material_id)
);

CREATE INDEX IF NOT EXISTS idx_conversiones_materiales_padre ON public.conversiones_materiales(parent_material_id);

CREATE OR REPLACE FUNCTION public.trg_lotes_cantera_sumar_stock_kg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.materials
  SET bulk_stock_kg = COALESCE(bulk_stock_kg, 0) + NEW.qty_kg_initial
  WHERE id = NEW.material_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lotes_cantera_al_insertar ON public.lotes_cantera;
CREATE TRIGGER trg_lotes_cantera_al_insertar
  AFTER INSERT ON public.lotes_cantera
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_lotes_cantera_sumar_stock_kg();

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

ALTER TABLE public.lotes_cantera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversiones_materiales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_cantera_acceso_app" ON public.lotes_cantera;
CREATE POLICY "lotes_cantera_acceso_app"
  ON public.lotes_cantera FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "conversiones_materiales_acceso_app" ON public.conversiones_materiales;
CREATE POLICY "conversiones_materiales_acceso_app"
  ON public.conversiones_materiales FOR ALL
  USING (true) WITH CHECK (true);
