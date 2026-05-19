import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { RolOperativo } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";

export type { RolOperativo };

/**
 * Devuelve los roles operativos del usuario autenticado.
 * Llama a la función RPC `mis_roles()` en Supabase.
 *
 * - Si Supabase no está configurado o el usuario no está autenticado, devuelve [].
 * - Los usuarios con role='admin' reciben todos los roles implícitamente via la función RPC.
 */
export function useRol() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RolOperativo[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargarRoles = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setRoles([]);
      return;
    }
    setCargando(true);
    try {
      const { data, error } = await supabase.rpc("mis_roles");
      if (error) {
        console.warn("[useRol] Error cargando roles:", error.message);
        setRoles([]);
      } else {
        setRoles((data ?? []).map((r: { rol: RolOperativo }) => r.rol));
      }
    } catch {
      setRoles([]);
    } finally {
      setCargando(false);
    }
  }, [user]);

  useEffect(() => {
    void cargarRoles();
  }, [cargarRoles]);

  /** Verifica si el usuario tiene un rol específico. */
  const tieneRol = useCallback(
    (rol: RolOperativo): boolean => roles.includes(rol),
    [roles],
  );

  /** Verifica si el usuario tiene al menos uno de los roles pasados. */
  const tieneAlgunRol = useCallback(
    (...rolesRequeridos: RolOperativo[]): boolean =>
      rolesRequeridos.some((r) => roles.includes(r)),
    [roles],
  );

  const esAdmin = tieneRol("admin");

  return { roles, cargando, tieneRol, tieneAlgunRol, esAdmin };
}
