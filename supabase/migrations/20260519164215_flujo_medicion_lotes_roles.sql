-- ============================================================
-- Migración: Fase 1 — Items 3, 4 y 5
--   3. Flujo de medición (estado intermedio en_medicion)
--   4. Registro de lotes en stock
--   5. Roles granulares de usuario
-- ============================================================

-- ─── ÍTEM 3: Flujo de medición ───────────────────────────────
-- Agrega "en_medicion" al enum venta_estado entre "senado" y "en_produccion".
-- Postgres no permite modificar enums directamente con ALTER TYPE ADD VALUE
-- en posición específica, pero sí al final. Como el orden no es crítico
-- (manejamos el flujo en código), lo agregamos al final del enum.

ALTER TYPE venta_estado ADD VALUE IF NOT EXISTS 'en_medicion';

-- Columna de fecha de confirmación de medidas en ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS fecha_confirmacion_medidas timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notas_medicion text DEFAULT NULL;

-- Columna en ordenes_trabajo para vincular con el proceso de medición
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS medidas_confirmadas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_medidas_confirmadas timestamptz DEFAULT NULL;

-- ─── ÍTEM 4: Lotes en stock ───────────────────────────────────
-- Campo lote_codigo en remito_lines y chapas_inventario.
-- Regla: chapas del mismo lote deben usarse juntas (mismo veteado/color).

ALTER TABLE remito_lines
  ADD COLUMN IF NOT EXISTS lote_codigo text DEFAULT NULL;

COMMENT ON COLUMN remito_lines.lote_codigo IS
  'Código de lote del proveedor. Chapas del mismo lote tienen el mismo veteado/color.';

ALTER TABLE chapas_inventario
  ADD COLUMN IF NOT EXISTS lote_codigo text DEFAULT NULL;

COMMENT ON COLUMN chapas_inventario.lote_codigo IS
  'Código de lote. No mezclar chapas de lotes distintos en la misma OT.';

-- Índice para búsqueda por lote
CREATE INDEX IF NOT EXISTS chapas_inventario_lote ON chapas_inventario (lote_codigo)
  WHERE lote_codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS remito_lines_lote ON remito_lines (lote_codigo)
  WHERE lote_codigo IS NOT NULL;

-- ─── ÍTEM 5: Roles granulares de usuario ─────────────────────
-- Amplía el sistema de roles con roles operativos que pueden coexistir
-- con el rol base (admin/staff/sales) en la tabla usuarios.
-- Usamos una tabla de roles adicionales para no romper el enum existente.

CREATE TYPE rol_operativo AS ENUM (
  'vendedor',
  'medidor',
  'cortador',
  'produccion',
  'instalador',
  'reparador',
  'administracion',
  'admin'
);

-- Tabla de roles adicionales por usuario (uno puede tener varios)
CREATE TABLE IF NOT EXISTS usuario_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol        rol_operativo NOT NULL,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, rol)
);

CREATE INDEX IF NOT EXISTS usuario_roles_usuario ON usuario_roles (usuario_id) WHERE activo = true;

-- RLS para usuario_roles
ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;

-- Los usuarios autenticados pueden leer todos los roles (necesario para navegación condicional)
CREATE POLICY "usuario_roles_select_auth"
  ON usuario_roles FOR SELECT
  TO authenticated
  USING (true);

-- Solo admin puede gestionar roles
CREATE POLICY "usuario_roles_write_admin"
  ON usuario_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  );

-- Función helper: ¿tiene el usuario autenticado un rol operativo dado?
CREATE OR REPLACE FUNCTION tiene_rol(p_rol rol_operativo)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_roles
    WHERE usuario_id = auth.uid()
      AND rol = p_rol
      AND activo = true
  )
  OR EXISTS (
    -- Los admin tienen todos los roles implícitamente
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Función: devuelve todos los roles del usuario autenticado
CREATE OR REPLACE FUNCTION mis_roles()
RETURNS TABLE (rol rol_operativo)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Si es admin, devuelve todos los roles
  SELECT unnest(enum_range(NULL::rol_operativo)) AS rol
  WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')

  UNION ALL

  -- Roles asignados explícitamente (solo si NO es admin para no duplicar)
  SELECT ur.rol FROM usuario_roles ur
  WHERE ur.usuario_id = auth.uid()
    AND ur.activo = true
    AND NOT EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin');
$$;

-- Seed: asignar rol 'admin' a todos los usuarios que ya tienen role='admin'
INSERT INTO usuario_roles (usuario_id, rol)
SELECT id, 'admin'::rol_operativo
FROM usuarios
WHERE role = 'admin'
ON CONFLICT (usuario_id, rol) DO NOTHING;

-- Asignar rol 'vendedor' a los que tienen role='sales'
INSERT INTO usuario_roles (usuario_id, rol)
SELECT id, 'vendedor'::rol_operativo
FROM usuarios
WHERE role = 'sales'
ON CONFLICT (usuario_id, rol) DO NOTHING;
