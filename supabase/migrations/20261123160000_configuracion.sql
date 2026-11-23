-- Configuración: datos de la empresa, cotización del dólar y administración de usuarios.

-- ─── Datos de la empresa (una sola fila) ─────────────────────────
CREATE TABLE IF NOT EXISTS configuracion_empresa (
  id                    smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  razon_social          text NOT NULL DEFAULT 'Piedra Americana',
  nombre_fantasia       text,
  cuit                  text,
  condicion_iva         text,
  direccion             text,
  localidad             text,
  telefono              text,
  email                 text,
  sitio_web             text,
  dolar_hoy             numeric(14, 2),
  dolar_actualizado_en  timestamptz,
  dolar_actualizado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO configuracion_empresa (id, razon_social, cuit)
VALUES (1, 'Piedra Americana S.A.', '30-71486236-3')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE configuracion_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracion_empresa_select_auth" ON configuracion_empresa;
DROP POLICY IF EXISTS "configuracion_empresa_write_admin" ON configuracion_empresa;

CREATE POLICY "configuracion_empresa_select_auth"
  ON configuracion_empresa FOR SELECT TO authenticated USING (true);

CREATE POLICY "configuracion_empresa_write_admin"
  ON configuracion_empresa FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ─── Usuarios: listado con mail y último ingreso (solo administradores) ───
CREATE OR REPLACE FUNCTION admin_listar_usuarios()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  es_admin boolean,
  roles text[],
  ultimo_ingreso timestamptz,
  creado timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede ver los usuarios';
  END IF;
  RETURN QUERY
  SELECT
    au.id,
    au.email::text,
    COALESCE(u.full_name, au.raw_user_meta_data ->> 'full_name'),
    COALESCE(u.role = 'admin', false),
    COALESCE(
      ARRAY(
        SELECT ur.rol::text FROM usuario_roles ur
        WHERE ur.usuario_id = au.id AND ur.activo AND ur.rol <> 'admin'
        ORDER BY ur.rol::text
      ),
      '{}'::text[]
    ),
    au.last_sign_in_at,
    au.created_at
  FROM auth.users au
  LEFT JOIN usuarios u ON u.id = au.id
  ORDER BY COALESCE(u.full_name, au.email);
END;
$$;

-- ─── Usuarios: guardar nombre, administrador y roles ───
CREATE OR REPLACE FUNCTION admin_guardar_usuario(
  p_id uuid,
  p_full_name text,
  p_es_admin boolean,
  p_roles rol_operativo[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar usuarios';
  END IF;
  IF p_id = auth.uid() AND NOT p_es_admin THEN
    RAISE EXCEPTION 'No podés quitarte a vos mismo el permiso de administrador';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN
    RAISE EXCEPTION 'Usuario inexistente';
  END IF;

  INSERT INTO usuarios (id, full_name, role)
  VALUES (p_id, NULLIF(trim(p_full_name), ''), CASE WHEN p_es_admin THEN 'admin'::profile_role ELSE 'staff'::profile_role END)
  ON CONFLICT (id) DO UPDATE
    SET full_name = NULLIF(trim(EXCLUDED.full_name), ''),
        role = EXCLUDED.role;

  -- El rol 'admin' operativo acompaña al permiso de administrador (ve todo el menú).
  DELETE FROM usuario_roles
  WHERE usuario_id = p_id
    AND NOT (rol = ANY (COALESCE(p_roles, '{}') || CASE WHEN p_es_admin THEN ARRAY['admin'::rol_operativo] ELSE '{}'::rol_operativo[] END));

  INSERT INTO usuario_roles (usuario_id, rol, activo)
  SELECT p_id, r, true
  FROM unnest(COALESCE(p_roles, '{}') || CASE WHEN p_es_admin THEN ARRAY['admin'::rol_operativo] ELSE '{}'::rol_operativo[] END) AS r
  ON CONFLICT (usuario_id, rol) DO UPDATE SET activo = true;
END;
$$;

-- ─── Usuarios: volver a mostrar la guía de uso ───
CREATE OR REPLACE FUNCTION admin_reiniciar_guia(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede reiniciar la guía';
  END IF;
  UPDATE usuarios SET guias_vistas = '{}' WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_listar_usuarios() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_guardar_usuario(uuid, text, boolean, rol_operativo[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_reiniciar_guia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_listar_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_guardar_usuario(uuid, text, boolean, rol_operativo[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reiniciar_guia(uuid) TO authenticated;
