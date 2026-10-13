import { describe, expect, it } from "vitest";
import {
  camposFaltantesExportacion,
  descripcionIngresoExportacion,
  estadoExportacionLabel,
  puedeRegistrarCobro,
  pideDatosCobro,
  yaTieneIngreso,
} from "@/lib/exportacion-reglas";

describe("yaTieneIngreso", () => {
  it("es verdadero si hay movimiento", () => {
    expect(yaTieneIngreso({ movimiento_id: "abc" })).toBe(true);
  });

  it("es falso si no hay movimiento", () => {
    expect(yaTieneIngreso({ movimiento_id: null })).toBe(false);
    expect(yaTieneIngreso({ movimiento_id: "  " })).toBe(false);
  });
});

describe("pideDatosCobro", () => {
  it("pide datos al pasar a cobrada sin ingreso", () => {
    expect(pideDatosCobro("cobrada", null)).toBe(true);
  });

  it("no pide datos si el ingreso ya está", () => {
    expect(pideDatosCobro("cobrada", "mov-1")).toBe(false);
  });

  it("no pide datos en otras etapas", () => {
    expect(pideDatosCobro("embarcada", null)).toBe(false);
    expect(pideDatosCobro("facturada", null)).toBe(false);
  });
});

describe("puedeRegistrarCobro", () => {
  it("permite registrar con monto, fecha y cuenta", () => {
    const r = puedeRegistrarCobro({
      monto: 1200,
      fecha: "2026-10-13",
      cuentaId: "cuenta-usd",
    });
    expect(r.ok).toBe(true);
    expect(r.faltantes).toEqual([]);
  });

  it("bloquea sin monto", () => {
    const r = puedeRegistrarCobro({
      monto: 0,
      fecha: "2026-10-13",
      cuentaId: "cuenta-usd",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toContain("Indicá el monto cobrado.");
  });

  it("bloquea sin fecha ni cuenta", () => {
    const r = puedeRegistrarCobro({
      monto: 10,
      fecha: "",
      cuentaId: "",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toHaveLength(2);
  });
});

describe("descripcionIngresoExportacion", () => {
  it("nombra cliente y factura", () => {
    expect(
      descripcionIngresoExportacion({
        cliente: "Stone Corp",
        descripcion: "Placas Taj Mahal",
        nroFactura: "F-88",
      }),
    ).toBe("Exportación Placas Taj Mahal · Stone Corp · factura F-88");
  });

  it("omite la factura si no hay", () => {
    expect(
      descripcionIngresoExportacion({
        cliente: "Stone Corp",
        descripcion: "Placas",
        nroFactura: null,
      }),
    ).toBe("Exportación Placas · Stone Corp");
  });
});

describe("camposFaltantesExportacion", () => {
  it("lista lo que falta para cobrar", () => {
    const falta = camposFaltantesExportacion({
      nro_factura: null,
      fecha_factura: null,
      monto_factura: null,
      banco_nombre: null,
      banco_cuenta: null,
      cuenta_id: null,
    });
    expect(falta).toContain("N° factura");
    expect(falta).toContain("Cuenta de cobro");
  });

  it("queda vacío si está completo", () => {
    expect(
      camposFaltantesExportacion({
        nro_factura: "1",
        fecha_factura: "2026-10-01",
        monto_factura: 100,
        banco_nombre: "Galicia",
        banco_cuenta: "0001",
        cuenta_id: "c1",
      }),
    ).toEqual([]);
  });
});

describe("estadoExportacionLabel", () => {
  it("etiquetas en español", () => {
    expect(estadoExportacionLabel("pedido")).toBe("Pedido");
    expect(estadoExportacionLabel("cobrada")).toBe("Cobrada");
  });
});
