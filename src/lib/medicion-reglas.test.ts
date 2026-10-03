import { describe, expect, it } from "vitest";
import {
  etiquetaMedicionEstado,
  medicionResuelta,
  motivoBloqueoEnvio,
  puedeEnviarAProduccion,
} from "@/lib/medicion-reglas";

describe("puedeEnviarAProduccion", () => {
  it("permite enviar con presupuesto aprobado, seña y medición confirmada", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: true,
      tieneSena: true,
      medicionEstado: "medido",
    });
    expect(r.ok).toBe(true);
    expect(r.faltantes).toEqual([]);
    expect(motivoBloqueoEnvio(r)).toBeNull();
  });

  it("permite enviar si se saltó la medición", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: true,
      tieneSena: true,
      medicionEstado: "no_requiere",
    });
    expect(r.ok).toBe(true);
  });

  it("bloquea sin seña", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: true,
      tieneSena: false,
      medicionEstado: "medido",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toContain("Falta la seña.");
    expect(motivoBloqueoEnvio(r)).toBe("Falta la seña.");
  });

  it("bloquea si el presupuesto sigue pendiente", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: false,
      tieneSena: true,
      medicionEstado: "medido",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes[0]).toMatch(/aprobado/);
  });

  it("bloquea si todavía no se midió", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: true,
      tieneSena: true,
      medicionEstado: "listo_para_medir",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toContain("La medición todavía no se confirmó.");
  });

  it("bloquea si la medición ni se pidió", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: true,
      tieneSena: true,
      medicionEstado: "sin_solicitar",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes[0]).toMatch(/medir o saltar/);
  });

  it("junta varios faltantes", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: false,
      tieneSena: false,
      medicionEstado: "sin_solicitar",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toHaveLength(3);
  });
});

describe("medicionResuelta", () => {
  it("medido y no_requiere están resueltos", () => {
    expect(medicionResuelta("medido")).toBe(true);
    expect(medicionResuelta("no_requiere")).toBe(true);
    expect(medicionResuelta("listo_para_medir")).toBe(false);
    expect(medicionResuelta("sin_solicitar")).toBe(false);
  });
});

describe("etiquetaMedicionEstado", () => {
  it("etiquetas en español", () => {
    expect(etiquetaMedicionEstado("listo_para_medir")).toBe("Listo para medir");
    expect(etiquetaMedicionEstado("no_requiere")).toBe("Sin medición");
  });
});
