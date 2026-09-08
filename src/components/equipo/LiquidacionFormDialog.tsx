"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { listEmpleados, nombreEmpleado, type EmpleadoRow } from "@/lib/empleados-api";
import {
  cerrarLiquidacion,
  listAdelantos,
  reabrirLiquidacion,
  saveLiquidacion,
  type AdelantoConEmpleado,
  type ConceptoInput,
  type LiquidacionConDetalle,
} from "@/lib/sueldos-api";
import {
  calcularTotalesLiquidacion,
  CONCEPTOS_LIQUIDACION,
  conceptoLabel,
  formatFechaIso,
  formatPesos,
  MESES_LABEL,
  parseMonto,
  sumaPagos,
} from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { LiquidacionConceptoTipo } from "@/types/database";

type ConceptoDraft = {
  key: string;
  tipo: LiquidacionConceptoTipo;
  descripcion: string;
  monto: string;
  referencia_id: string | null;
};

function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Math.random().toString(36).slice(2)}`;
}

function seedDesdeEmpleado(
  empleado: EmpleadoRow | undefined,
  adelantos: AdelantoConEmpleado[],
): ConceptoDraft[] {
  const out: ConceptoDraft[] = [];
  const base = Number(empleado?.sueldo_base ?? 0);
  if (empleado && Number.isFinite(base) && base > 0) {
    out.push({
      key: newKey(),
      tipo: "sueldo_base",
      descripcion: "Sueldo base",
      monto: String(base),
      referencia_id: null,
    });
  }
  for (const a of adelantos) {
    out.push({
      key: newKey(),
      tipo: "adelanto",
      descripcion: `Adelanto ${formatFechaIso(a.fecha)}`,
      monto: String(a.monto),
      referencia_id: a.id,
    });
  }
  if (out.length === 0) {
    out.push({
      key: newKey(),
      tipo: "sueldo_base",
      descripcion: "Sueldo base",
      monto: "",
      referencia_id: null,
    });
  }
  return out;
}

type LiquidacionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidacion?: LiquidacionConDetalle | null;
  mesDefault: number;
  anioDefault: number;
  onSaved: (row: LiquidacionConDetalle) => void;
};

export function LiquidacionFormDialog({
  open,
  onOpenChange,
  liquidacion = null,
  mesDefault,
  anioDefault,
  onSaved,
}: LiquidacionFormDialogProps) {
  const { user } = useAuth();
  const editando = Boolean(liquidacion?.id);
  const cerrada = liquidacion?.estado === "cerrada";

  const [empleadoId, setEmpleadoId] = useState("");
  const [mes, setMes] = useState(mesDefault);
  const [anio, setAnio] = useState(anioDefault);
  const [conceptos, setConceptos] = useState<ConceptoDraft[]>([]);
  const [pago15, setPago15] = useState("");
  const [pagoBanco, setPagoBanco] = useState("");
  const [pago30, setPago30] = useState("");
  const [notas, setNotas] = useState("");
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [adelantos, setAdelantos] = useState<AdelantoConEmpleado[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    void Promise.all([listEmpleados(), listAdelantos()]).then(([emps, ads]) => {
      if (!emps.error) setEmpleados(emps.data);
      if (!ads.error) setAdelantos(ads.data);
    });

    if (liquidacion) {
      setEmpleadoId(liquidacion.empleado_id);
      setMes(liquidacion.periodo_mes);
      setAnio(liquidacion.periodo_anio);
      setConceptos(
        liquidacion.liquidacion_conceptos.map((c) => ({
          key: c.id,
          tipo: c.tipo,
          descripcion: c.descripcion,
          monto: String(c.monto),
          referencia_id: c.referencia_id,
        })),
      );
      setPago15(liquidacion.pago_efectivo_15 ? String(liquidacion.pago_efectivo_15) : "");
      setPagoBanco(liquidacion.pago_banco_30 ? String(liquidacion.pago_banco_30) : "");
      setPago30(liquidacion.pago_efectivo_30 ? String(liquidacion.pago_efectivo_30) : "");
      setNotas(liquidacion.notas ?? "");
    } else {
      setEmpleadoId("");
      setMes(mesDefault);
      setAnio(anioDefault);
      setConceptos([]);
      setPago15("");
      setPagoBanco("");
      setPago30("");
      setNotas("");
    }
  }, [open, liquidacion, mesDefault, anioDefault]);

  const opcionesEmp = useMemo(
    () => empleados.filter((e) => e.activo || e.id === empleadoId),
    [empleados, empleadoId],
  );

  const adelantosDelEmpleado = useMemo(
    () =>
      adelantos.filter(
        (a) =>
          a.empleado_id === empleadoId &&
          (!a.liquidacion_id || a.liquidacion_id === liquidacion?.id),
      ),
    [adelantos, empleadoId, liquidacion?.id],
  );

  const idsAdelantoMarcados = useMemo(
    () => new Set(conceptos.filter((c) => c.referencia_id).map((c) => c.referencia_id as string)),
    [conceptos],
  );

  const totales = useMemo(() => {
    const parsed: { tipo: LiquidacionConceptoTipo; monto: number }[] = [];
    for (const c of conceptos) {
      const m = parseMonto(c.monto);
      if (!Number.isFinite(m) || m <= 0) continue;
      parsed.push({ tipo: c.tipo, monto: m });
    }
    return calcularTotalesLiquidacion(parsed);
  }, [conceptos]);

  const pagosNum = {
    pago_efectivo_15: parseMonto(pago15) || 0,
    pago_banco_30: parseMonto(pagoBanco) || 0,
    pago_efectivo_30: parseMonto(pago30) || 0,
  };
  const sumaTramos = sumaPagos(pagosNum);
  const tramosDesiguales =
    sumaTramos > 0 && Math.abs(sumaTramos - totales.total_neto) > 0.05;

  const anios = useMemo(() => {
    const y = new Date().getFullYear();
    const set = new Set([y - 1, y, y + 1, anio]);
    return [...set].sort((a, b) => b - a);
  }, [anio]);

  const aplicarEmpleado = (id: string) => {
    setEmpleadoId(id);
    if (editando) return;
    const emp = empleados.find((e) => e.id === id);
    const ads = adelantos.filter((a) => a.empleado_id === id && !a.liquidacion_id);
    setConceptos(seedDesdeEmpleado(emp, ads));
  };

  const toggleAdelanto = (a: AdelantoConEmpleado, checked: boolean) => {
    if (cerrada) return;
    if (checked) {
      if (idsAdelantoMarcados.has(a.id)) return;
      setConceptos((prev) => [
        ...prev,
        {
          key: newKey(),
          tipo: "adelanto",
          descripcion: `Adelanto ${formatFechaIso(a.fecha)}`,
          monto: String(a.monto),
          referencia_id: a.id,
        },
      ]);
    } else {
      setConceptos((prev) => prev.filter((c) => c.referencia_id !== a.id));
    }
  };

  const toInput = (): ConceptoInput[] | { error: string } => {
    const out: ConceptoInput[] = [];
    for (const c of conceptos) {
      const descripcion = c.descripcion.trim();
      const monto = parseMonto(c.monto);
      if (!descripcion) return { error: "Cada concepto necesita una descripción" };
      if (!Number.isFinite(monto) || monto <= 0) {
        return { error: "Cada concepto necesita un monto mayor a 0" };
      }
      out.push({
        tipo: c.tipo,
        descripcion,
        monto,
        referencia_id: c.referencia_id,
      });
    }
    if (out.length === 0) return { error: "Agregá al menos un concepto" };
    return out;
  };

  const persistir = async (yCerrar: boolean) => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }
    if (!empleadoId) {
      toast.error("Elegí un empleado");
      return;
    }
    const conceptosOk = toInput();
    if ("error" in conceptosOk) {
      toast.error(conceptosOk.error);
      return;
    }
    for (const p of [pago15, pagoBanco, pago30]) {
      if (p.trim() && !Number.isFinite(parseMonto(p))) {
        toast.error("Los tramos de pago no son válidos");
        return;
      }
    }

    setGuardando(true);
    try {
      const saved = await saveLiquidacion(
        {
          empleado_id: empleadoId,
          periodo_mes: mes,
          periodo_anio: anio,
          conceptos: conceptosOk,
          pago_efectivo_15: pagosNum.pago_efectivo_15,
          pago_banco_30: pagosNum.pago_banco_30,
          pago_efectivo_30: pagosNum.pago_efectivo_30,
          notas,
          created_by: user?.id ?? null,
        },
        { id: liquidacion?.id },
      );
      if (saved.error || !saved.data) {
        toast.error(saved.error?.message ?? "No se pudo guardar");
        return;
      }
      let row = saved.data;
      if (yCerrar) {
        const closed = await cerrarLiquidacion(row.id);
        if (closed.error || !closed.data) {
          toast.error(closed.error?.message ?? "Se guardó el borrador, pero no se pudo cerrar");
          onSaved(row);
          onOpenChange(false);
          return;
        }
        row = closed.data;
        toast.success("Liquidación cerrada");
      } else {
        toast.success(editando ? "Borrador actualizado" : "Borrador guardado");
      }
      onSaved(row);
      onOpenChange(false);
    } finally {
      setGuardando(false);
    }
  };

  const reabrir = async () => {
    if (!liquidacion?.id) return;
    setGuardando(true);
    try {
      const res = await reabrirLiquidacion(liquidacion.id);
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "No se pudo reabrir");
        return;
      }
      onSaved(res.data);
      toast.success("Liquidación reabierta");
    } finally {
      setGuardando(false);
    }
  };

  const soloLectura = cerrada;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
        showCloseButton
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {editando ? (cerrada ? "Liquidación cerrada" : "Editar liquidación") : "Nueva liquidación"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <Label className="text-xs">Empleado</Label>
              <Select
                value={empleadoId || undefined}
                onValueChange={aplicarEmpleado}
                disabled={soloLectura || editando}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {opcionesEmp.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {nombreEmpleado(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mes</Label>
              <Select
                value={String(mes)}
                onValueChange={(v) => setMes(Number(v))}
                disabled={soloLectura}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_LABEL.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Año</Label>
              <Select
                value={String(anio)}
                onValueChange={(v) => setAnio(Number(v))}
                disabled={soloLectura}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anios.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {adelantosDelEmpleado.length > 0 ? (
            <div className="space-y-2 rounded-md border px-3 py-2">
              <p className="text-xs font-medium">Adelantos a descontar</p>
              {adelantosDelEmpleado.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={idsAdelantoMarcados.has(a.id)}
                    disabled={soloLectura}
                    onCheckedChange={(v) => toggleAdelanto(a, v === true)}
                  />
                  <span className="flex-1">
                    {formatFechaIso(a.fecha)} · {formatPesos(a.monto)}
                    {a.notas ? ` · ${a.notas}` : ""}
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Conceptos</Label>
              {!soloLectura ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() =>
                    setConceptos((prev) => [
                      ...prev,
                      {
                        key: newKey(),
                        tipo: "comision",
                        descripcion: conceptoLabel("comision"),
                        monto: "",
                        referencia_id: null,
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              {conceptos.map((c) => (
                <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_6.5rem_auto] gap-1.5">
                  <Select
                    value={c.tipo}
                    disabled={soloLectura || Boolean(c.referencia_id)}
                    onValueChange={(v) =>
                      setConceptos((prev) =>
                        prev.map((x) =>
                          x.key === c.key
                            ? {
                                ...x,
                                tipo: v as LiquidacionConceptoTipo,
                                descripcion: x.descripcion || conceptoLabel(v),
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONCEPTOS_LIQUIDACION.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-9 text-sm"
                    disabled={soloLectura}
                    value={c.descripcion}
                    onChange={(e) =>
                      setConceptos((prev) =>
                        prev.map((x) =>
                          x.key === c.key ? { ...x, descripcion: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    className="h-9 text-sm tabular-nums"
                    inputMode="decimal"
                    disabled={soloLectura || Boolean(c.referencia_id)}
                    value={c.monto}
                    onChange={(e) =>
                      setConceptos((prev) =>
                        prev.map((x) => (x.key === c.key ? { ...x, monto: e.target.value } : x)),
                      )
                    }
                  />
                  {!soloLectura ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      title="Quitar"
                      onClick={() => setConceptos((prev) => prev.filter((x) => x.key !== c.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 rounded-md border bg-muted/30 px-3 py-2 sm:grid-cols-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Bruto</p>
              <p className="tabular-nums font-medium">{formatPesos(totales.total_bruto)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Descuentos</p>
              <p className="tabular-nums font-medium">{formatPesos(totales.total_descuentos)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Neto a pagar</p>
              <p className="tabular-nums text-base font-semibold">{formatPesos(totales.total_neto)}</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium">Forma de pago (día 15 / día 30)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Efectivo 15</Label>
                <Input
                  className="h-9 text-sm"
                  inputMode="decimal"
                  disabled={soloLectura}
                  value={pago15}
                  onChange={(e) => setPago15(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Banco 30</Label>
                <Input
                  className="h-9 text-sm"
                  inputMode="decimal"
                  disabled={soloLectura}
                  value={pagoBanco}
                  onChange={(e) => setPagoBanco(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Efectivo 30</Label>
                <Input
                  className="h-9 text-sm"
                  inputMode="decimal"
                  disabled={soloLectura}
                  value={pago30}
                  onChange={(e) => setPago30(e.target.value)}
                />
              </div>
            </div>
            {tramosDesiguales ? (
              <p className="mt-1 text-[11px] text-amber-700">
                La suma de tramos ({formatPesos(sumaTramos)}) no coincide con el neto.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Si los dejás en 0 al cerrar, el neto va a efectivo del 30.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea
              className="min-h-[64px] resize-y text-sm"
              maxLength={500}
              disabled={soloLectura}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones internas…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {soloLectura ? "Cerrar" : "Cancelar"}
            </Button>
          </DialogClose>
          <div className="flex flex-wrap justify-end gap-2">
            {cerrada ? (
              <Button type="button" variant="secondary" disabled={guardando} onClick={() => void reabrir()}>
                Reabrir
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={guardando || !empleadoId}
                  onClick={() => void persistir(false)}
                >
                  {guardando ? "Guardando…" : "Guardar borrador"}
                </Button>
                <Button
                  type="button"
                  disabled={guardando || !empleadoId}
                  onClick={() => void persistir(true)}
                >
                  Cerrar liquidación
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
