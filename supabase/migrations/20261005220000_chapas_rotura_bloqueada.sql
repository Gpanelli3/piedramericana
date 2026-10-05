-- Pedazos bloqueados por rotura (chapa o pieza). No se dan de baja al registrar.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'inventory_slab_estado' AND e.enumlabel = 'Bloqueada'
  ) THEN
    ALTER TYPE public.inventory_slab_estado ADD VALUE 'Bloqueada';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rotura_tipo') THEN
    CREATE TYPE public.rotura_tipo AS ENUM ('chapa', 'pieza');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rotura_momento') THEN
    CREATE TYPE public.rotura_momento AS ENUM ('corte', 'instalacion', 'viaje', 'otro');
  END IF;
END $$;

ALTER TABLE public.chapas_inventario
  ADD COLUMN IF NOT EXISTS rotura_tipo public.rotura_tipo,
  ADD COLUMN IF NOT EXISTS rotura_momento public.rotura_momento,
  ADD COLUMN IF NOT EXISTS ot_rotura_id uuid REFERENCES public.ordenes_trabajo (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_rotura text;

CREATE INDEX IF NOT EXISTS chapas_inventario_ot_rotura_idx
  ON public.chapas_inventario (ot_rotura_id)
  WHERE ot_rotura_id IS NOT NULL;

ALTER TABLE public.stock_movimientos DROP CONSTRAINT IF EXISTS stock_movimientos_tipo_check;
ALTER TABLE public.stock_movimientos
  ADD CONSTRAINT stock_movimientos_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'reserva'::text,
    'liberacion'::text,
    'consumo'::text,
    'baja'::text,
    'retazo_alta'::text,
    'bloqueo'::text
  ]));
