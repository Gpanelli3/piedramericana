import { describe, expect, it } from "vitest";
import { armarRotuloPlaca, formatoMedidasPlaca } from "./rotulo-placa-api";

describe("formatoMedidasPlaca", () => {
  it("formatea largo por ancho", () => {
    expect(formatoMedidasPlaca(320, 180)).toBe("320 × 180 cm");
  });
});

describe("armarRotuloPlaca", () => {
  it("arma la etiqueta de la placa", () => {
    const r = armarRotuloPlaca({
      bulto: "#8890",
      material: "Granito Negro Brasil Extra 20mm",
      largoCm: 320,
      anchoCm: 180,
      lote: "L-12",
      origen: "nacional",
      remitoNumero: "0001-000123",
      fecha: "2026-10-18",
    });
    expect(r.bulto).toBe("#8890");
    expect(r.material).toBe("Granito Negro Brasil Extra 20mm");
    expect(r.medidas).toBe("320 × 180 cm");
    expect(r.lote).toBe("L-12");
    expect(r.origen).toBe("Nacional");
    expect(r.remito).toBe("0001-000123");
    expect(r.fecha).toBe("18/10/2026");
  });
});
