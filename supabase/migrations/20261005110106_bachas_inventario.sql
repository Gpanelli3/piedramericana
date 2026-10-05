-- Stock unificado de bachas (propias y del cliente) + requisito en la OT.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bacha_origen') THEN
    CREATE TYPE public.bacha_origen AS ENUM ('propia', 'cliente');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bacha_inventario_estado') THEN
    CREATE TYPE public.bacha_inventario_estado AS ENUM ('disponible', 'asignada', 'usada', 'baja');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bachas_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen public.bacha_origen NOT NULL DEFAULT 'propia',
  cliente_nombre text,
  modelo text,
  medidas text,
  ubicacion text,
  estado public.bacha_inventario_estado NOT NULL DEFAULT 'disponible',
  ot_id uuid REFERENCES public.ordenes_trabajo (id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bachas_inventario_cliente_nombre_chk CHECK (
    origen = 'propia' OR (cliente_nombre IS NOT NULL AND length(trim(cliente_nombre)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS bachas_inventario_estado_idx ON public.bachas_inventario (estado);
CREATE INDEX IF NOT EXISTS bachas_inventario_origen_idx ON public.bachas_inventario (origen);
CREATE INDEX IF NOT EXISTS bachas_inventario_ot_id_idx ON public.bachas_inventario (ot_id);
CREATE INDEX IF NOT EXISTS bachas_inventario_created_at_idx ON public.bachas_inventario (created_at DESC);

ALTER TABLE public.bachas_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bachas_inventario_select_auth" ON public.bachas_inventario;
DROP POLICY IF EXISTS "bachas_inventario_write_auth" ON public.bachas_inventario;

CREATE POLICY "bachas_inventario_select_auth"
  ON public.bachas_inventario FOR SELECT TO authenticated USING (true);

CREATE POLICY "bachas_inventario_write_auth"
  ON public.bachas_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bachas_inventario TO authenticated;
GRANT ALL ON public.bachas_inventario TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bachas_clientes'
  ) THEN
    INSERT INTO public.bachas_inventario (
      id, origen, cliente_nombre, modelo, estado, ubicacion, ot_id, notas, created_at
    )
    SELECT
      bc.id,
      'cliente'::public.bacha_origen,
      bc.cliente_nombre,
      bc.modelo,
      CASE
        WHEN bc.estado::text = 'usada' THEN 'usada'::public.bacha_inventario_estado
        WHEN bc.ot_id IS NOT NULL THEN 'asignada'::public.bacha_inventario_estado
        ELSE 'disponible'::public.bacha_inventario_estado
      END,
      bc.ubicacion,
      bc.ot_id,
      bc.notas,
      bc.created_at
    FROM public.bachas_clientes bc
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS bacha_requerida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bacha_origen public.bacha_origen,
  ADD COLUMN IF NOT EXISTS bacha_tipo text,
  ADD COLUMN IF NOT EXISTS bacha_colocacion text,
  ADD COLUMN IF NOT EXISTS bacha_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_trabajo_bacha_id_fkey'
  ) THEN
    ALTER TABLE public.ordenes_trabajo
      ADD CONSTRAINT ordenes_trabajo_bacha_id_fkey
      FOREIGN KEY (bacha_id) REFERENCES public.bachas_inventario (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ordenes_trabajo_bacha_id_idx ON public.ordenes_trabajo (bacha_id);
CREATE INDEX IF NOT EXISTS ordenes_trabajo_bacha_requerida_idx ON public.ordenes_trabajo (bacha_requerida)
  WHERE bacha_requerida = true;

UPDATE public.ordenes_trabajo ot
SET bacha_id = b.id
FROM public.bachas_inventario b
WHERE b.ot_id = ot.id
  AND ot.bacha_id IS NULL;

DROP TABLE IF EXISTS public.bachas_clientes;

DROP TYPE IF EXISTS public.bacha_cliente_estado;
