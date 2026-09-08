import { describe, expect, it } from "vitest";
import {
  calcularTotalesLiquidacion,
  pagosAlCerrar,
  parseMonto,
  sumaPagos,
} from "@/lib/sueldos-calculos";

describe("calcularTotalesLiquidacion", () => {
  it("suma haberes y resta descuentos", () => {
    const t = calcularTotalesLiquidacion([
      { tipo: "sueldo_base", monto: 400000 },
      { tipo: "hora_extra", monto: 25000 },
      { tipo: "adelanto", monto: 50000 },
      { tipo: "carga_social", monto: 10000 },
    ]);
    expect(t.total_bruto).toBe(425000);
    expect(t.total_descuentos).toBe(60000);
    expect(t.total_neto).toBe(365000);
  });

  it("toma el valor absoluto de montos negativos", () => {
    const t = calcularTotalesLiquidacion([
      { tipo: "sueldo_base", monto: 100 },
      { tipo: "descuento", monto: -20 },
    ]);
    expect(t.total_descuentos).toBe(20);
    expect(t.total_neto).toBe(80);
  });
});

describe("pagosAlCerrar", () => {
  it("si los tramos están en 0, deja el neto en efectivo del 30", () => {
    const p = pagosAlCerrar(
      { pago_efectivo_15: 0, pago_banco_30: 0, pago_efectivo_30: 0 },
      180000,
    );
    expect(p.pago_efectivo_30).toBe(180000);
    expect(sumaPagos(p)).toBe(180000);
  });

  it("respeta tramos cargados", () => {
    const p = pagosAlCerrar(
      { pago_efectivo_15: 80000, pago_banco_30: 50000, pago_efectivo_30: 20000 },
      150000,
    );
    expect(p).toEqual({
      pago_efectivo_15: 80000,
      pago_banco_30: 50000,
      pago_efectivo_30: 20000,
    });
  });
});

describe("parseMonto", () => {
  it("acepta coma decimal", () => {
    expect(parseMonto("12,5")).toBe(12.5);
  });

  it("vacío es 0", () => {
    expect(parseMonto("")).toBe(0);
  });
});
