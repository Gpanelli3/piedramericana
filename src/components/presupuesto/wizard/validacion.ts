import type { OrdenTrabajoWizard } from "./types";
import type { ArticuloConPrecio } from "@/types/articulos";
import {
  articuloConPrecioToMock,
  parseDecimalInput,
  todasOtsExcluyenMec,
} from "@/lib/presupuesto-calculos";

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

function tituloOt(ot: OrdenTrabajoWizard, index: number): string {
  return ot.titulo.trim() || `OT ${index + 1}`;
}

export function validateOrdenesItems(
  ordenes: OrdenTrabajoWizard[],
  articulos: ArticuloConPrecio[],
): string | null {
  for (let i = 0; i < ordenes.length; i++) {
    const ot = ordenes[i]!;
    const titulo = tituloOt(ot, i);

    if (ot.items.length === 0) {
      return `La OT «${titulo}» no tiene ítems. Agregá al menos uno.`;
    }

    for (const line of ot.items) {
      if (!line.articuloId?.trim()) {
        return `Hay una línea sin artículo en la OT «${titulo}».`;
      }

      const artBd = articulos.find((a) => a.id === line.articuloId);
      if (!artBd) {
        return `Un artículo de la OT «${titulo}» ya no está disponible.`;
      }

      const art = articuloConPrecioToMock(artBd);
      const qty = parseDecimalInput(line.cantidad);

      if (!art.calculaMaterial) {
        if (qty <= 0) {
          return `Indicá la cantidad en «${art.descripcion}» (OT «${titulo}»).`;
        }
        continue;
      }

      if (art.medidaEstandarM2 != null && art.medidaEstandarM2 > 0) {
        if (qty <= 0) {
          return `Indicá la cantidad en «${art.descripcion}» (OT «${titulo}»).`;
        }
        continue;
      }

      if (art.unidad === "M2") {
        if (line.modoIngreso === "manual") {
          if (qty <= 0) {
            return `Indicá los m² totales en «${art.descripcion}» (OT «${titulo}»).`;
          }
        } else {
          const alto = parseDecimalInput(line.altoM);
          const ancho = parseDecimalInput(line.anchoM);
          if (alto <= 0 || ancho <= 0) {
            return `Completá alto y ancho (metros) en «${art.descripcion}» (OT «${titulo}»).`;
          }
        }
        continue;
      }

      if (art.unidad === "ML" || art.unidad === "UNI") {
        if (qty <= 0) {
          return `Indicá la cantidad en «${art.descripcion}» (OT «${titulo}»).`;
        }
        continue;
      }

      if (qty <= 0) {
        return `Indicá la cantidad en «${art.descripcion}» (OT «${titulo}»).`;
      }
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
  if (todasOtsExcluyenMec(params.ordenes)) {
    return null;
  }
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
  articulos: ArticuloConPrecio[] = [],
): string | null {
  return (
    validateCliente(clienteSeleccionadoId) ??
    validateMaterialesOt(mecParams.ordenes) ??
    validateOrdenesItems(mecParams.ordenes, articulos) ??
    validateMecRequisitos(mecScope, mecParams)
  );
}
