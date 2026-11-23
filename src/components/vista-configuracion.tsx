"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, DollarSign, Pencil, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  DOLAR_SIN_CARGAR,
  ROLES_ASIGNABLES,
  guardarDatosEmpresa,
  guardarDolarHoy,
  cambiarPasswordUsuario,
  crearUsuario,
  guardarUsuario,
  listarUsuarios,
  setUsuarioActivo,
  reiniciarGuiaUsuario,
  soyAdministrador,
  useConfiguracionEmpresa,
  type EmpresaInput,
  type UsuarioAdmin,
} from "@/lib/configuracion-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { RolOperativo } from "@/types/database";

function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function fmtPesos(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const etiquetaRol = (r: string) => ROLES_ASIGNABLES.find((x) => x.value === r)?.label ?? r;

export function VistaConfiguracion() {
  const { user } = useAuth();
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setEsAdmin(false);
      return;
    }
    void soyAdministrador(user.id).then(setEsAdmin);
  }, [user?.id]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="px-5 pt-5 pb-5 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground" data-guia="modulo-titulo">
            Configuración
          </h1>
        </div>
      </header>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {esAdmin === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !esAdmin ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Solo un administrador puede cambiar la configuración.
          </p>
        ) : (
          <Tabs defaultValue="usuarios" className="gap-5">
            <TabsList data-guia="pestanas">
              <TabsTrigger value="usuarios">Usuarios y permisos</TabsTrigger>
              <TabsTrigger value="empresa">Datos de la empresa</TabsTrigger>
              <TabsTrigger value="cotizacion">Cotización</TabsTrigger>
            </TabsList>
            <TabsContent value="usuarios">
              <UsuariosPanel miId={user?.id ?? ""} />
            </TabsContent>
            <TabsContent value="empresa">
              <EmpresaPanel />
            </TabsContent>
            <TabsContent value="cotizacion">
              <CotizacionPanel usuarioId={user?.id ?? null} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

/* ─── Usuarios y permisos ─────────────────────────────────────────────── */

function UsuariosPanel({ miId }: { miId: string }) {
  const [filas, setFilas] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [creando, setCreando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await listarUsuarios();
    if (error) toast.error(error.message);
    setFilas(data);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" className="gap-1.5" onClick={() => setCreando(true)} data-guia="usuario-nuevo">
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white" data-guia="lista">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead className="hidden md:table-cell">Último ingreso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No hay usuarios.
                </TableCell>
              </TableRow>
            ) : (
              filas.map((u) => (
                <TableRow key={u.id} className="cursor-pointer" onClick={() => setEditando(u)}>
                  <TableCell>
                    <p className="font-medium">
                      {u.full_name || u.email || "Sin nombre"}
                      {u.id === miId ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(vos)</span>
                      ) : null}
                    </p>
                    {u.full_name && u.email ? (
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {!u.activo ? (
                        <Badge variant="outline" className="text-[10px] text-destructive">
                          Desactivado
                        </Badge>
                      ) : null}
                      {u.es_admin ? (
                        <Badge variant="success" className="gap-1 text-[10px]">
                          <ShieldCheck className="h-3 w-3" />
                          Administrador
                        </Badge>
                      ) : null}
                      {u.roles.map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px]">
                          {etiquetaRol(r)}
                        </Badge>
                      ))}
                      {!u.es_admin && u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin roles asignados</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {fmtFechaHora(u.ultimo_ingreso)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <UsuarioDialog
        usuario={editando}
        creando={creando}
        esYo={editando?.id === miId}
        onClose={() => {
          setEditando(null);
          setCreando(false);
        }}
        onSaved={() => {
          setEditando(null);
          setCreando(false);
          void recargar();
        }}
      />
    </div>
  );
}

function UsuarioDialog({
  usuario,
  creando,
  esYo,
  onClose,
  onSaved,
}: {
  usuario: UsuarioAdmin | null;
  creando: boolean;
  esYo: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const abierto = creando || usuario !== null;

  useEffect(() => {
    setPassword("");
    if (usuario) {
      setNombre(usuario.full_name ?? "");
      setEmail(usuario.email ?? "");
      setAdmin(usuario.es_admin);
      setRoles(new Set(usuario.roles));
    } else if (creando) {
      setNombre("");
      setEmail("");
      setAdmin(false);
      setRoles(new Set());
    }
  }, [usuario, creando]);

  const cambiarPassword = async () => {
    if (!usuario) return;
    setGuardando(true);
    const { error } = await cambiarPasswordUsuario(usuario.id, password);
    setGuardando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Contraseña actualizada.");
  };

  const alternarActivo = async () => {
    if (!usuario) return;
    const { error } = await setUsuarioActivo(usuario.id, !usuario.activo);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(usuario.activo ? "Cuenta desactivada: ya no puede ingresar." : "Cuenta reactivada.");
    onSaved();
  };

  const toggleRol = (r: string, on: boolean) =>
    setRoles((prev) => {
      const next = new Set(prev);
      if (on) next.add(r);
      else next.delete(r);
      return next;
    });

  const guardar = async () => {
    setGuardando(true);
    const rolesArr = [...roles] as RolOperativo[];
    const { error } = usuario
      ? await guardarUsuario({ id: usuario.id, fullName: nombre, esAdmin: admin, roles: rolesArr })
      : await crearUsuario({ email, password, fullName: nombre, esAdmin: admin, roles: rolesArr });
    setGuardando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      usuario ? "Permisos guardados. La persona los ve la próxima vez que entre." : "Cuenta creada. Ya puede ingresar.",
    );
    onSaved();
  };

  const reiniciarGuia = async () => {
    if (!usuario) return;
    const { error } = await reiniciarGuiaUsuario(usuario.id);
    if (error) toast.error(error.message);
    else toast.success("La próxima vez que entre va a ver la guía de uso desde el principio.");
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dialogFormClassName} showCloseButton>
        <DialogHeader>
          <DialogTitle>{usuario ? usuario.full_name || usuario.email || "Usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>{usuario ? (usuario.email ?? "") : "Mail y contraseña con los que va a ingresar."}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nombre para mostrar</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Francisco Pérez" />
          </div>

          {!usuario ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Mail</Label>
                <Input
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contraseña</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Cambiar contraseña</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nueva contraseña (mínimo 6 caracteres)"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={guardando || password.length < 6}
                  onClick={() => void cambiarPassword()}
                >
                  Cambiar
                </Button>
              </div>
            </div>
          )}

          <label
            className={`flex items-start gap-3 rounded-lg border border-border p-3 ${esYo ? "opacity-70" : "cursor-pointer"}`}
          >
            <Checkbox
              checked={admin}
              disabled={esYo}
              onCheckedChange={(v) => setAdmin(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">Administrador</span>
              <span className="block text-xs text-muted-foreground">
                {esYo
                  ? "No podés quitarte este permiso a vos mismo."
                  : "Ve todos los módulos y puede cambiar la configuración, incluidos los permisos de los demás."}
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label className="text-xs">Roles</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES_ASIGNABLES.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
                >
                  <Checkbox
                    checked={roles.has(r.value)}
                    onCheckedChange={(v) => toggleRol(r.value, v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
            {admin ? (
              <p className="text-[11px] text-muted-foreground">
                Como administrador ve todo igual; los roles sirven para asignarle tareas (por ejemplo, como medidor).
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {usuario ? (
            <div className="mr-auto flex flex-wrap gap-1">
              <Button type="button" variant="ghost" className="gap-1.5" onClick={() => void reiniciarGuia()}>
                <RotateCcw className="h-4 w-4" />
                Volver a mostrar la guía
              </Button>
              {!esYo ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={`gap-1.5 ${usuario.activo ? "text-destructive" : ""}`}
                  onClick={() => void alternarActivo()}
                >
                  <Ban className="h-4 w-4" />
                  {usuario.activo ? "Desactivar cuenta" : "Reactivar cuenta"}
                </Button>
              ) : null}
            </div>
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={guardando || (!usuario && (!email.trim() || password.length < 6))}
            onClick={() => void guardar()}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Datos de la empresa ─────────────────────────────────────────────── */

const CAMPOS_EMPRESA: { key: keyof EmpresaInput; label: string; placeholder?: string; ancho?: boolean }[] = [
  { key: "razon_social", label: "Razón social *", placeholder: "Piedra Americana S.A.", ancho: true },
  { key: "nombre_fantasia", label: "Nombre de fantasía", placeholder: "Como te conocen los clientes" },
  { key: "cuit", label: "CUIT", placeholder: "30-00000000-0" },
  { key: "condicion_iva", label: "Condición de IVA", placeholder: "Responsable inscripto" },
  { key: "telefono", label: "Teléfono", placeholder: "+54 9 11 …" },
  { key: "direccion", label: "Dirección", placeholder: "Calle y número" },
  { key: "localidad", label: "Localidad", placeholder: "Ciudad, provincia" },
  { key: "email", label: "Email", placeholder: "ventas@…" },
  { key: "sitio_web", label: "Sitio web", placeholder: "www.…" },
];

function EmpresaPanel() {
  const empresa = useConfiguracionEmpresa();
  const [draft, setDraft] = useState<EmpresaInput>(empresa);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!editando) setDraft(empresa);
  }, [empresa, editando]);

  const cancelar = () => {
    setDraft(empresa);
    setEditando(false);
  };

  const guardar = async () => {
    setGuardando(true);
    const { error } = await guardarDatosEmpresa(draft);
    setGuardando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Datos de la empresa guardados.");
    setEditando(false);
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Salen en el encabezado del presupuesto y del comprobante de cobros que se le entregan al cliente.
        </p>
        {!editando ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={() => setEditando(true)}
            data-guia="empresa-editar"
          >
            <Pencil className="h-4 w-4" />
            Editar datos
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-white p-4 sm:grid-cols-2" data-guia="empresa-form">
        {CAMPOS_EMPRESA.map((c) => (
          <div key={c.key} className={`space-y-1 ${c.ancho ? "sm:col-span-2" : ""}`}>
            <Label className="text-xs">{c.label}</Label>
            {editando ? (
              <Input
                value={draft[c.key] ?? ""}
                placeholder={c.placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
              />
            ) : (
              <p className={`flex h-10 items-center text-sm ${empresa[c.key] ? "" : "text-muted-foreground"}`}>
                {empresa[c.key] || "Sin cargar"}
              </p>
            )}
          </div>
        ))}
      </div>
      {editando ? (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={guardando} onClick={cancelar}>
            Cancelar
          </Button>
          <Button type="button" disabled={guardando} onClick={() => void guardar()}>
            {guardando ? "Guardando…" : "Guardar datos"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Cotización ──────────────────────────────────────────────────────── */

function CotizacionPanel({ usuarioId }: { usuarioId: string | null }) {
  const empresa = useConfiguracionEmpresa();
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const n = Number(valor.trim().replace(/\./g, "").replace(",", "."));
    setGuardando(true);
    const { error } = await guardarDolarHoy(n, usuarioId);
    setGuardando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setValor("");
    toast.success(`Dólar actualizado a ${fmtPesos(n)}.`);
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border border-border bg-white p-4" data-guia="cotizacion-actual">
        <p className="text-xs text-muted-foreground">Dólar del día</p>
        {empresa.dolar_hoy ? (
          <>
            <p className="text-3xl font-semibold tabular-nums">{fmtPesos(empresa.dolar_hoy)}</p>
            <p className="text-xs text-muted-foreground">
              Actualizado el {fmtFechaHora(empresa.dolar_actualizado_en)}
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-semibold tabular-nums text-muted-foreground">Sin cargar</p>
            <p className="text-xs text-muted-foreground">
              Mientras tanto, los presupuestos nuevos arrancan con {fmtPesos(DOLAR_SIN_CARGAR)}.
            </p>
          </>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-white p-4">
        <Label className="text-xs">Nueva cotización (pesos por dólar)</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 tabular-nums"
              inputMode="decimal"
              placeholder="Ej. 1350"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valor.trim()) void guardar();
              }}
            />
          </div>
          <Button type="button" disabled={guardando || !valor.trim()} onClick={() => void guardar()}>
            {guardando ? "Guardando…" : "Actualizar"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Los presupuestos nuevos arrancan con este valor. Los que ya están hechos conservan la cotización con
          la que se armaron.
        </p>
      </div>
    </div>
  );
}
