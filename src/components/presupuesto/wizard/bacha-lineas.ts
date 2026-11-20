import type { ArticuloConPrecio } from "@/types/articulos";
import { newEmptyLineaItem, type LineaItemOT, type OrdenTrabajoWizard } from "./types";

/**
 * Cobro de bacha en el presupuesto:
 * - Nuestra: se cobra la bacha (artículo BACHA) + la mano de obra de colocarla (BACHA_MO).
 * - Del cliente: solo la mano de obra (BACHA_MO).
 */
export const CODIGO_BACHA = "BACHA";
export const CODIGO_BACHA_MO = "BACHA_MO";

function normCodigo(c: string | null | undefined): string {
  return (c ?? "").trim().toUpperCase();
}

function articuloPorCodigo(
  articulos: ArticuloConPrecio[],
  codigo: string,
): ArticuloConPrecio | undefined {
  return articulos.find((a) => normCodigo(a.codigo) === codigo);
}

function lineaDeArticulo(articulo: ArticuloConPrecio): LineaItemOT {
  return {
    ...newEmptyLineaItem(),
    articuloId: articulo.id,
    modoIngreso: "dimensiones",
    cantidad: "1",
    precioUnitario:
      articulo.precio != null && Number.isFinite(articulo.precio) ? String(articulo.precio) : "",
    altoM: "0",
    anchoM: "0",
    desperdicioPct: "0",
  };
}

/**
 * Ajusta las líneas de bacha de una orden según «Lleva bacha» y el origen:
 * agrega las que faltan y quita las que no corresponden. Devuelve la misma orden si no hay cambios.
 */
export function ajustarLineasBacha(
  orden: OrdenTrabajoWizard,
  articulos: ArticuloConPrecio[],
): OrdenTrabajoWizard {
  const artBacha = articuloPorCodigo(articulos, CODIGO_BACHA);
  const artMo = articuloPorCodigo(articulos, CODIGO_BACHA_MO);
  const esBacha = (l: LineaItemOT) => Boolean(artBacha) && l.articuloId === artBacha!.id;
  const esMo = (l: LineaItemOT) => Boolean(artMo) && l.articuloId === artMo!.id;

  let items = orden.items;

  if (!orden.llevaBacha) {
    items = items.filter((l) => !esBacha(l) && !esMo(l));
    if (items.length === orden.items.length) return orden;
    return { ...orden, items: items.length > 0 ? items : [newEmptyLineaItem()] };
  }

  const agregar: LineaItemOT[] = [];
  if (orden.bachaOrigen === "propia") {
    if (artBacha && !items.some(esBacha)) agregar.push(lineaDeArticulo(artBacha));
  } else {
    items = items.filter((l) => !esBacha(l));
  }
  if (artMo && !items.some(esMo)) agregar.push(lineaDeArticulo(artMo));

  if (agregar.length === 0 && items.length === orden.items.length) return orden;

  // Si la única línea es un renglón vacío, lo reemplazamos en vez de dejarlo suelto.
  const soloVacia = items.length === 1 && !items[0]!.articuloId;
  return { ...orden, items: [...(soloVacia ? [] : items), ...agregar] };
}

/** Valida que cada orden con bacha tenga las líneas de cobro que corresponden. */
export function validateBachasOrdenes(
  ordenes: OrdenTrabajoWizard[],
  articulos: ArticuloConPrecio[],
): string | null {
  const artBacha = articuloPorCodigo(articulos, CODIGO_BACHA);
  const artMo = articuloPorCodigo(articulos, CODIGO_BACHA_MO);

  for (let i = 0; i < ordenes.length; i++) {
    const ot = ordenes[i]!;
    if (!ot.llevaBacha) continue;
    const titulo = ot.titulo.trim() || `OT ${i + 1}`;

    if (!artMo) {
      return "Falta el artículo «Bacha (mano de obra)». Activalo en Artículos para poder presupuestar bachas.";
    }
    if (!ot.items.some((l) => l.articuloId === artMo.id)) {
      return `La OT «${titulo}» lleva bacha: agregá la línea «${artMo.descripcion}».`;
    }

    if (ot.bachaOrigen === "propia") {
      if (!artBacha) {
        return "Falta el artículo «Bacha» en Artículos para cobrar la bacha nuestra.";
      }
      if (!ot.items.some((l) => l.articuloId === artBacha.id)) {
        return `La OT «${titulo}» lleva bacha nuestra: agregá la línea «${artBacha.descripcion}».`;
      }
    } else if (artBacha && ot.items.some((l) => l.articuloId === artBacha.id)) {
      return `La bacha de la OT «${titulo}» la trae el cliente: quitá la línea «${artBacha.descripcion}», solo se cobra la mano de obra.`;
    }
  }
  return null;
}
