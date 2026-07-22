import type { OrdenTrabajoWizard } from "./types";

export const MSG_MEC_INCORRECTO =
  "El costo del servicio MEC es incorrecto. Si tenés tildada medición, entrega o colocación, cargá un importe mayor a cero o destildá los servicios que no correspondan.";

export function parseMoneyInput(v: string): number {
  const t = v.trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export function mecAlgunoActivo(m: boolean, e: boolean, c: boolean): boolean {
  return m || e || c;
}

export function validarTotalMecSiAplica(
  m: boolean,
  e: boolean,
  c: boolean,
  totalStr: string,
): boolean {
  if (!mecAlgunoActivo(m, e, c)) return true;
  return parseMoneyInput(totalStr) > 0;
}

export function validateCliente(
  clienteSeleccionadoId: string | null,
): string | null {
  if (!clienteSeleccionadoId) {
    return "Seleccioná un cliente de la lista o cargá uno nuevo con +.";
  }
  return null;
}

/** @deprecated Usar validateCliente. Origen ya no es obligatorio. */
export function validateClienteYOrigen(
  clienteSeleccionadoId: string | null,
  _origenVentas?: string,
): string | null {
  return validateCliente(clienteSeleccionadoId);
}

export function validateMaterialesOt(
  ordenes: OrdenTrabajoWizard[],
): string | null {
  for (const ot of ordenes) {
    if (!ot.materialId?.trim()) {
      const titulo = ot.titulo.trim() || "sin título";
      return `Elegí un material (chapa) para la OT «${titulo}».`;
    }
  }
  return null;
}

export function validateMecRequisitos(
  mecScope: "global" | "por_ot",
  params: {
    mMedicionGlobal: boolean;
    mEntregaGlobal: boolean;
    mColocacionGlobal: boolean;
    totalMecGlobal: string;
    ordenes: OrdenTrabajoWizard[];
  },
): string | null {
  if (mecScope === "global") {
    if (
      !validarTotalMecSiAplica(
        params.mMedicionGlobal,
        params.mEntregaGlobal,
        params.mColocacionGlobal,
        params.totalMecGlobal,
      )
    ) {
      return MSG_MEC_INCORRECTO;
    }
  } else {
    for (const ot of params.ordenes) {
      if (
        !validarTotalMecSiAplica(
          ot.mMedicion,
          ot.mEntrega,
          ot.mColocacion,
          ot.totalMec,
        )
      ) {
        return MSG_MEC_INCORRECTO;
      }
    }
  }
  return null;
}

export function validarPresupuestoCompleto(
  clienteSeleccionadoId: string | null,
  _origenVentas: string,
  mecScope: "global" | "por_ot",
  mecParams: {
    mMedicionGlobal: boolean;
    mEntregaGlobal: boolean;
    mColocacionGlobal: boolean;
    totalMecGlobal: string;
    ordenes: OrdenTrabajoWizard[];
  },
): string | null {
  return (
    validateCliente(clienteSeleccionadoId) ??
    validateMaterialesOt(mecParams.ordenes) ??
    validateMecRequisitos(mecScope, mecParams)
  );
}
