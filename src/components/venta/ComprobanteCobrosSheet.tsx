"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CobrosComprobanteDocumento,
  CobrosComprobanteUnico,
} from "@/components/venta/CobrosComprobanteDocumento";
import type { ClienteFichaMovimiento } from "@/lib/clients-api";
import {
  loadCobrosComprobante,
  type CobrosComprobanteDatos,
} from "@/lib/cobros-comprobante";
import { descargarElementoComoPdf, elementoComoPdfBlob } from "@/lib/descargar-pdf";
import { etiquetaMetodo } from "@/lib/finanzas-api";
import { formatMoneyAr } from "@/lib/presupuesto-detalle";
import { urlWhatsapp } from "@/lib/whatsapp";

type TabVista = "unico" | "resumen";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento: ClienteFichaMovimiento | null;
  telCliente?: string;
};

function resumenTexto(datos: CobrosComprobanteDatos): string {
  return [
    `Comprobante de cobros ${datos.numeroPresupuesto}`,
    datos.clienteNombre,
    `Cobrado ${formatMoneyAr(datos.cobrado, datos.moneda)}`,
    `Saldo ${formatMoneyAr(datos.saldo, datos.moneda)}`,
  ].join(" · ");
}

function unicoTexto(
  datos: CobrosComprobanteDatos,
  movimiento: ClienteFichaMovimiento,
): string {
  if (movimiento.tipo === "pago") {
    const pago = datos.pagos.find((p) => p.id === movimiento.id);
    const monto = pago?.monto ?? movimiento.haber;
    const metodo = etiquetaMetodo(pago?.metodo ?? movimiento.metodo);
    return [
      `Recibo de pago ${datos.numeroPresupuesto}`,
      datos.clienteNombre,
      formatMoneyAr(monto, movimiento.moneda),
      metodo,
    ].join(" · ");
  }
  return [
    `Cargo ${datos.numeroPresupuesto}`,
    datos.clienteNombre,
    formatMoneyAr(movimiento.debe, movimiento.moneda),
  ].join(" · ");
}

function nombreArchivo(datos: CobrosComprobanteDatos, tab: TabVista, movimiento: ClienteFichaMovimiento | null) {
  if (tab === "unico" && movimiento) {
    const dia = movimiento.fecha.slice(0, 10).replace(/-/g, "");
    const prefijo = movimiento.tipo === "pago" ? "Recibo" : "Cargo";
    return `${prefijo}_${datos.numeroPresupuesto}_${dia}`;
  }
  return `Comprobante_${datos.numeroPresupuesto}`;
}

