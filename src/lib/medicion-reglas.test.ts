import { describe, expect, it } from "vitest";
import {
  enColaParaMedir,
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

  it("bloquea si se saltó la medición: hay que confirmar medidas", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: true,
      tieneSena: true,
      medicionEstado: "no_requiere",
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toContain("Falta confirmar las medidas.");
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
    expect(r.faltantes[0]).toMatch(/confirmar las medidas/);
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

describe("enColaParaMedir", () => {
  it("la seña sin pedir medición entra a la cola", () => {
    expect(enColaParaMedir("sin_solicitar", true)).toBe(true);
    expect(enColaParaMedir("sin_solicitar", false)).toBe(false);
    expect(enColaParaMedir("listo_para_medir", false)).toBe(true);
    expect(enColaParaMedir("medido", true)).toBe(false);
  });
});

describe("medicionResuelta", () => {
  it("solo medido está resuelto", () => {
    expect(medicionResuelta("medido")).toBe(true);
    expect(medicionResuelta("no_requiere")).toBe(false);
    expect(medicionResuelta("listo_para_medir")).toBe(false);
    expect(medicionResuelta("sin_solicitar")).toBe(false);
  });
});

describe("etiquetaMedicionEstado", () => {
  it("etiquetas en español", () => {
    expect(etiquetaMedicionEstado("listo_para_medir")).toBe("Para medir");
    expect(etiquetaMedicionEstado("no_requiere")).toBe("Sin medición");
  });
});
