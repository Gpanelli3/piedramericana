import type { LineaResumenMoneda } from "@/components/presupuesto/PresupuestoResumenInterior";
import type { LogisticaPresupuesto, OrdenTrabajoWizard } from "./types";

/**
 * Presupuesto nuevo a medio cargar, guardado en esta computadora para poder
 * retomarlo si se cierra la pantalla sin guardar. Solo para altas, no edición.
 */
export type BorradorPresupuesto = {
  version: 1;
  guardadoEn: number;
  /** Para el aviso de retomar. */
  resumen: { cliente: string; articulos: string[] };
  datos: {
    clienteSeleccionadoId: string | null;
    contacto: string;
    origenVentas: string;
    vendedorId: string;
    comisionPct: string;
    tel: string;
    email: string;
    direccion: string;
    obsCabecera: string;
    listaPrecioId: string;
    cotizacionMixtaActiva: boolean;
    monedaFinal: string;
    ordenes: OrdenTrabajoWizard[];
    descuentoGlobalPct: string;
    logistica: LogisticaPresupuesto;
    mMedicionGlobal: boolean;
    mEntregaGlobal: boolean;
    mColocacionGlobal: boolean;
    totalMecGlobal: string;
    obsServiciosMec: string;
    lineasResumen: LineaResumenMoneda[];
  };
};

const PREFIJO = "marmogest:borrador-presupuesto:";

function clave(userId: string | null | undefined): string {
  return `${PREFIJO}${userId ?? "anon"}`;
}

export function leerBorrador(userId: string | null | undefined): BorradorPresupuesto | null {
  try {
    const raw = window.localStorage.getItem(clave(userId));
    if (!raw) return null;
    const b = JSON.parse(raw) as BorradorPresupuesto;
    if (b?.version !== 1 || !b.datos || !Array.isArray(b.datos.ordenes)) return null;
    return b;
  } catch {
    return null;
  }
}

export function guardarBorrador(
  userId: string | null | undefined,
  borrador: BorradorPresupuesto,
): void {
  try {
    window.localStorage.setItem(clave(userId), JSON.stringify(borrador));
  } catch {
    // Sin espacio o almacenamiento bloqueado: el formulario sigue funcionando igual.
  }
}

export function borrarBorrador(userId: string | null | undefined): void {
  try {
    window.localStorage.removeItem(clave(userId));
  } catch {
    // ignorar
  }
}

/** ¿Hay algo cargado que valga la pena guardar? */
export function borradorTieneContenido(d: BorradorPresupuesto["datos"]): boolean {
  if (d.clienteSeleccionadoId) return true;
  if (d.obsCabecera.trim()) return true;
  return d.ordenes.some(
    (o) =>
      Boolean(o.materialId) ||
      Boolean(o.materialLibre?.trim()) ||
      Boolean(o.direccionObra.trim()) ||
      o.items.some((l) => Boolean(l.articuloId)),
  );
}

/** "hoy a las 16:38", "ayer a las 16:38" o "el 24/11 a las 16:38". */
export function cuandoSeGuardo(ts: number, ahora = Date.now()): string {
  const d = new Date(ts);
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const dia = 24 * 60 * 60 * 1000;
  if (ts >= inicioHoy.getTime()) return `hoy a las ${hora}`;
  if (ts >= inicioHoy.getTime() - dia) return `ayer a las ${hora}`;
  const fecha = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  return `el ${fecha} a las ${hora}`;
}
