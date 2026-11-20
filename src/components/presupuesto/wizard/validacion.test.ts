import { describe, expect, it } from "vitest";
import { validateOrdenesItems } from "@/components/presupuesto/wizard/validacion";
import { newOrdenTrabajo } from "@/components/presupuesto/wizard/types";
import {
  articuloConPrecioToMock,
  buildLineaCalcInput,
  computeLineaPresupuesto,
} from "@/lib/presupuesto-calculos";
import { normalizeLineaItemFromPayload } from "@/lib/presupuesto-payload-normalize";
import type { ArticuloConPrecio } from "@/types/articulos";

const mo: ArticuloConPrecio = {
  id: "mo",
  codigo: "MO",
  descripcion: "Mano de obra",
  unidad: "UNI",
  calcula_material: false,
  medida_estandar_m2: null,
  prefer_modo_manual: false,
  sort_order: 0,
  precio: 500,
  moneda: "ars",
};

function ordenConLinea(patch: { precioUnitario: string; sinCargo?: boolean }) {
  const ot = newOrdenTrabajo("mat-1");
  ot.titulo = "Cocina";
  ot.items = [
    {
      key: "l1",
      articuloId: "mo",
      modoIngreso: "dimensiones",
      cantidad: "1",
      altoM: "0",
      anchoM: "0",
      desperdicioPct: "0",
      ...patch,
    },
  ];
  return ot;
}

describe("validateOrdenesItems · precio de línea", () => {
  it("bloquea una línea sin precio", () => {
    const msg = validateOrdenesItems([ordenConLinea({ precioUnitario: "" })], [mo]);
    expect(msg).toContain("Cargá el precio");
  });

  it("bloquea una línea con precio 0", () => {
    const msg = validateOrdenesItems([ordenConLinea({ precioUnitario: "0" })], [mo]);
    expect(msg).toContain("Cargá el precio");
  });

  it("acepta una línea con precio", () => {
    expect(validateOrdenesItems([ordenConLinea({ precioUnitario: "500" })], [mo])).toBeNull();
  });

  it("acepta una línea marcada sin cargo", () => {
    expect(
      validateOrdenesItems([ordenConLinea({ precioUnitario: "", sinCargo: true })], [mo]),
    ).toBeNull();
  });
});

describe("sin cargo", () => {
  it("el subtotal de una línea sin cargo es 0 aunque tenga precio escrito", () => {
    const art = articuloConPrecioToMock(mo);
    const line = {
      articuloId: "mo",
      modoIngreso: "dimensiones" as const,
      cantidad: "3",
      precioUnitario: "500",
      altoM: "0",
      anchoM: "0",
      desperdicioPct: "0",
      sinCargo: true,
    };
    expect(computeLineaPresupuesto(art, buildLineaCalcInput(art, line)).subtotal).toBe(0);
    expect(
      computeLineaPresupuesto(art, buildLineaCalcInput(art, { ...line, sinCargo: false })).subtotal,
    ).toBe(1500);
  });

  it("se conserva al guardar y volver a abrir el presupuesto", () => {
    const linea = normalizeLineaItemFromPayload({
      key: "l1",
      articuloId: "mo",
      cantidad: "1",
      precioUnitario: "0",
      sinCargo: true,
    });
    expect(linea.sinCargo).toBe(true);
    expect(normalizeLineaItemFromPayload({ key: "l2", precioUnitario: "10" }).sinCargo).toBeUndefined();
  });
});
