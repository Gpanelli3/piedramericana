import { describe, expect, it } from "vitest";
import {
  formatCm,
  materialCoincide,
  metrosACm,
  piezaCabeEnRetazo,
  sugerirRetazosParaPiezas,
} from "./rotura-reglas";

describe("piezaCabeEnRetazo", () => {
  it("un retazo de 1 m × 80 cm cubre una mesada de 80 × 60 cm", () => {
    expect(piezaCabeEnRetazo(80, 60, 100, 80)).toBe(true);
  });

  it("cabe rotando la pieza", () => {
    expect(piezaCabeEnRetazo(80, 60, 80, 100)).toBe(true);
  });

  it("no cabe si el retazo es más chico", () => {
    expect(piezaCabeEnRetazo(80, 60, 70, 50)).toBe(false);
  });

  it("no cabe si un lado sobra", () => {
    expect(piezaCabeEnRetazo(120, 60, 100, 80)).toBe(false);
  });
});

describe("sugerirRetazosParaPiezas", () => {
  it("asigna un retazo por pieza y no reutiliza el mismo", () => {
    const matches = sugerirRetazosParaPiezas(
      [
        { label: "Mesada", largoCm: 80, anchoCm: 60 },
        { label: "Alzada", largoCm: 80, anchoCm: 12 },
      ],
      [
        { id: "a", bulto: "R1", largoCm: 100, anchoCm: 80, materialLabel: "Granito" },
        { id: "b", bulto: "R2", largoCm: 90, anchoCm: 20, materialLabel: "Granito" },
      ],
    );
    expect(matches).toHaveLength(2);
    expect(matches[0]?.retazo.bulto).toBe("R1");
    expect(matches[1]?.retazo.bulto).toBe("R2");
  });
});

describe("materialCoincide", () => {
  it("prioriza id cuando ambos lo tienen", () => {
    expect(materialCoincide("1", "A", "1", "B")).toBe(true);
    expect(materialCoincide("1", "A", "2", "A")).toBe(false);
  });

  it("cae al nombre si falta id", () => {
    expect(materialCoincide(null, "Granito Negro Brasil", null, "Granito Negro")).toBe(true);
  });
});

describe("metrosACm / formatCm", () => {
  it("convierte y formatea", () => {
    expect(metrosACm(0.8)).toBe(80);
    expect(formatCm(100, 80)).toBe("100×80 cm");
  });
});
