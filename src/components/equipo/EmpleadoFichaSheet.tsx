"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FechaInput } from "@/components/ui/fecha-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { AdelantoFormDialog } from "@/components/equipo/AdelantoFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import { puestoLabel, type EmpleadoRow } from "@/lib/empleados-api";
import {
  listAdelantos,
  listLiquidacionesEmpleado,
  type AdelantoConEmpleado,
  type LiquidacionRow,
} from "@/lib/sueldos-api";
import { etiquetaIncentivoTipo, listIncentivos, type IncentivoConEmpleado } from "@/lib/incentivos-api";
import {
  createVacacion,
  deleteVacacion,
  diasEntre,
  listVacaciones,
  type VacacionRow,
} from "@/lib/vacaciones-api";
import {
  DOCUMENTO_TIPOS,
  etiquetaDocumentoTipo,
  eliminarDocumento,
  listDocumentos,
  subirDocumento,
  urlDocumento,
  type EmpleadoDocumentoRow,
} from "@/lib/legajo-api";
import type { EmpleadoDocumentoTipo } from "@/types/database";

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function fmtMonto(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return `$ ${v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function antiguedad(iso: string | null): string {
  if (!iso) return "—";
  const ingreso = new Date(iso);
  if (Number.isNaN(ingreso.getTime())) return "—";
  const hoy = new Date();
  let meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
  if (hoy.getDate() < ingreso.getDate()) meses -= 1;
  if (meses < 0) return "—";
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes: string[] = [];
  if (anios) partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  if (resto || !anios) partes.push(`${resto} ${resto === 1 ? "mes" : "meses"}`);
  return partes.join(" ");
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function Seccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

type Props = {
  empleado: EmpleadoRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (e: EmpleadoRow) => void;
};

export function EmpleadoFichaSheet({ empleado, open, onOpenChange, onEdit }: Props) {
  const { user } = useAuth();
  const empleadoId = empleado?.id ?? null;

  const [adelantos, setAdelantos] = useState<AdelantoConEmpleado[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRow[]>([]);
  const [incentivos, setIncentivos] = useState<IncentivoConEmpleado[]>([]);
  const [vacaciones, setVacaciones] = useState<VacacionRow[]>([]);
  const [documentos, setDocumentos] = useState<EmpleadoDocumentoRow[]>([]);
  const [cargando, setCargando] = useState(false);

  const [adelantoAbierto, setAdelantoAbierto] = useState(false);

  // Vacaciones: formulario
  const [vDesde, setVDesde] = useState("");
  const [vHasta, setVHasta] = useState("");
  const [vNota, setVNota] = useState("");
  const [vGuardando, setVGuardando] = useState(false);

  // Documentos: formulario
  const [dArchivo, setDArchivo] = useState<File | null>(null);
  const [dTipo, setDTipo] = useState<EmpleadoDocumentoTipo>("otro");
  const [dNombre, setDNombre] = useState("");
  const [dSubiendo, setDSubiendo] = useState(false);

  const cargarTodo = useCallback(async (id: string) => {
    setCargando(true);
    const [a, l, i, v, d] = await Promise.all([
      listAdelantos({ empleadoId: id }),
      listLiquidacionesEmpleado(id),
      listIncentivos(),
      listVacaciones(id),
      listDocumentos(id),
    ]);
    const err = a.error ?? l.error ?? i.error ?? v.error ?? d.error;
    if (err) toast.error(`No se pudo cargar la ficha: ${err.message}`);
    setAdelantos(a.data);
    setLiquidaciones(l.data);
    setIncentivos(i.data.filter((x) => x.empleado_id === id));
    setVacaciones(v.data);
    setDocumentos(d.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!open || !empleadoId) return;
    void cargarTodo(empleadoId);
  }, [open, empleadoId, cargarTodo]);

  useEffect(() => {
    if (!open) {
      setVDesde("");
      setVHasta("");
      setVNota("");
      setDArchivo(null);
      setDNombre("");
      setDTipo("otro");
    }
  }, [open]);

  const adelantosPendientes = adelantos.filter((a) => a.liquidacion_id === null);
  const totalPendiente = adelantosPendientes.reduce((s, a) => s + Number(a.monto || 0), 0);
  const diasPreview = vDesde && vHasta ? diasEntre(vDesde, vHasta) : 0;

  const agregarVacacion = async () => {
    if (!empleadoId) return;
    if (!vDesde || !vHasta) {
      toast.error("Indicá las fechas desde y hasta");
      return;
    }
    setVGuardando(true);
    const { data, error } = await createVacacion({
      empleado_id: empleadoId,
      desde: vDesde,
      hasta: vHasta,
      notas: vNota,
      created_by: user?.id ?? null,
    });
    setVGuardando(false);
    if (error || !data) {
      toast.error(error?.message ?? "No se pudo registrar las vacaciones");
      return;
    }
    setVacaciones((prev) => [data, ...prev]);
    setVDesde("");
    setVHasta("");
    setVNota("");
    toast.success("Vacaciones registradas");
  };

  const quitarVacacion = async (id: string) => {
    const { error } = await deleteVacacion(id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setVacaciones((prev) => prev.filter((v) => v.id !== id));
  };

  const subirDoc = async () => {
    if (!empleadoId || !dArchivo) {
      toast.error("Elegí un archivo");
      return;
    }
    setDSubiendo(true);
    const { data, error } = await subirDocumento({
      empleadoId,
      tipo: dTipo,
      archivo: dArchivo,
      nombre: dNombre,
      createdBy: user?.id ?? null,
    });
    setDSubiendo(false);
    if (error || !data) {
      toast.error(error?.message ?? "No se pudo subir el documento");
      return;
    }
    setDocumentos((prev) => [data, ...prev]);
    setDArchivo(null);
    setDNombre("");
    setDTipo("otro");
    toast.success("Documento cargado");
  };

  const abrirDoc = async (doc: EmpleadoDocumentoRow) => {
    const { url, error } = await urlDocumento(doc.storage_path);
    if (error || !url) {
      toast.error(error?.message ?? "No se pudo abrir el documento");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const quitarDoc = async (doc: EmpleadoDocumentoRow) => {
    if (!window.confirm(`¿Eliminar "${doc.nombre}" del legajo? No se puede deshacer.`)) return;
    const { error } = await eliminarDocumento(doc);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {empleado && (
          <>
            <SheetHeader className="border-b border-border p-5 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg">
                    {empleado.apellido}, {empleado.nombre}
                  </SheetTitle>
                  <SheetDescription>
                    {puestoLabel(empleado.puesto)} · {empleado.activo ? "Activo" : "Inactivo"} ·{" "}
                    {antiguedad(empleado.fecha_ingreso)}
                  </SheetDescription>
                </div>
                <Badge variant={empleado.activo ? "success" : "outline"} className="shrink-0">
                  {empleado.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <Seccion titulo="Datos personales">
                <Dato label="DNI" value={empleado.dni ?? "—"} />
                <Dato label="CUIL" value={empleado.cuil ?? "—"} />
                <Dato label="Teléfono" value={empleado.telefono ?? "—"} />
                <Dato label="Email" value={empleado.email ?? "—"} />
              </Seccion>

              <Separator />

              <Seccion titulo="Datos laborales">
                <Dato label="Puesto" value={puestoLabel(empleado.puesto)} />
                <Dato label="Fecha de ingreso" value={fmtFecha(empleado.fecha_ingreso)} />
                <Dato label="Antigüedad" value={antiguedad(empleado.fecha_ingreso)} />
                <Dato label="Sueldo base" value={fmtMonto(empleado.sueldo_base)} />
                <Dato label="Estado" value={empleado.activo ? "Activo" : "Inactivo"} />
                {empleado.notas && <Dato label="Notas" value={empleado.notas} />}
              </Seccion>

              <Separator />

              <Seccion
                titulo={`Adelantos pendientes (${adelantosPendientes.length})`}
                accion={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setAdelantoAbierto(true)}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Registrar adelanto
                  </Button>
                }
              >
                {cargando ? (
                  <Vacio>Cargando…</Vacio>
                ) : adelantosPendientes.length === 0 ? (
                  <Vacio>Sin adelantos pendientes.</Vacio>
                ) : (
                  <>
                    <ul className="space-y-2">
                      {adelantosPendientes.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                        >
                          <span>
                            {fmtFecha(a.fecha)} · {a.metodo === "efectivo" ? "Efectivo" : "Transferencia"}
                          </span>
                          <span className="font-mono tabular-nums">{fmtMonto(a.monto)}</span>
                        </li>
                      ))}
                    </ul>
                    <Dato label="Total pendiente" value={fmtMonto(totalPendiente)} />
                  </>
                )}
              </Seccion>

              <Separator />

              <Seccion titulo="Sueldos (liquidaciones)">
                {cargando ? (
                  <Vacio>Cargando…</Vacio>
                ) : liquidaciones.length === 0 ? (
                  <Vacio>Sin liquidaciones registradas.</Vacio>
                ) : (
                  <ul className="space-y-2">
                    {liquidaciones.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="capitalize">
                          {MESES[l.periodo_mes - 1]} {l.periodo_anio}
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {l.estado === "cerrada" ? "Cerrada" : "Borrador"}
                          </Badge>
                        </span>
                        <span className="font-mono tabular-nums">{fmtMonto(l.total_neto)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Seccion>

              <Separator />

              <Seccion titulo={`Incentivos (${incentivos.length})`}>
                {cargando ? (
                  <Vacio>Cargando…</Vacio>
                ) : incentivos.length === 0 ? (
                  <Vacio>Sin incentivos registrados.</Vacio>
                ) : (
                  <ul className="space-y-2">
                    {incentivos.map((i) => (
                      <li
                        key={i.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span>
                          {fmtFecha(i.fecha)} · {etiquetaIncentivoTipo(i.tipo)}
                          {i.descripcion ? <span className="text-muted-foreground"> — {i.descripcion}</span> : null}
                        </span>
                        <span className="font-mono tabular-nums">{fmtMonto(i.monto)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Seccion>

              <Separator />

              <Seccion titulo="Historial de adelantos">
                {cargando ? (
                  <Vacio>Cargando…</Vacio>
                ) : adelantos.length === 0 ? (
                  <Vacio>Sin adelantos registrados.</Vacio>
                ) : (
                  <ul className="space-y-2">
                    {adelantos.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span>
                          {fmtFecha(a.fecha)} · {a.metodo === "efectivo" ? "Efectivo" : "Transferencia"}
                          {a.liquidacion_id ? (
                            <Badge variant="outline" className="ml-2 text-[10px]">Descontado</Badge>
                          ) : null}
                        </span>
                        <span className="font-mono tabular-nums">{fmtMonto(a.monto)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Seccion>

              <Separator />

              <Seccion titulo={`Vacaciones (${vacaciones.length})`}>
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Desde</span>
                      <FechaInput value={vDesde} onChange={setVDesde} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Hasta</span>
                      <FechaInput value={vHasta} onChange={setVHasta} />
                    </div>
                  </div>
                  <Input
                    className="h-9"
                    placeholder="Nota (opcional)"
                    value={vNota}
                    onChange={(e) => setVNota(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {diasPreview > 0 ? `${diasPreview} días corridos` : ""}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={vGuardando}
                      onClick={() => void agregarVacacion()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar
                    </Button>
                  </div>
                </div>
                {cargando ? (
                  <Vacio>Cargando…</Vacio>
                ) : vacaciones.length === 0 ? (
                  <Vacio>Sin períodos de vacaciones registrados.</Vacio>
                ) : (
                  <ul className="space-y-2">
                    {vacaciones.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          {fmtFecha(v.desde)} → {fmtFecha(v.hasta)}{" "}
                          <span className="text-muted-foreground">· {v.dias} días</span>
                          {v.notas ? <span className="block truncate text-xs text-muted-foreground">{v.notas}</span> : null}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Eliminar"
                          onClick={() => void quitarVacacion(v.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Seccion>

              <Separator />

              <Seccion titulo={`Documentos del legajo (${documentos.length})`}>
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="h-9 cursor-pointer text-sm"
                    onChange={(e) => setDArchivo(e.target.files?.[0] ?? null)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={dTipo} onValueChange={(v) => setDTipo(v as EmpleadoDocumentoTipo)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENTO_TIPOS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-9"
                      placeholder="Nombre (opcional)"
                      value={dNombre}
                      onChange={(e) => setDNombre(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={!dArchivo || dSubiendo}
                      onClick={() => void subirDoc()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {dSubiendo ? "Subiendo…" : "Subir"}
                    </Button>
                  </div>
                </div>
                {cargando ? (
                  <Vacio>Cargando…</Vacio>
                ) : documentos.length === 0 ? (
                  <Vacio>Sin documentos cargados.</Vacio>
                ) : (
                  <ul className="space-y-2">
                    {documentos.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{d.nombre}</span>
                          <span className="text-xs text-muted-foreground">
                            {etiquetaDocumentoTipo(d.tipo)} · {fmtFecha(d.created_at)}
                          </span>
                        </span>
                        <span className="flex shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Abrir"
                            onClick={() => void abrirDoc(d)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Eliminar"
                            onClick={() => void quitarDoc(d)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Seccion>
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-4">
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => onEdit(empleado)}>
                <Pencil className="h-4 w-4" />
                Editar datos
              </Button>
            </div>

            <AdelantoFormDialog
              open={adelantoAbierto}
              onOpenChange={setAdelantoAbierto}
              empleadoIdInicial={empleado.id}
              onSaved={() => {
                if (empleadoId) void cargarTodo(empleadoId);
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
