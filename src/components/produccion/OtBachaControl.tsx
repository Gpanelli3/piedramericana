"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  actualizarOrigenBachaOt,
  asignarBachaAOt,
  createBachaInventario,
  fetchBachasDisponiblesParaOt,
  fetchBachasInventario,
  liberarBachaDeOt,
  type BachaInventarioRow,
} from "@/lib/stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { etiquetaTipoColocacion } from "@/components/presupuesto/wizard/types";

function BadgeEstado({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
      >
        Está
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-red-200 bg-red-50 text-[10px] text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
    >
      Falta
    </Badge>
  );
}

function etiquetaOpcionBacha(b: BachaInventarioRow): string {
  const modelo = b.modelo?.trim() || "Sin modelo";
  if (b.origen === "cliente" && b.cliente_nombre?.trim()) {
    return `${modelo} · ${b.cliente_nombre.trim()}`;
  }
  return modelo;
}

export type OtBachaControlProps = {
  otId: string;
  clienteNombre?: string | null;
  clienteId?: string | null;
  bachaRequerida?: boolean;
  bachaOrigen?: "propia" | "cliente" | null;
  bachaTipo?: string | null;
  bachaColocacion?: string | null;
  bachaId?: string | null;
  onChanged?: () => void;
  /** En el resumen: solo estado. La asignación va en Materiales y stock. */
  soloAviso?: boolean;
};

