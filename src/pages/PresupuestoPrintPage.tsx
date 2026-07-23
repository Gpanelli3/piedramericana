"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PresupuestoDocumento } from "@/components/presupuesto/PresupuestoDocumento";
import {
  getPresupuestoById,
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
import { ORIGEN_VENTA_OPCIONES } from "@/data/origen-venta";
import {
  mecAlgunoActivo,
  parseMoneyInput,
} from "@/components/presupuesto/wizard/validacion";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];

export function PresupuestoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(true);
  const [fila, setFila] = useState<PresupuestoRow | null>(null);
  const [articulos, setArticulos] = useState<ArticuloConPrecio[]>([]);
  const [materials, setMaterials] = useState<MaterialWizardRow[]>([]);

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

      const raw = row.payload;
      const listaId =
        raw && isPresupuestoPayloadV1(raw) ? raw.listaPrecioId : "";
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
  }, [id]);

  const payload =
    fila?.payload && isPresupuestoPayloadV1(fila.payload)
      ? hydratePresupuestoPayloadV1(fila.payload)
      : null;

  const origenLabel = useMemo(() => {
    if (!payload) return "";
    return (
      ORIGEN_VENTA_OPCIONES.find((o) => o.value === payload.origenVentas)?.label ??
      payload.origenVentas
    );
  }, [payload]);

  const volverVentas = useCallback(() => {
    navigate("/?ws=ventas&pv=list&ft=pendientes");
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-neutral-100 text-foreground print:bg-white">
      <div className="print:hidden border-b bg-background flex flex-wrap items-center gap-2 px-6 py-3">
        <Button type="button" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={volverVentas}>
          Volver a presupuestos
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 print:px-0 print:py-0">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Generando vista de impresión…</p>
        ) : !fila ? (
          <p className="text-sm text-muted-foreground">
            Presupuesto no disponible para imprimir.
          </p>
        ) : !payload ? (
          <p className="text-sm text-muted-foreground">
            El detalle de este presupuesto no permite renderizar esta versión para impresión.
          </p>
        ) : (
          <PresupuestoDocumento
            numero={fila.numero}
            fecha={new Date(fila.created_at).toLocaleDateString("es-AR")}
            clienteNombre={payload.clienteNombre || fila.cliente}
            contacto={payload.contacto}
            tel={payload.tel}
            email={payload.email}
            direccion={payload.direccion}
            observacion={payload.obsCabecera}
            origenLabel={origenLabel}
            moneda={payload.monedaPresupuesto}
            ordenes={payload.ordenes}
            articulos={articulos}
            materials={materials}
            descuentoPct={parseMoneyInput(payload.descuentoGlobalPct)}
            mMedicion={payload.mMedicionGlobal}
            mEntrega={payload.mEntregaGlobal}
            mColocacion={payload.mColocacionGlobal}
            totalMec={
              mecAlgunoActivo(
                payload.mMedicionGlobal,
                payload.mEntregaGlobal,
                payload.mColocacionGlobal,
              )
                ? parseMoneyInput(payload.totalMecGlobal)
                : 0
            }
            obsMec={payload.obsServiciosMec}
            className="shadow-sm border border-neutral-200 bg-white p-4 sm:p-5 print:shadow-none print:border-0 print:p-0"
          />
        )}
      </div>
    </div>
  );
}
