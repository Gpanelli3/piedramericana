import { describe, expect, it } from "vitest";
import {
  ajustarLineasBacha,
  validateBachasOrdenes,
} from "@/components/presupuesto/wizard/bacha-lineas";
import { newOrdenTrabajo } from "@/components/presupuesto/wizard/types";
import type { ArticuloConPrecio } from "@/types/articulos";

function art(id: string, codigo: string, descripcion: string, precio: number | null): ArticuloConPrecio {
  return {
    id,
    codigo,
    descripcion,
    unidad: "UNI",
    calcula_material: false,
    medida_estandar_m2: null,
    prefer_modo_manual: false,
    sort_order: 0,
    precio,
    moneda: "ars",
  };
}

const bacha = art("a-bacha", "BACHA", "Bacha", 80000);
const mo = art("a-mo", "BACHA_MO", "Bacha (mano de obra)", 15000);
const articulos = [bacha, mo];

function orden(patch: { llevaBacha: boolean; bachaOrigen: "propia" | "cliente" }) {
  const ot = newOrdenTrabajo("mat-1");
  ot.titulo = "Cocina";
  return { ...ot, ...patch };
}

describe("ajustarLineasBacha", () => {
  it("bacha nuestra: agrega bacha + mano de obra con el precio de la lista", () => {
    const next = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "propia" }), articulos);
    expect(next.items.map((l) => l.articuloId)).toEqual(["a-bacha", "a-mo"]);
    expect(next.items.map((l) => l.precioUnitario)).toEqual(["80000", "15000"]);
  });

  it("bacha del cliente: solo mano de obra", () => {
    const next = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "cliente" }), articulos);
    expect(next.items.map((l) => l.articuloId)).toEqual(["a-mo"]);
  });

  it("pasar de nuestra a cliente quita la línea de bacha y deja la mano de obra", () => {
    const propia = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "propia" }), articulos);
    const cliente = ajustarLineasBacha({ ...propia, bachaOrigen: "cliente" }, articulos);
    expect(cliente.items.map((l) => l.articuloId)).toEqual(["a-mo"]);
  });

  it("destildar «lleva bacha» quita las líneas y deja un renglón vacío", () => {
    const con = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "propia" }), articulos);
    const sin = ajustarLineasBacha({ ...con, llevaBacha: false }, articulos);
    expect(sin.items).toHaveLength(1);
    expect(sin.items[0]?.articuloId).toBe("");
  });

  it("no duplica líneas si ya existen y devuelve la misma orden", () => {
    const con = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "propia" }), articulos);
    expect(ajustarLineasBacha(con, articulos)).toBe(con);
  });

  it("deja el precio vacío si el artículo no tiene precio en la lista", () => {
    const sinPrecio = [art("a-bacha", "BACHA", "Bacha", null), mo];
    const next = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "propia" }), sinPrecio);
    expect(next.items[0]?.precioUnitario).toBe("");
  });
});

describe("validateBachasOrdenes", () => {
  it("no valida nada si no lleva bacha", () => {
    expect(validateBachasOrdenes([orden({ llevaBacha: false, bachaOrigen: "propia" })], articulos)).toBeNull();
  });

  it("exige bacha y mano de obra si es nuestra", () => {
    const ot = orden({ llevaBacha: true, bachaOrigen: "propia" });
    expect(validateBachasOrdenes([ot], articulos)).toContain("mano de obra");
    const completa = ajustarLineasBacha(ot, articulos);
    expect(validateBachasOrdenes([completa], articulos)).toBeNull();
  });

  it("si es del cliente, no deja cobrar la bacha", () => {
    const completa = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "propia" }), articulos);
    const msg = validateBachasOrdenes([{ ...completa, bachaOrigen: "cliente" }], articulos);
    expect(msg).toContain("la trae el cliente");
  });

  it("avisa si falta activar el artículo de mano de obra", () => {
    const ot = ajustarLineasBacha(orden({ llevaBacha: true, bachaOrigen: "propia" }), [bacha]);
    expect(validateBachasOrdenes([ot], [bacha])).toContain("Activalo en Artículos");
  });
});
