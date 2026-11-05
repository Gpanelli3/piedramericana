import { describe, expect, it } from "vitest";
import {
  montoCancelarTodo,
  totalPorMoneda,
  validarYPartirPago,
} from "@/lib/pago-reparto";

describe("totalPorMoneda", () => {
  it("suma por moneda e ignora ceros", () => {
    expect(
      totalPorMoneda([
        { moneda: "usd", monto: 100 },
        { moneda: "usd", monto: 20.5 },
        { moneda: "ars", monto: 1000 },
        { moneda: "ars", monto: 0 },
      ]),
    ).toEqual({ usd: 120.5, ars: 1000 });
  });
});

describe("montoCancelarTodo", () => {
  it("cubre el saldo si alcanza el restante de las formas", () => {
    expect(
      montoCancelarTodo({ saldo: 80, moneda: "usd", totalFormas: 150, asignadoOtras: 20 }),
    ).toBe(80);
  });

  it("usa el restante si es menor al saldo", () => {
    expect(
      montoCancelarTodo({ saldo: 200, moneda: "usd", totalFormas: 150, asignadoOtras: 90 }),
    ).toBe(60);
  });
});

describe("validarYPartirPago", () => {
  it("manda todas las formas a una sola venta", () => {
    const r = validarYPartirPago({
      destinoUnicoId: "p1",
      formas: [
        { metodo: "efectivo", moneda: "usd", monto: 100, cuentaId: "c1" },
        { metodo: "transferencia", moneda: "ars", monto: 50, cuentaId: "c2" },
      ],
      deudas: [],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tramos).toEqual([
      { presupuestoId: "p1", metodo: "efectivo", moneda: "usd", monto: 100, cuentaId: "c1" },
      { presupuestoId: "p1", metodo: "transferencia", moneda: "ars", monto: 50, cuentaId: "c2" },
    ]);
  });

  it("parte dos formas entre dos deudas de la misma moneda", () => {
    const r = validarYPartirPago({
      formas: [
        { metodo: "efectivo", moneda: "usd", monto: 100, cuentaId: "caja" },
        { metodo: "transferencia", moneda: "usd", monto: 50, cuentaId: "banco" },
      ],
      deudas: [
        { presupuestoId: "a", moneda: "usd", saldo: 80, asignado: 80 },
        { presupuestoId: "b", moneda: "usd", saldo: 70, asignado: 70 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tramos).toEqual([
      { presupuestoId: "a", metodo: "efectivo", moneda: "usd", monto: 80, cuentaId: "caja" },
      { presupuestoId: "b", metodo: "efectivo", moneda: "usd", monto: 20, cuentaId: "caja" },
      { presupuestoId: "b", metodo: "transferencia", moneda: "usd", monto: 50, cuentaId: "banco" },
    ]);
  });

  it("reparte usd y ars por separado", () => {
    const r = validarYPartirPago({
      formas: [
        { metodo: "efectivo", moneda: "usd", monto: 40, cuentaId: "u" },
        { metodo: "efectivo", moneda: "ars", monto: 1000, cuentaId: "a" },
      ],
      deudas: [
        { presupuestoId: "usd1", moneda: "usd", saldo: 40, asignado: 40 },
        { presupuestoId: "ars1", moneda: "ars", saldo: 1000, asignado: 1000 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tramos).toEqual([
      { presupuestoId: "usd1", metodo: "efectivo", moneda: "usd", monto: 40, cuentaId: "u" },
      { presupuestoId: "ars1", metodo: "efectivo", moneda: "ars", monto: 1000, cuentaId: "a" },
    ]);
  });

  it("omite deudas con asignado en cero", () => {
    const r = validarYPartirPago({
      formas: [{ metodo: "efectivo", moneda: "usd", monto: 10, cuentaId: null }],
      deudas: [
        { presupuestoId: "skip", moneda: "usd", saldo: 50, asignado: 0 },
        { presupuestoId: "ok", moneda: "usd", saldo: 10, asignado: 10 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tramos).toEqual([
      { presupuestoId: "ok", metodo: "efectivo", moneda: "usd", monto: 10, cuentaId: null },
    ]);
  });

  it("rechaza si las sumas no coinciden", () => {
    const r = validarYPartirPago({
      formas: [{ metodo: "efectivo", moneda: "usd", monto: 100, cuentaId: null }],
      deudas: [{ presupuestoId: "a", moneda: "usd", saldo: 80, asignado: 80 }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/coincidir/i);
  });

  it("rechaza asignar más que el saldo", () => {
    const r = validarYPartirPago({
      formas: [{ metodo: "efectivo", moneda: "usd", monto: 90, cuentaId: null }],
      deudas: [{ presupuestoId: "a", moneda: "usd", saldo: 80, asignado: 90 }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/saldo/i);
  });

  it("rechaza si no hay montos", () => {
    const r = validarYPartirPago({
      formas: [{ metodo: "efectivo", moneda: "usd", monto: 0, cuentaId: null }],
      deudas: [],
      destinoUnicoId: "p1",
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza forma sin método", () => {
    const r = validarYPartirPago({
      formas: [{ metodo: "  ", moneda: "usd", monto: 10, cuentaId: null }],
      deudas: [],
      destinoUnicoId: "p1",
    });
    expect(r.ok).toBe(false);
  });
});