export function OtBachaControl({
  otId,
  clienteNombre,
  clienteId = null,
  bachaRequerida = false,
  bachaOrigen = null,
  bachaTipo = null,
  bachaColocacion = null,
  bachaId = null,
  onChanged,
  soloAviso = false,
}: OtBachaControlProps) {
  const [bachaAsignada, setBachaAsignada] = useState<BachaInventarioRow | null>(null);
  const [bachasDisponibles, setBachasDisponibles] = useState<BachaInventarioRow[]>([]);
  const [bachaSelectId, setBachaSelectId] = useState("");
  const [registrarModelo, setRegistrarModelo] = useState(bachaTipo ?? "");
  const [registrarUbicacion, setRegistrarUbicacion] = useState("");
  const [busy, setBusy] = useState(false);
  const [cargando, setCargando] = useState(Boolean(bachaId));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [origen, setOrigen] = useState<"propia" | "cliente">(
    bachaOrigen === "cliente" ? "cliente" : "propia",
  );

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCargando(true);
    if (!soloAviso) {
      try {
        const bachas = await fetchBachasDisponiblesParaOt({ clienteNombre, clienteId });
        setBachasDisponibles(bachas);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudieron cargar las bachas");
        setBachasDisponibles([]);
      }
    }
    if (bachaId) {
      try {
        const todas = await fetchBachasInventario();
        setBachaAsignada(todas.find((b) => b.id === bachaId) ?? null);
      } catch {
        setBachaAsignada(null);
      }
    } else {
      setBachaAsignada(null);
    }
    setCargando(false);
  }, [bachaId, clienteNombre, clienteId, soloAviso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setOrigen(bachaOrigen === "cliente" ? "cliente" : "propia");
  }, [bachaOrigen]);

  const disponiblesDelOrigen = useMemo(
    () =>
      bachasDisponibles.filter((b) =>
        origen === "cliente" ? b.origen === "cliente" : b.origen !== "cliente",
      ),
    [bachasDisponibles, origen],
  );

  const mostrarBacha = bachaRequerida || Boolean(bachaId) || Boolean(bachaAsignada);

  const onCambiarOrigen = async (value: string) => {
    const next = value === "cliente" ? "cliente" : "propia";
    if (next === origen) return;
    const previo = origen;
    setOrigen(next);
    setBachaSelectId("");
    setBusy(true);
    const res = await actualizarOrigenBachaOt({ otId, origen: next });
    setBusy(false);
    if (res.error) {
      setOrigen(previo);
      toast.error(res.error.message);
      return;
    }
    onChanged?.();
  };

  const onAsignarBacha = async (id: string) => {
    if (!id) {
      toast.error("Elegí una bacha del stock.");
      return;
    }
    setBusy(true);
    const res = await asignarBachaAOt({
      bachaId: id,
      otId,
      clienteNombre,
      clienteId,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Bacha asignada.");
    if (res.aviso) toast.warning(res.aviso, { duration: 12000 });
    setBachaSelectId("");
    setDialogOpen(false);
    await reload();
    onChanged?.();
  };

  const onLiberarBacha = async () => {
    setBusy(true);
    const res = await liberarBachaDeOt({ otId });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Bacha liberada.");
    await reload();
    onChanged?.();
  };

  const onRegistrarBachaCliente = async () => {
    const nombre = (clienteNombre ?? "").trim();
    if (!nombre) {
      toast.error("La OT no tiene nombre de cliente.");
      return;
    }
    setBusy(true);
    try {
      const created = await createBachaInventario({
        origen: "cliente",
        cliente_nombre: nombre,
        cliente_id: clienteId,
        modelo: registrarModelo.trim() || bachaTipo || null,
        ubicacion: registrarUbicacion.trim() || null,
        estado: "disponible",
      });
      const asg = await asignarBachaAOt({
        bachaId: created.id,
        otId,
        clienteNombre: nombre,
        clienteId,
      });
      if (asg.error) throw asg.error;
      toast.success("Bacha del cliente registrada y asignada.");
      setRegistrarModelo(bachaTipo ?? "");
      setRegistrarUbicacion("");
      setDialogOpen(false);
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la bacha");
    } finally {
      setBusy(false);
    }
  };

  if (!mostrarBacha) return null;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-xs text-muted-foreground">Stock remoto no disponible en esta sesión.</p>
    );
  }

  const asignada = Boolean(bachaId) || Boolean(bachaAsignada);
  const origenLabel = origen === "cliente" ? "La trae el cliente" : "De nuestro stock";
  const colocacionLabel = bachaColocacion
    ? etiquetaTipoColocacion(bachaColocacion)
    : "Sin definir";
  const modeloAsignado =
    bachaAsignada?.modelo?.trim() || (cargando ? "Cargando…" : "Sin modelo");
  const clienteDeLaBacha = bachaAsignada?.cliente_nombre?.trim() || clienteNombre?.trim() || "";

  const elegirDelDeposito = (
    <div className="space-y-1.5">
      <div>
        <p className="text-xs font-medium text-foreground">
          {origen === "cliente" ? "Ya está en el depósito" : "Elegí del depósito"}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {origen === "cliente"
            ? "Si ya la cargaron a nombre de este cliente, elegila y asignala."
            : "Elegí una bacha de la empresa y asignala a esta orden."}
        </p>
      </div>
      {disponiblesDelOrigen.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={bachaSelectId} onValueChange={setBachaSelectId}>
            <SelectTrigger className="h-8 w-full text-xs sm:flex-1" aria-label="Bacha del depósito">
              <SelectValue placeholder="Elegí una bacha" />
            </SelectTrigger>
            <SelectContent>
              {disponiblesDelOrigen.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {etiquetaOpcionBacha(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 text-xs"
            disabled={busy || !bachaSelectId}
            onClick={() => void onAsignarBacha(bachaSelectId)}
          >
            Asignar a esta orden
          </Button>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
          {origen === "cliente"
            ? "Este cliente no tiene bachas cargadas en el depósito."
            : "No hay bachas de stock disponibles."}
        </p>
      )}
    </div>
  );

  if (soloAviso) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-card px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Bacha
          </p>
          <BadgeEstado ok={asignada} />
        </div>
        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
          <dt className="text-muted-foreground">Colocación</dt>
          <dd>{colocacionLabel}</dd>
          <dt className="text-muted-foreground">Origen</dt>
          <dd>{origenLabel}</dd>
          <dt className="text-muted-foreground">Asignada</dt>
          <dd className={asignada ? "font-medium" : "text-muted-foreground"}>
            {asignada
              ? modeloAsignado +
                (bachaAsignada?.origen === "cliente" && clienteDeLaBacha
                  ? ` · ${clienteDeLaBacha}`
                  : "")
              : "Todavía no"}
          </dd>
        </dl>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              Bacha
            </p>
            <BadgeEstado ok={asignada} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {colocacionLabel} · {origenLabel}
          </p>
          <p className={asignada ? "truncate text-xs font-medium" : "truncate text-xs text-muted-foreground"}>
            {asignada
              ? modeloAsignado +
                (bachaAsignada?.origen === "cliente" && clienteDeLaBacha
                  ? ` · ${clienteDeLaBacha}`
                  : "")
              : "Sin asignar"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          {asignada ? "Cambiar" : "Asignar"}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bacha</DialogTitle>
            <DialogDescription>
              {colocacionLabel}. Elegí quién la aporta y asignala a esta orden.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(28rem,70vh)] space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">¿Quién aporta la bacha?</Label>
              <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Quién aporta la bacha">
                <Button
                  type="button"
                  size="sm"
                  variant={origen === "propia" ? "default" : "outline"}
                  className="h-8 text-xs"
                  disabled={busy}
                  aria-pressed={origen === "propia"}
                  onClick={() => void onCambiarOrigen("propia")}
                >
                  De nuestro stock
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={origen === "cliente" ? "default" : "outline"}
                  className="h-8 text-xs"
                  disabled={busy}
                  aria-pressed={origen === "cliente"}
                  onClick={() => void onCambiarOrigen("cliente")}
                >
                  La trae el cliente
                </Button>
              </div>
            </div>

            {asignada ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Asignada a esta orden</p>
                    <p className="truncate text-xs font-medium">{modeloAsignado}</p>
                    {bachaAsignada?.origen === "cliente" && clienteDeLaBacha ? (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {clienteDeLaBacha} · no se vende
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 text-xs"
                    disabled={busy}
                    onClick={() => void onLiberarBacha()}
                  >
                    Liberar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Para elegir otra, primero liberala. Vuelve al depósito.
                </p>
              </div>
            ) : (
              <div className="space-y-3 border-t border-border pt-3">
                {elegirDelDeposito}
                {origen === "cliente" ? (
                  <>
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      o
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">Acaba de llegar</p>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Queda a nombre de {clienteNombre?.trim() || "este cliente"} y no se puede
                          vender. Se asigna a esta orden.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label htmlFor={`bacha-modelo-${otId}`} className="text-xs">
                            Modelo
                          </Label>
                          <Input
                            id={`bacha-modelo-${otId}`}
                            className="h-8 text-xs"
                            value={registrarModelo}
                            onChange={(e) => setRegistrarModelo(e.target.value)}
                            placeholder="Ej. Johnson 70"
                            disabled={busy}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`bacha-lugar-${otId}`} className="text-xs">
                            Dónde la guardamos
                          </Label>
                          <Input
                            id={`bacha-lugar-${otId}`}
                            className="h-8 text-xs"
                            value={registrarUbicacion}
                            onChange={(e) => setRegistrarUbicacion(e.target.value)}
                            placeholder="Opcional"
                            disabled={busy}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={busy || !clienteNombre?.trim()}
                        onClick={() => void onRegistrarBachaCliente()}
                      >
                        Registrar llegada y asignar
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
