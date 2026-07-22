-- ============================================================
-- 1) Maestro de clientes (faltaba en la DB remota)
-- 2) Fix RLS recursivo en `usuarios` (política FOR ALL que
--    consultaba `usuarios` → "infinite recursion detected")
-- ============================================================

-- ─── Helper: is_admin() sin pasar por RLS ────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ─── Fix políticas recursivas ────────────────────────────────
DROP POLICY IF EXISTS "usuarios_write_admin" ON public.usuarios;
CREATE POLICY "usuarios_write_admin"
  ON public.usuarios
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "usuario_roles_write_admin" ON public.usuario_roles;
CREATE POLICY "usuario_roles_write_admin"
  ON public.usuario_roles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── Tabla clients ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_name_idx ON public.clients (lower(name));

COMMENT ON TABLE public.clients IS 'Clientes de la marmolería (maestro para presupuestos / OT)';
COMMENT ON COLUMN public.clients.contact_name IS 'Persona de contacto (opcional)';

-- FK opcional desde OT (columna ya existía sin constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_trabajo_id_cliente_fkey'
  ) THEN
    ALTER TABLE public.ordenes_trabajo
      ADD CONSTRAINT ordenes_trabajo_id_cliente_fkey
      FOREIGN KEY (id_cliente) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- client_id en presupuestos (además del texto denormalizado)
ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS presupuestos_client_id_idx ON public.presupuestos (client_id);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_auth" ON public.clients;
DROP POLICY IF EXISTS "clients_write_auth" ON public.clients;

CREATE POLICY "clients_select_auth"
  ON public.clients FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clients_write_auth"
  ON public.clients FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
