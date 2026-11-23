import { useEffect, useSyncExternalStore } from "react";
import type { Database, RolOperativo } from "@/types/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/* ─── Datos de la empresa y cotización ─────────────────────────────────── */

export type ConfiguracionEmpresa = Database["public"]["Tables"]["configuracion_empresa"]["Row"];

export const EMPRESA_POR_DEFECTO: ConfiguracionEmpresa = {
  id: 1,
  razon_social: "Piedra Americana",
  nombre_fantasia: null,
  cuit: null,
  condicion_iva: null,
  direccion: null,
  localidad: null,
  telefono: null,
  email: null,
  sitio_web: null,
  dolar_hoy: null,
  dolar_actualizado_en: null,
  dolar_actualizado_por: null,
  updated_at: new Date(0).toISOString(),
};

/** Cotización que usa un presupuesto nuevo si todavía no se cargó la del día. */
export const DOLAR_SIN_CARGAR = 1250.5;

let empresa: ConfiguracionEmpresa = EMPRESA_POR_DEFECTO;
let cargada = false;
let enCurso: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((fn) => fn());
}

function normalizar(row: ConfiguracionEmpresa): ConfiguracionEmpresa {
  return { ...row, dolar_hoy: row.dolar_hoy == null ? null : Number(row.dolar_hoy) };
}

/** Lee la configuración una vez y la deja en memoria para documentos y presupuestos. */
export function cargarConfiguracionEmpresa(forzar = false): Promise<void> {
  if (!isSupabaseConfigured) return Promise.resolve();
  if (cargada && !forzar) return Promise.resolve();
  if (enCurso && !forzar) return enCurso;
  enCurso = (async () => {
    const { data } = await supabase.from("configuracion_empresa").select("*").eq("id", 1).maybeSingle();
    if (data) {
      empresa = normalizar(data as ConfiguracionEmpresa);
      avisar();
    }
    cargada = true;
    enCurso = null;
  })();
  return enCurso;
}

export function getConfiguracionEmpresa(): ConfiguracionEmpresa {
  return empresa;
}

export function useConfiguracionEmpresa(): ConfiguracionEmpresa {
  useEffect(() => {
    void cargarConfiguracionEmpresa();
  }, []);
  return useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    () => empresa,
    () => empresa,
  );
}

export type EmpresaInput = Pick<
  ConfiguracionEmpresa,
  | "razon_social"
  | "nombre_fantasia"
  | "cuit"
  | "condicion_iva"
  | "direccion"
  | "localidad"
  | "telefono"
  | "email"
  | "sitio_web"
>;

function limpio(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

export async function guardarDatosEmpresa(input: EmpresaInput): Promise<{ error: Error | null }> {
  const razon = (input.razon_social ?? "").trim();
  if (!razon) return { error: new Error("La razón social no puede quedar vacía") };
  const { data, error } = await supabase
    .from("configuracion_empresa")
    .update({
      razon_social: razon,
      nombre_fantasia: limpio(input.nombre_fantasia),
      cuit: limpio(input.cuit),
      condicion_iva: limpio(input.condicion_iva),
      direccion: limpio(input.direccion),
      localidad: limpio(input.localidad),
      telefono: limpio(input.telefono),
      email: limpio(input.email),
      sitio_web: limpio(input.sitio_web),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("*")
    .maybeSingle();
  if (error) return { error: new Error(error.message) };
  if (!data) return { error: new Error("No tenés permiso para cambiar los datos de la empresa") };
  empresa = normalizar(data as ConfiguracionEmpresa);
  avisar();
  return { error: null };
}

export async function guardarDolarHoy(
  valor: number,
  usuarioId: string | null,
): Promise<{ error: Error | null }> {
  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: new Error("La cotización tiene que ser mayor a 0") };
  }
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("configuracion_empresa")
    .update({
      dolar_hoy: valor,
      dolar_actualizado_en: ahora,
      dolar_actualizado_por: usuarioId,
      updated_at: ahora,
    })
    .eq("id", 1)
    .select("*")
    .maybeSingle();
  if (error) return { error: new Error(error.message) };
  if (!data) return { error: new Error("No tenés permiso para cambiar la cotización") };
  empresa = normalizar(data as ConfiguracionEmpresa);
  avisar();
  return { error: null };
}

/* ─── Usuarios y permisos ──────────────────────────────────────────────── */

export type UsuarioAdmin = Database["public"]["Functions"]["admin_listar_usuarios"]["Returns"][number];

/** Roles que se asignan desde Configuración (el de administrador va aparte). */
export const ROLES_ASIGNABLES: { value: Exclude<RolOperativo, "admin">; label: string; ayuda: string }[] = [
  // "ayuda" = módulos del menú que habilita cada rol (ver NAV_ITEMS en app-sidebar).
  { value: "vendedor", label: "Vendedor", ayuda: "Planificación, Presupuestos, Clientes, Ventas, Medición y Stock" },
  { value: "medidor", label: "Medidor", ayuda: "Planificación, Medición y Órdenes de Trabajo" },
  { value: "cortador", label: "Cortador", ayuda: "Órdenes de Trabajo" },
  { value: "produccion", label: "Producción", ayuda: "Planificación, Órdenes de Trabajo y Stock" },
  { value: "instalador", label: "Instalador", ayuda: "Planificación" },
  { value: "reparador", label: "Reparador", ayuda: "Solo el Dashboard, por ahora" },
  {
    value: "administracion",
    label: "Administración",
    ayuda: "Todo menos Órdenes de Trabajo y Configuración",
  },
];

/** Administrador = usuarios.role 'admin' (el mismo criterio que usan los permisos de la base). */
export async function soyAdministrador(userId: string): Promise<boolean> {
  const { data } = await supabase.from("usuarios").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

export async function listarUsuarios(): Promise<{ data: UsuarioAdmin[]; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_listar_usuarios");
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as UsuarioAdmin[], error: null };
}

export async function guardarUsuario(opts: {
  id: string;
  fullName: string;
  esAdmin: boolean;
  roles: RolOperativo[];
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_guardar_usuario", {
    p_id: opts.id,
    p_full_name: opts.fullName,
    p_es_admin: opts.esAdmin,
    p_roles: opts.roles,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function crearUsuario(opts: {
  email: string;
  password: string;
  fullName: string;
  esAdmin: boolean;
  roles: RolOperativo[];
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_crear_usuario", {
    p_email: opts.email,
    p_password: opts.password,
    p_full_name: opts.fullName,
    p_es_admin: opts.esAdmin,
    p_roles: opts.roles,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function cambiarPasswordUsuario(id: string, password: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_cambiar_password", { p_id: id, p_password: password });
  return { error: error ? new Error(error.message) : null };
}

export async function setUsuarioActivo(id: string, activo: boolean): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_set_usuario_activo", { p_id: id, p_activo: activo });
  return { error: error ? new Error(error.message) : null };
}

export async function reiniciarGuiaUsuario(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_reiniciar_guia", { p_id: id });
  return { error: error ? new Error(error.message) : null };
}
