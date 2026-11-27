import { describe, expect, it } from "vitest";
import {
  camposFaltantes,
  validarCamposObligatorios,
  validateOrdenesItems,
} from "@/components/presupuesto/wizard/validacion";
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

describe("validarCamposObligatorios", () => {
  const ot = () => ({ ...newOrdenTrabajo(""), titulo: "Cocina", direccionObra: "Lugones 232" });
  const base = () => ({
    clienteSeleccionadoId: "c1",
    tel: "2604040590",
    email: "a@b.com",
    contacto: "Genaro",
    vendedorId: "u1",
    ordenes: [ot()],
  });

  it("pasa con todo completo (observaciones, referencia, origen y comisión son opcionales)", () => {
    expect(validarCamposObligatorios(base())).toBeNull();
  });

  it("marca el paso 1 si falta un dato del cliente", () => {
    expect(validarCamposObligatorios({ ...base(), clienteSeleccionadoId: null })?.paso).toBe(1);
    expect(validarCamposObligatorios({ ...base(), email: "" })?.paso).toBe(1);
    expect(validarCamposObligatorios({ ...base(), email: "sin-arroba" })?.paso).toBe(1);
    expect(validarCamposObligatorios({ ...base(), contacto: " " })?.paso).toBe(1);
    expect(validarCamposObligatorios({ ...base(), vendedorId: "" })?.paso).toBe(1);
  });

  it("marca el paso 2 si falta la dirección de alguna OT", () => {
    const sinDir = { ...ot(), direccionObra: "" };
    expect(validarCamposObligatorios({ ...base(), ordenes: [sinDir] })?.paso).toBe(2);
    expect(validarCamposObligatorios({ ...base(), ordenes: [ot(), sinDir] })?.paso).toBe(2);
  });

  it("marca el paso 3 si una OT no tiene nombre", () => {
    expect(validarCamposObligatorios({ ...base(), ordenes: [{ ...ot(), titulo: "" }] })?.paso).toBe(3);
  });
});

describe("camposFaltantes", () => {
  it("marca cada campo vacío y las OTs que faltan completar", () => {
    const ok = { ...newOrdenTrabajo(""), key: "a", titulo: "Cocina", direccionObra: "X", materialId: "m1" };
    const mal = { ...newOrdenTrabajo(""), key: "b", titulo: "", direccionObra: "", materialId: "" };
    const f = camposFaltantes({
      clienteSeleccionadoId: null,
      tel: "",
      email: "x",
      contacto: "Ana",
      vendedorId: "u1",
      ordenes: [ok, mal],
      mecActivo: true,
      totalMecGlobal: "0",
    });
    expect(f.cliente && f.tel && f.email).toBe(true);
    expect(f.contacto || f.vendedor).toBe(false);
    expect([...f.direccion]).toEqual(["b"]);
    expect([...f.tituloOt]).toEqual(["b"]);
    expect([...f.material]).toEqual(["b"]);
    expect(f.mecImporte).toBe(true);
  });

  it("no marca el material si la piedra la pone el cliente", () => {
    const ot = { ...newOrdenTrabajo(""), key: "a", materialId: "", piedraDelCliente: true };
    const f = camposFaltantes({
      clienteSeleccionadoId: "c",
      tel: "1",
      email: "a@b.co",
      contacto: "A",
      vendedorId: "u",
      ordenes: [ot],
      mecActivo: false,
      totalMecGlobal: "0",
    });
    expect(f.material.size).toBe(0);
    expect(f.mecImporte).toBe(false);
  });
});