function puedeCompartirArchivo(file: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };
  if (typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function ComprobanteCobrosSheet({
  open,
  onOpenChange,
  movimiento,
  telCliente = "",
}: Props) {
  const docRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabVista>("unico");
  const [cargando, setCargando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [datos, setDatos] = useState<CobrosComprobanteDatos | null>(null);

  const presupuestoId = movimiento?.presupuestoId ?? null;

  useEffect(() => {
    if (!open) return;
    setTab("unico");
  }, [open, movimiento?.id]);

  useEffect(() => {
    if (!open) return;
    if (!presupuestoId) {
      setDatos(null);
      return;
    }
    let cancelled = false;
    setCargando(true);
    void loadCobrosComprobante(presupuestoId).then((res) => {
      if (cancelled) return;
      if (res.error) {
        toast.error(res.error.message);
        setDatos(null);
      } else {
        setDatos(res.data);
      }
      setCargando(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, presupuestoId]);

  const textoCompartir = useCallback(() => {
    if (!datos) return "";
    if (tab === "unico" && movimiento) return unicoTexto(datos, movimiento);
    return resumenTexto(datos);
  }, [datos, movimiento, tab]);

  const descargar = useCallback(async () => {
    const el = docRef.current;
    if (!el || !datos) {
      toast.error("El comprobante todavía no está listo.");
      return;
    }
    setBusy(true);
    try {
      await descargarElementoComoPdf(el, nombreArchivo(datos, tab, movimiento));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setBusy(false);
    }
  }, [datos, movimiento, tab]);

  const compartir = useCallback(async () => {
    const el = docRef.current;
    if (!el || !datos) {
      toast.error("El comprobante todavía no está listo.");
      return;
    }
    setBusy(true);
    try {
      const { blob, filename } = await elementoComoPdfBlob(
        el,
        nombreArchivo(datos, tab, movimiento),
      );
      const file = new File([blob], filename, { type: "application/pdf" });
      const texto = textoCompartir();
      const nav = navigator as Navigator & {
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };

      if (puedeCompartirArchivo(file) && typeof nav.share === "function") {
        await nav.share({ files: [file], title: texto, text: texto });
        return;
      }

      const wa = urlWhatsapp(telCliente);
      if (wa) {
        window.open(`${wa}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
        return;
      }

      await navigator.clipboard.writeText(texto);
      toast.success("Resumen copiado.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "No se pudo compartir el comprobante.");
    } finally {
      setBusy(false);
    }
  }, [datos, movimiento, tab, telCliente, textoCompartir]);

  const pagoUnico =
    movimiento?.tipo === "pago" && datos
      ? datos.pagos.find((p) => p.id === movimiento.id)
      : null;

  const tituloUnico = movimiento?.tipo === "cargo" ? "Este cargo" : "Este pago";
  const descripcion = datos
    ? tab === "unico" && movimiento
      ? `${movimiento.tipo === "pago" ? "Recibo" : "Cargo"} ${datos.numeroPresupuesto} · ${datos.clienteNombre}`
      : `${datos.numeroPresupuesto} · ${datos.clienteNombre}`
    : "Comprobante para descargar y compartir con el cliente.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden bg-stone-50 p-0 sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="shrink-0 space-y-3 border-b border-border px-6 py-4 pr-12 text-left">
          <SheetTitle>
            {tab === "unico" && movimiento?.tipo === "pago"
              ? "Recibo de pago"
              : tab === "unico" && movimiento?.tipo === "cargo"
                ? "Cargo a cuenta"
                : "Resumen de cobros"}
          </SheetTitle>
          <SheetDescription>{descripcion}</SheetDescription>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={!datos || cargando || busy}
              onClick={() => void descargar()}
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={!datos || cargando || busy}
              onClick={() => void compartir()}
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartir
            </Button>
          </div>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v === "resumen" ? "resumen" : "unico")}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="shrink-0 border-b border-border px-6 py-2">
            <TabsList>
              <TabsTrigger value="unico">{tituloUnico}</TabsTrigger>
              <TabsTrigger value="resumen">Todos los cobros</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {cargando ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Generando comprobante…
              </p>
            ) : !datos || !movimiento ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Presupuesto no disponible para el comprobante.
              </p>
            ) : (
              <>
                <TabsContent value="unico" className="mt-0">
                  <div ref={tab === "unico" ? docRef : undefined}>
                    <CobrosComprobanteUnico
                      className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5"
                      tipo={movimiento.tipo}
                      numeroPresupuesto={datos.numeroPresupuesto}
                      clienteNombre={datos.clienteNombre}
                      contacto={datos.contacto}
                      tel={datos.tel}
                      email={datos.email}
                      fecha={pagoUnico?.fecha ?? movimiento.fecha}
                      moneda={pagoUnico?.moneda ?? movimiento.moneda}
                      monto={
                        movimiento.tipo === "pago"
                          ? (pagoUnico?.monto ?? movimiento.haber)
                          : movimiento.debe
                      }
                      metodo={pagoUnico?.metodo ?? movimiento.metodo}
                      nota={pagoUnico?.nota ?? movimiento.nota}
                      retencionMonto={pagoUnico?.retencionMonto}
                      retencionPorcentaje={pagoUnico?.retencionPorcentaje}
                      totalObra={datos.total}
                      cobradoObra={datos.cobrado}
                      saldoObra={datos.saldo}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="resumen" className="mt-0">
                  <div ref={tab === "resumen" ? docRef : undefined}>
                    <CobrosComprobanteDocumento
                      className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5"
                      numeroPresupuesto={datos.numeroPresupuesto}
                      clienteNombre={datos.clienteNombre}
                      contacto={datos.contacto}
                      tel={datos.tel}
                      email={datos.email}
                      etapaLabel={datos.etapaLabel}
                      moneda={datos.moneda}
                      total={datos.total}
                      cobrado={datos.cobrado}
                      saldo={datos.saldo}
                      pagos={datos.pagos}
                      fechaEmision={new Date().toLocaleDateString("es-AR")}
                    />
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
