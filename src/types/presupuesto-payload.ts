import type { LineaResumenMoneda } from "@/components/presupuesto/PresupuestoResumenInterior";
import type {
  LogisticaPresupuesto,
  OrdenTrabajoWizard,
} from "@/components/presupuesto/wizard/types";
import { normalizeOrdenesFromPayload } from "@/lib/presupuesto-payload-normalize";

export const PRESUPUESTO_PAYLOAD_VERSION = 1 as const;

/**
 * Snapshot del wizard guardado en `presupuestos.payload` (jsonb).
 */
export type PresupuestoPayloadV1 = {
  version: typeof PRESUPUESTO_PAYLOAD_VERSION;
  dolarHoy: number;
  clienteId: string | null;
  clienteNombre: string;
  contacto: string;
  origenVentas: string;
  tel: string;
  email: string;
  direccion: string;
  obsCabecera: string;
  listaPrecioId: string;
  monedaPresupuesto: "ars" | "usd";
  ordenes: OrdenTrabajoWizard[];
  descuentoGlobalPct: string;
  logistica: LogisticaPresupuesto;
  mMedicionGlobal: boolean;
  mEntregaGlobal: boolean;
  mColocacionGlobal: boolean;
  totalMecGlobal: string;
  obsServiciosMec: string;
  lineasResumen: LineaResumenMoneda[];
  cotizacionMixtaActiva: boolean;
  monedaFinal: string;
  totalUsdEquivalente: number;
  totalArsEquivalente: number;
  materialM2Presupuesto: number;
  materialTonEstimadoPresupuesto: number | null;
  totalPresupuesto: number;
};

export function isPresupuestoPayloadV1(x: unknown): x is PresupuestoPayloadV1 {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as PresupuestoPayloadV1).version === PRESUPUESTO_PAYLOAD_VERSION
  );
}

/** Normaliza OTs/ítems de payloads guardados (compat. alto/ancho en cm). */
export function hydratePresupuestoPayloadV1(payload: PresupuestoPayloadV1): PresupuestoPayloadV1 {
  return {
    ...payload,
    ordenes: normalizeOrdenesFromPayload(payload.ordenes),
  };
}
