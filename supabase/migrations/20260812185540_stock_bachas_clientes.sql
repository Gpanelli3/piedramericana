-- M10 (mínimo): bachas de clientes

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bacha_cliente_estado') THEN
    CREATE TYPE public.bacha_cliente_estado AS ENUM ('pendiente', 'en_taller', 'usada');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bachas_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nombre text NOT NULL,
  modelo text,
  estado public.bacha_cliente_estado NOT NULL DEFAULT 'pendiente',
  ubicacion text,
  ot_id uuid REFERENCES public.ordenes_trabajo (id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bachas_clientes_estado_idx ON public.bachas_clientes (estado);
CREATE INDEX IF NOT EXISTS bachas_clientes_created_at_idx ON public.bachas_clientes (created_at DESC);

ALTER TABLE public.bachas_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bachas_clientes_select_auth" ON public.bachas_clientes;
DROP POLICY IF EXISTS "bachas_clientes_write_auth" ON public.bachas_clientes;

CREATE POLICY "bachas_clientes_select_auth"
  ON public.bachas_clientes FOR SELECT TO authenticated USING (true);

CREATE POLICY "bachas_clientes_write_auth"
  ON public.bachas_clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bachas_clientes TO authenticated;
GRANT ALL ON public.bachas_clientes TO service_role;
