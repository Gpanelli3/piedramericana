"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HojaDeTrabajoDocumento } from "@/components/presupuesto/HojaDeTrabajoDocumento";
import {
  getPresupuestoById,
  getPresupuestoVersion,
  listArticulos,
  listArticulosConPrecios,
} from "@/lib/presupuestos-api";
import { listMaterials } from "@/lib/materials-api";
import type { Database } from "@/types/database";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { MaterialWizardRow } from "@/types/material-catalog";
import {
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
} from "@/types/presupuesto-payload";
import { descargarElementoComoPdf } from "@/lib/descargar-pdf";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

export function HojaTrabajoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoDescargar = searchParams.get("descargar") === "1";
  const vnParam = searchParams.get("vn");
  const vnPedido = (() => {
    if (!vnParam) return null;
    const n = Number.parseInt(vnParam, 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  })();
  const autoPrintDone = useRef(false);
  const docPdfRef = useRef<HTMLDivElement>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [fila, setFila] = useState<PresupuestoRow | null>(null);
  const [articulos, setArticulos] = useState<ArticuloConPrecio[]>([]);
  const [materials, setMaterials] = useState<MaterialWizardRow[]>([]);
  const [payloadHistorico, setPayloadHistorico] = useState<
    ReturnType<typeof hydratePresupuestoPayloadV1> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCargando(true);
      if (!id) {
        setFila(null);
        setCargando(false);
        return;
      }
      const res = await getPresupuestoById(id);
      if (cancelled) return;
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "No encontramos ese presupuesto.");
        setFila(null);
        setCargando(false);
        return;
      }
      const row = res.data as PresupuestoRow;
      setFila(row);

      if (vnPedido != null) {
        const ver = await getPresupuestoVersion(id, vnPedido);
        if (cancelled) return;
        if (!ver.error && ver.data) setPayloadHistorico(ver.data.payload);
        else setPayloadHistorico(null);
      } else {
        setPayloadHistorico(null);
      }

      const raw = row.payload;
      const listaId = raw && isPresupuestoPayloadV1(raw) ? raw.listaPrecioId : "";
      const [artsRes, matsRes] = await Promise.all([
        listaId ? listArticulosConPrecios(listaId) : listArticulos(),
        listMaterials(),
      ]);
      if (cancelled) return;
      if (artsRes.error || !artsRes.data) {
        const plain = await listArticulos();
        if (!cancelled) setArticulos(plain.data ?? []);
      } else {
        setArticulos(artsRes.data);
      }
      setMaterials(matsRes.data ?? []);
      setCargando(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, vnPedido]);

  const descargarPdf = useCallback(async () => {
    const el = docPdfRef.current;
    if (!el || !fila) {
      toast.error("La hoja de trabajo todavía no está lista para descargar.");
      return;
    }
    setDescargandoPdf(true);
    try {
      await descargarElementoComoPdf(el, `Hoja_trabajo_${fila.numero}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setDescargandoPdf(false);
    }
  }, [fila]);

  const descargarPdfRef = useRef(descargarPdf);
  descargarPdfRef.current = descargarPdf;

  useEffect(() => {
    if (!autoDescargar || cargando || !fila || autoPrintDone.current) return;
    const t = window.setTimeout(() => {
      autoPrintDone.current = true;
      void descargarPdfRef.current();
    }, 400);
    return () => window.clearTimeout(t);
  }, [autoDescargar, cargando, fila]);

  const payloadVigente =
    fila?.payload && isPresupuestoPayloadV1(fila.payload)
      ? hydratePresupuestoPayloadV1(fila.payload)
      : null;
  const payload = payloadHistorico ?? payloadVigente;

  const volverVentas = useCallback(() => {
    navigate("/?ws=ventas&pv=list&ft=pendientes");
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-neutral-100 text-foreground print:bg-white">
      <div className="print:hidden border-b bg-background flex flex-wrap items-center gap-2 px-6 py-3">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={cargando || !fila || !payload || descargandoPdf}
          onClick={() => void descargarPdf()}
        >
          <Download className="h-4 w-4" aria-hidden />
          {descargandoPdf ? "Generando…" : "Descargar PDF"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={volverVentas}>
          Volver a presupuestos
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 print:px-0 print:py-0">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Generando hoja de trabajo…</p>
        ) : !fila ? (
          <p className="text-sm text-muted-foreground">Presupuesto no disponible.</p>
        ) : !payload ? (
          <p className="text-sm text-muted-foreground">
            El detalle de este presupuesto no permite renderizar la hoja de trabajo.
          </p>
        ) : (
          <div ref={docPdfRef}>
            <HojaDeTrabajoDocumento
              numero={fila.numero}
              fecha={new Date(fila.created_at).toLocaleDateString("es-AR")}
              clienteNombre={payload.clienteNombre || fila.cliente}
              direccion={payload.direccion}
              contacto={payload.contacto}
              tel={payload.tel}
              vendedorLabel={payload.vendedorNombre ?? ""}
              payload={payload}
              articulos={articulos}
              materials={materials}
              className="shadow-sm border border-neutral-200 bg-white p-5 print:shadow-none print:border-0 print:p-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}