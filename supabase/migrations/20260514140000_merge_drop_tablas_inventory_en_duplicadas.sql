-- Si coexisten tablas EN y ES por orden de aplicación de migraciones
-- (p. ej. se crearon lotes_cantera/conversiones_materiales y nunca se renombró
-- porque la tabla española ya existía), se copian filas pendientes y se eliminan
-- las tablas en inglés.

-- Lotes: mismas columnas que inventory_lotes / lotes_cantera
DO $$
BEGIN
  IF to_regclass('public.inventory_lotes') IS NOT NULL
     AND to_regclass('public.lotes_cantera') IS NOT NULL THEN
    INSERT INTO public.lotes_cantera (
      id,
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
      created_by,
      created_at
    )
    SELECT
      il.id,
      il.material_id,
      il.qty_kg_remaining,
      il.qty_kg_initial,
      il.purchase_uom,
      il.supplier_id,
      il.receipt_ref,
      il.notes,
      il.issue_date,
      il.largo_cm,
      il.ancho_cm,
      il.espesor_cm,
      il.created_by,
      il.created_at
    FROM public.inventory_lotes il
    WHERE NOT EXISTS (SELECT 1 FROM public.lotes_cantera lc WHERE lc.id = il.id)
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE public.inventory_lotes;
  END IF;
END $$;

-- Conversiones: evitar mismo par padre/hijo ya presente en la tabla española
DO $$
BEGIN
  IF to_regclass('public.material_conversions') IS NOT NULL
     AND to_regclass('public.conversiones_materiales') IS NOT NULL THEN
    INSERT INTO public.conversiones_materiales (
      id,
      parent_material_id,
      child_material_id,
      kg_parent_per_m2_child,
      notes,
      created_at
    )
    SELECT
      mc.id,
      mc.parent_material_id,
      mc.child_material_id,
      mc.kg_parent_per_m2_child,
      mc.notes,
      mc.created_at
    FROM public.material_conversions mc
    WHERE NOT EXISTS (SELECT 1 FROM public.conversiones_materiales cm WHERE cm.id = mc.id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversiones_materiales cm
        WHERE cm.parent_material_id = mc.parent_material_id
          AND cm.child_material_id = mc.child_material_id
      )
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE public.material_conversions;
  END IF;
END $$;
