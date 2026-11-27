import type { OrdenTrabajoWizard } from "./types";
import { validateBachasOrdenes } from "./bacha-lineas";
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

/**
 * Campos que tienen que estar completos para guardar. Quedan opcionales:
 * observaciones (generales y MEC), "¿Con qué cotizaste?", referencia, origen y comisión.
 * Devuelve el paso del formulario donde está lo que falta (1 cliente, 2 obra, 3 artículos).
 */
export function validarCamposObligatorios(p: {
  clienteSeleccionadoId: string | null;
  tel: string;
  email: string;
  contacto: string;
  vendedorId: string;
  ordenes: OrdenTrabajoWizard[];
}): { mensaje: string; paso: 1 | 2 | 3 } | null {
  const cliente = validateCliente(p.clienteSeleccionadoId);
  if (cliente) return { mensaje: cliente, paso: 1 };
  if (!p.tel.trim()) return { mensaje: "Cargá el teléfono.", paso: 1 };
  if (!p.email.trim()) return { mensaje: "Cargá el email.", paso: 1 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
    return { mensaje: "Revisá el email: no parece válido.", paso: 1 };
  }
  if (!p.contacto.trim()) return { mensaje: "Cargá el contacto.", paso: 1 };
  if (!p.vendedorId.trim()) return { mensaje: "Elegí el vendedor.", paso: 1 };

  const conDireccion = p.ordenes.length > 1 ? p.ordenes : p.ordenes.slice(0, 1);
  for (const [i, ot] of conDireccion.entries()) {
    if (!ot.direccionObra.trim()) {
      const cual = p.ordenes.length > 1 ? ` de ${tituloOt(ot, i)}` : "";
      return { mensaje: `Cargá la dirección de obra${cual}.`, paso: 2 };
    }
  }

  for (const [i, ot] of p.ordenes.entries()) {
    if (!ot.titulo.trim()) {
      return { mensaje: `Poné un nombre a la OT ${i + 1}.`, paso: 3 };
    }
  }
  return null;
}

export type CamposFaltantes = {
  cliente: boolean;
  tel: boolean;
  email: boolean;
  contacto: boolean;
  vendedor: boolean;
  /** keys de las OTs sin dirección de obra. */
  direccion: Set<string>;
  /** keys de las OTs sin nombre. */
  tituloOt: Set<string>;
  /** keys de las OTs sin material (salvo piedra del cliente). */
  material: Set<string>;
  mecImporte: boolean;
};

/** Qué campos marcar en rojo al intentar confirmar o compartir. */
export function camposFaltantes(p: {
  clienteSeleccionadoId: string | null;
  tel: string;
  email: string;
  contacto: string;
  vendedorId: string;
  ordenes: OrdenTrabajoWizard[];
  mecActivo: boolean;
  totalMecGlobal: string;
}): CamposFaltantes {
  const email = p.email.trim();
  const conDireccion = p.ordenes.length > 1 ? p.ordenes : p.ordenes.slice(0, 1);
  return {
    cliente: !p.clienteSeleccionadoId,
    tel: !p.tel.trim(),
    email: !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    contacto: !p.contacto.trim(),
    vendedor: !p.vendedorId.trim(),
    direccion: new Set(conDireccion.filter((o) => !o.direccionObra.trim()).map((o) => o.key)),
    tituloOt: new Set(p.ordenes.filter((o) => !o.titulo.trim()).map((o) => o.key)),
    material: new Set(
      p.ordenes.filter((o) => !o.piedraDelCliente && !o.materialId?.trim()).map((o) => o.key),
    ),
    mecImporte: p.mecActivo && !(parseMoneyInput(p.totalMecGlobal) > 0),
  };
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
    if (ot.piedraDelCliente) continue;
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

      if (!line.sinCargo && parseDecimalInput(line.precioUnitario) <= 0) {
        return `Cargá el precio de «${art.descripcion}» (OT «${titulo}») o marcá la línea como «sin cargo».`;
      }

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

      if (art.unidad === "ML" || art.unidad === "UNI" || art.unidad === "PIEZA" || art.unidad === "KG" || art.unidad === "TON") {
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
    validateBachasOrdenes(mecParams.ordenes, articulos) ??
    validateMecRequisitos(mecScope, mecParams)
  );
}
