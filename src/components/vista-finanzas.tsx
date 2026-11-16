"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechaInput } from "@/components/ui/fecha-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GastosFijosPanel } from "@/components/finanzas/GastosFijosPanel";
import { FinanzasResumen } from "@/components/finanzas/FinanzasResumen";
import { FinanzasMovimientos } from "@/components/finanzas/FinanzasMovimientos";
import { FinanzasDisponibilidad } from "@/components/finanzas/FinanzasDisponibilidad";
import { FinanzasProveedoresCC } from "@/components/finanzas/FinanzasProveedoresCC";
import { MovimientoDetallePanel } from "@/components/finanzas/MovimientoDetallePanel";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  FINANZAS_SECCION_LABELS,
  FINANZAS_TABS_HEADER,
  finanzasSeccionDesdeParam,
  type FinanzasSeccion,
} from "@/types/workspace";
import {
  crearCuentaFinanciera,
  listCuentasActivas,
  listSaldosCuentas,
  transferirEntreCuentas,
  type CuentaFinancieraRow,
  type MovimientoCajaRow,
  type SaldoCuentaRow,
} from "@/lib/finanzas-api";
import { fetchSuppliers, type SupplierRow } from "@/lib/suppliers-api";
import { etiquetaCajon } from "@/components/finanzas/finanzas-helpers";
import { cn } from "@/lib/utils";

function emptyTransfForm(hoy: string) {
  return {
    origenId: "",
    destinoId: "",
    monto: "",
    moneda: "ars" as "ars" | "usd",
    fecha: hoy,
    descripcion: "",
  };
}

function emptyCuentaForm() {
  return {
    nombre: "",
    tipo: "caja" as CuentaFinancieraRow["tipo"],
    moneda: "ars" as "ars" | "usd",
    saldo_inicial: "",
  };
}

export function VistaFinanzas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const seccion = useMemo(
    () => finanzasSeccionDesdeParam(searchParams.get("fn")),
    [searchParams],
  );

  const gotoSeccion = useCallback(
    (next: FinanzasSeccion) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("ws", "finanzas");
          n.set("fn", next);
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Finanzas requiere Supabase configurado y la migración M15 aplicada.
      </div>
    );
  }

  return <FinanzasShell seccion={seccion} onGoto={gotoSeccion} />;
}

