-- Plan de corte: sobrante previsto en stock y snapshot en la OT.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'inventory_slab_estado' AND e.enumlabel = 'Prevista'
  ) THEN
    ALTER TYPE public.inventory_slab_estado ADD VALUE 'Prevista';
  END IF;
END $$;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS plan_corte jsonb;

CREATE INDEX IF NOT EXISTS chapas_inventario_origen_idx
  ON public.chapas_inventario (chapa_origen_id)
  WHERE chapa_origen_id IS NOT NULL;
