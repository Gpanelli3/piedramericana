import { describe, expect, it } from "vitest";
import { calcularRetencion, metodoAplicaRetencion, roundMoney } from "@/lib/retencion-reglas";

describe("metodoAplicaRetencion", () => {
  it("aplica en transferencia y cheque", () => {
    expect(metodoAplicaRetencion("transferencia")).toBe(true);
    expect(metodoAplicaRetencion("Cheque")).toBe(true);
  });

  it("no aplica en efectivo, tarjeta ni Mercado Pago", () => {
    expect(metodoAplicaRetencion("efectivo")).toBe(false);
    expect(metodoAplicaRetencion("tarjeta")).toBe(false);
    expect(metodoAplicaRetencion("mercadopago")).toBe(false);
  });
});

describe("calcularRetencion", () => {
  it("sin agente deja el bruto entero", () => {
    const r = calcularRetencion({
      bruto: 1000,
      esAgente: false,
      metodo: "transferencia",
      porcentajeCliente: 10,
    });
    expect(r.aplica).toBe(false);
    expect(r.retencionMonto).toBe(0);
    expect(r.neto).toBe(1000);
    expect(r.error).toBeNull();
  });

  it("agente en efectivo no retiene", () => {
    const r = calcularRetencion({
      bruto: 1000,
      esAgente: true,
      metodo: "efectivo",
      porcentajeCliente: 10,
    });
    expect(r.aplica).toBe(false);
    expect(r.neto).toBe(1000);
  });

  it("agente en transferencia usa el % del cliente", () => {
    const r = calcularRetencion({
      bruto: 1000,
      esAgente: true,
      metodo: "transferencia",
      porcentajeCliente: 10,
    });
    expect(r.aplica).toBe(true);
    expect(r.porcentaje).toBe(10);
    expect(r.retencionMonto).toBe(100);
    expect(r.neto).toBe(900);
  });

  it("permite ajustar el porcentaje al registrar", () => {
    const r = calcularRetencion({
      bruto: 2000,
      esAgente: true,
      metodo: "cheque",
      porcentajeCliente: 10,
      porcentajeOverride: 5,
    });
    expect(r.retencionMonto).toBe(100);
    expect(r.neto).toBe(1900);
  });

  it("permite ajustar el monto de retención, entre 0 y el bruto", () => {
    const r = calcularRetencion({
      bruto: 1000,
      esAgente: true,
      metodo: "transferencia",
      porcentajeCliente: 10,
      retencionMontoOverride: 70,
    });
    expect(r.retencionMonto).toBe(70);
    expect(r.neto).toBe(930);
    expect(r.error).toBeNull();
  });

  it("rechaza retención mayor al cobro", () => {
    const r = calcularRetencion({
      bruto: 100,
      esAgente: true,
      metodo: "transferencia",
      porcentajeCliente: 10,
      retencionMontoOverride: 120,
    });
    expect(r.error).toBe("La retención no puede superar el cobro.");
  });

  it("redondea a 2 decimales", () => {
    const r = calcularRetencion({
      bruto: 99.99,
      esAgente: true,
      metodo: "transferencia",
      porcentajeCliente: 5,
    });
    expect(r.retencionMonto).toBe(roundMoney(4.9995));
    expect(r.neto).toBe(roundMoney(99.99 - r.retencionMonto));
  });
});
