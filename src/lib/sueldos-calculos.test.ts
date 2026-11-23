import { describe, expect, it } from "vitest";
import {
  calcularTotalesLiquidacion,
  parseMonto,
  saldoLiquidacion,
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

describe("pagos y saldo", () => {
  it("suma los pagos", () => {
    expect(sumaPagos([{ monto: 80000 }, { monto: 50000.5 }])).toBe(130000.5);
  });

  it("el saldo es el neto menos lo pagado", () => {
    expect(saldoLiquidacion(150000, [{ monto: 80000 }, { monto: 50000 }])).toBe(20000);
    expect(saldoLiquidacion(150000, [])).toBe(150000);
    expect(saldoLiquidacion(150000, [{ monto: 150000 }])).toBe(0);
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