function FinanzasShell({
  seccion,
  onGoto,
}: {
  seccion: FinanzasSeccion;
  onGoto: (s: FinanzasSeccion) => void;
}) {
  const [saldos, setSaldos] = useState<SaldoCuentaRow[]>([]);
  const [cuentas, setCuentas] = useState<CuentaFinancieraRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [recargaKey, setRecargaKey] = useState(0);

  const [dialogTransf, setDialogTransf] = useState(false);
  const [dialogCuenta, setDialogCuenta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [movimientoDetalle, setMovimientoDetalle] = useState<MovimientoCajaRow | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const [transfForm, setTransfForm] = useState(() => emptyTransfForm(hoy));
  const [cuentaForm, setCuentaForm] = useState(emptyCuentaForm);

  const suppliersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of suppliers) map.set(s.id, s.name);
    return map;
  }, [suppliers]);

  const recargar = useCallback(async () => {
    setCargando(true);
    const [s, c] = await Promise.all([listSaldosCuentas(), listCuentasActivas()]);
    void fetchSuppliers().then(setSuppliers).catch(() => {});
    if (s.error) toast.error(s.error.message);
    if (c.error) toast.error(c.error.message);
    setSaldos(s.data);
    setCuentas(c.data);
    setCargando(false);
  }, []);

  const recargarYAvisar = useCallback(async () => {
    await recargar();
    setRecargaKey((k) => k + 1);
  }, [recargar]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const origenTransf = useMemo(
    () => cuentas.find((c) => c.id === transfForm.origenId) ?? null,
    [cuentas, transfForm.origenId],
  );
  const destinoTransf = useMemo(
    () => cuentas.find((c) => c.id === transfForm.destinoId) ?? null,
    [cuentas, transfForm.destinoId],
  );
  const saldoOrigen = useMemo(
    () => saldos.find((s) => s.cuenta_id === transfForm.origenId)?.saldo_actual ?? null,
    [saldos, transfForm.origenId],
  );

  async function onTransferir() {
    const n = Number(String(transfForm.monto).replace(",", "."));
    if (!transfForm.origenId || !transfForm.destinoId || !Number.isFinite(n) || n <= 0) {
      toast.error("Completá cuentas y monto válido.");
      return;
    }
    setBusy(true);
    const res = await transferirEntreCuentas({
      cuentaOrigenId: transfForm.origenId,
      cuentaDestinoId: transfForm.destinoId,
      monto: n,
      moneda: transfForm.moneda,
      fecha: transfForm.fecha,
      descripcion: transfForm.descripcion,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Plata movida entre cajas.");
    setDialogTransf(false);
    setTransfForm(emptyTransfForm(hoy));
    await recargarYAvisar();
  }

  async function onCrearCuenta() {
    const saldo = Number(String(cuentaForm.saldo_inicial).replace(",", ".")) || 0;
    setBusy(true);
    const res = await crearCuentaFinanciera({
      nombre: cuentaForm.nombre,
      tipo: cuentaForm.tipo,
      moneda: cuentaForm.moneda,
      saldo_inicial: saldo,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Cuenta creada.");
    setDialogCuenta(false);
    setCuentaForm(emptyCuentaForm());
    await recargarYAvisar();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="border-b border-border bg-card">
        <div className="flex items-end gap-4 px-5 pt-3 sm:px-6">
          <h1 className="shrink-0 pb-2.5 text-lg font-semibold tracking-tight">Finanzas</h1>
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {FINANZAS_TABS_HEADER.map((tab) => {
            const active = seccion === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onGoto(tab)}
                className={cn(
                  "shrink-0 border-b-2 px-3 pb-2.5 text-sm transition-colors",
                  active
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {FINANZAS_SECCION_LABELS[tab]}
              </button>
            );
          })}
          </nav>
        </div>
      </header>

      <div className="space-y-4 px-5 py-4 sm:px-6">
        {seccion === "resumen" ? (
          <FinanzasResumen
            saldos={saldos}
            cuentas={cuentas}
            cargandoSaldos={cargando}
            suppliersById={suppliersById}
            onGoto={onGoto}
            onAbrirMovimiento={setMovimientoDetalle}
          />
        ) : null}
        {seccion === "movimientos" ? (
          <FinanzasMovimientos
            cuentas={cuentas}
            suppliersById={suppliersById}
            onAbrirMovimiento={setMovimientoDetalle}
            recargaKey={recargaKey}
            onAcreditado={() => void recargarYAvisar()}
          />
        ) : null}
        {seccion === "disponibilidad" ? (
          <FinanzasDisponibilidad
            saldos={saldos}
            cargando={cargando}
            onTransferir={() => {
              setTransfForm(emptyTransfForm(hoy));
              setDialogTransf(true);
            }}
            onNuevaCuenta={() => {
              setCuentaForm(emptyCuentaForm());
              setDialogCuenta(true);
            }}
          />
        ) : null}
        {seccion === "proveedores_cc" ? (
          <FinanzasProveedoresCC
            cuentas={cuentas}
            recargaKey={recargaKey}
            onAbrirMovimiento={setMovimientoDetalle}
          />
        ) : null}
        {seccion === "comisiones" ? (
          <FinanzasPlaceholder
            titulo="Comisiones"
            texto="Acá vas a ver las comisiones de vendedores ligadas a las ventas cobradas. Todavía no está conectado."
          />
        ) : null}
        {seccion === "flujo_caja" ? (
          <FinanzasPlaceholder
            titulo="Flujo de caja"
            texto="La proyección de entradas y salidas se arma con cobros pendientes, gastos fijos y pagos a proveedores."
          />
        ) : null}
        {seccion === "gastos_fijos" ? <GastosFijosPanel onRegistrado={() => void recargarYAvisar()} /> : null}
      </div>

      <MovimientoDetallePanel
        movimiento={movimientoDetalle}
        open={Boolean(movimientoDetalle)}
        onOpenChange={(o) => {
          if (!o) setMovimientoDetalle(null);
        }}
        cuentas={cuentas}
        suppliersById={suppliersById}
        onChanged={() => void recargarYAvisar()}
      />

      <Dialog open={dialogTransf} onOpenChange={setDialogTransf}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover entre cajas</DialogTitle>
            <DialogDescription>
              No es plata nueva: sale de un cajón y entra en otro. Ejemplo: depositás efectivo en el banco.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Sale de</Label>
              <Select
                value={transfForm.origenId || undefined}
                onValueChange={(v) => {
                  const c = cuentas.find((x) => x.id === v);
                  setTransfForm((f) => ({
                    ...f,
                    origenId: v,
                    moneda: c?.moneda ?? f.moneda,
                  }));
                }}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Elegí el cajón de origen" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {etiquetaCajon(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {origenTransf && saldoOrigen != null ? (
                <p className="text-[11px] text-muted-foreground">
                  Saldo actual: {saldoOrigen.toLocaleString("es-AR")}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Entra en</Label>
              <Select
                value={transfForm.destinoId || undefined}
                onValueChange={(v) => setTransfForm((f) => ({ ...f, destinoId: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Elegí el cajón de destino" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === transfForm.origenId}>
                      {etiquetaCajon(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {origenTransf && destinoTransf ? (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <span className="font-medium">{etiquetaCajon(origenTransf)}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{etiquetaCajon(destinoTransf)}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={transfForm.monto}
                  onChange={(e) => setTransfForm((f) => ({ ...f, monto: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <FechaInput value={transfForm.fecha} onChange={(iso) => setTransfForm((f) => ({ ...f, fecha: iso }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nota (opcional)</Label>
              <Input
                placeholder="Ej: depósito en el banco"
                value={transfForm.descripcion}
                onChange={(e) => setTransfForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTransf(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={() => void onTransferir()}>Mover plata</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogCuenta} onOpenChange={setDialogCuenta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva cuenta</DialogTitle>
            <DialogDescription>Caja, banco, tarjeta o cheques. El saldo inicial queda registrado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej: Banco Galicia $"
                value={cuentaForm.nombre}
                onChange={(e) => setCuentaForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={cuentaForm.tipo}
                  onValueChange={(v) => setCuentaForm((f) => ({ ...f, tipo: v as CuentaFinancieraRow["tipo"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caja">Caja / efectivo</SelectItem>
                    <SelectItem value="banco">Banco / transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select
                  value={cuentaForm.moneda}
                  onValueChange={(v) => setCuentaForm((f) => ({ ...f, moneda: v as "ars" | "usd" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ars">Pesos</SelectItem>
                    <SelectItem value="usd">Dólares</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Saldo inicial</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={cuentaForm.saldo_inicial}
                onChange={(e) => setCuentaForm((f) => ({ ...f, saldo_inicial: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCuenta(false)}>Cancelar</Button>
            <Button disabled={busy || !cuentaForm.nombre.trim()} onClick={() => void onCrearCuenta()}>
              Crear cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinanzasPlaceholder({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
