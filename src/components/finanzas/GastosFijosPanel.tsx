"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormClassName,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import {
  etiquetaGastoFijo,
  GASTOS_FIJOS_CONCEPTOS,
  listGastosFijos,
  registrarGastoFijoDelMes,
  upsertGastoFijo,
  type GastoFijoRow,
} from "@/lib/gastos-fijos-api";
import { formatPesos, hoyIso, parseMonto } from "@/lib/sueldos-calculos";
import { isSupabaseConfigured } from "@/lib/supabase";
import { METODOS_PAGO } from "@/lib/finanzas-api";
import type { GastoFijoConcepto } from "@/types/database";

export function GastosFijosPanel({ onRegistrado }: { onRegistrado?: () => void }) {
  const { user } = useAuth();
  const [filas, setFilas] = useState<GastoFijoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<GastoFijoRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const res = await listGastosFijos();
    if (res.error) toast.error(res.error.message);
    else setFilas(res.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const registrar = async (g: GastoFijoRow) => {
    setBusyId(g.id);
    const res = await registrarGastoFijoDelMes({
      gasto: g,
      fecha: hoyIso(),
      created_by: user?.id ?? null,
    });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    if (res.yaEstaba) {
      toast.message("Este mes ya está cargado.");
      return;
    }
    toast.success(`${etiquetaGastoFijo(g.concepto)} cargado en el mes.`);
    onRegistrado?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          className="h-9 gap-1.5"
          onClick={() => {
            setEditando(null);
            setAbierto(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Plantilla
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rubro</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                Cargando…
              </TableCell>
            </TableRow>
          ) : filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                Cargá alquiler, luz, gas o impuestos como plantilla.
              </TableCell>
            </TableRow>
          ) : (
            filas.map((g) => (
              <TableRow key={g.id} className={g.activo ? "" : "opacity-50"}>
                <TableCell className="font-medium">{etiquetaGastoFijo(g.concepto)}</TableCell>
                <TableCell>{g.descripcion}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {g.moneda === "usd" ? `USD ${g.monto}` : formatPesos(g.monto)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setEditando(g);
                      setAbierto(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-1"
                    disabled={!g.activo || busyId === g.id}
                    onClick={() => void registrar(g)}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" />
                    Este mes
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <GastoFijoFormDialog
        open={abierto}
        onOpenChange={setAbierto}
        gasto={editando}
        onSaved={(row) => {
          setFilas((prev) => {
            const sin = prev.filter((g) => g.id !== row.id);
            return [...sin, row].sort((a, b) => a.concepto.localeCompare(b.concepto));
          });
        }}
      />
    </div>
  );
}

function GastoFijoFormDialog({
  open,
  onOpenChange,
  gasto,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gasto: GastoFijoRow | null;
  onSaved: (row: GastoFijoRow) => void;
}) {
  const [concepto, setConcepto] = useState<GastoFijoConcepto>("alquiler");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"ars" | "usd">("ars");
  const [metodo, setMetodo] = useState<GastoFijoRow["metodo"]>("transferencia");
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConcepto(gasto?.concepto ?? "alquiler");
    setDescripcion(gasto?.descripcion ?? "");
    setMonto(gasto ? String(gasto.monto) : "");
    setMoneda(gasto?.moneda ?? "ars");
    setMetodo(gasto?.metodo ?? "transferencia");
    setActivo(gasto?.activo ?? true);
  }, [open, gasto]);

  const guardar = async () => {
    setGuardando(true);
    const res = await upsertGastoFijo(gasto?.id ?? null, {
      concepto,
      descripcion,
      monto: parseMonto(monto),
      moneda,
      metodo,
      activo,
    });
    setGuardando(false);
    if (res.error || !res.data) {
      toast.error(res.error?.message ?? "No se pudo guardar.");
      return;
    }
    onSaved(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogFormClassName}>
        <DialogHeader>
          <DialogTitle>{gasto ? "Editar gasto fijo" : "Plantilla de gasto fijo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Rubro</Label>
            <Select value={concepto} onValueChange={(v) => setConcepto(v as GastoFijoConcepto)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GASTOS_FIJOS_CONCEPTOS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as "ars" | "usd")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ars">Pesos</SelectItem>
                  <SelectItem value="usd">Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Cómo se paga</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as GastoFijoRow["metodo"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODOS_PAGO.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={activo} onCheckedChange={setActivo} />
            <Label>Activa</Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" disabled={guardando} onClick={() => void guardar()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
