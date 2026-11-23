-- Configuración → Usuarios: el administrador crea cuentas (mail + contraseña), cambia contraseñas
-- y activa/desactiva el acceso sin pasar por la pantalla de ingreso.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- El listado ahora informa si la cuenta está activa (no bloqueada).
DROP FUNCTION IF EXISTS admin_listar_usuarios();
CREATE FUNCTION admin_listar_usuarios()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  es_admin boolean,
  roles text[],
  ultimo_ingreso timestamptz,
  creado timestamptz,
  activo boolean
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
    au.created_at,
    (au.banned_until IS NULL OR au.banned_until < now())
  FROM auth.users au
  LEFT JOIN usuarios u ON u.id = au.id
  ORDER BY COALESCE(u.full_name, au.email);
END;
$$;

-- Crear una cuenta nueva con mail confirmado.
CREATE OR REPLACE FUNCTION admin_crear_usuario(
  p_email text,
  p_password text,
  p_full_name text,
  p_es_admin boolean,
  p_roles rol_operativo[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede crear usuarios';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'El mail no es válido';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña tiene que tener al menos 6 caracteres';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe una cuenta con ese mail';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', NULLIF(trim(p_full_name), '')),
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', v_id::text, now(), now(), now()
  );

  PERFORM admin_guardar_usuario(v_id, p_full_name, p_es_admin, p_roles);
  RETURN v_id;
END;
$$;

-- Cambiar la contraseña de una cuenta.
CREATE OR REPLACE FUNCTION admin_cambiar_password(p_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar contraseñas';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña tiene que tener al menos 6 caracteres';
  END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario inexistente';
  END IF;
END;
$$;

-- Bloquear / reactivar el acceso de una cuenta (no borra su historial).
CREATE OR REPLACE FUNCTION admin_set_usuario_activo(p_id uuid, p_activo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el acceso';
  END IF;
  IF p_id = auth.uid() AND NOT p_activo THEN
    RAISE EXCEPTION 'No podés desactivar tu propia cuenta';
  END IF;
  UPDATE auth.users
  SET banned_until = CASE WHEN p_activo THEN NULL ELSE 'infinity'::timestamptz END,
      updated_at = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario inexistente';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION admin_listar_usuarios() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_crear_usuario(text, text, text, boolean, rol_operativo[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_cambiar_password(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_set_usuario_activo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_listar_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_crear_usuario(text, text, text, boolean, rol_operativo[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_cambiar_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_usuario_activo(uuid, boolean) TO authenticated;
