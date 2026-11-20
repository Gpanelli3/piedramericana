import { describe, expect, it } from "vitest";
import {
  conformidadTrasMedir,
  enColaParaMedir,
  etiquetaMedicionEstado,
  medicionResuelta,
  motivoBloqueoEnvio,
  puedeEnviarAProduccion,
  requiereConformidadCliente,
  validarImporteRenegociado,
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

describe("conformidad del cliente tras medir", () => {
  it("bloquea el envío a producción mientras falta la conformidad", () => {
    const r = puedeEnviarAProduccion({
      presupuestoAprobado: true,
      tieneSena: true,
      medicionEstado: "medido",
      conformidadPendiente: true,
    });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toEqual(["Falta la conformidad del cliente con el nuevo importe."]);
  });

  it("permite enviar cuando la conformidad ya se dio o no hizo falta", () => {
    expect(
      puedeEnviarAProduccion({
        presupuestoAprobado: true,
        tieneSena: true,
        medicionEstado: "medido",
        conformidadPendiente: false,
      }).ok,
    ).toBe(true);
    expect(
      puedeEnviarAProduccion({
        presupuestoAprobado: true,
        tieneSena: true,
        medicionEstado: "medido",
      }).ok,
    ).toBe(true);
  });

  it("requiere conformidad solo si el precio cambió", () => {
    expect(requiereConformidadCliente({ totalAnterior: 60000, totalNuevo: 60100 })).toBe(true);
    expect(requiereConformidadCliente({ totalAnterior: 60000, totalNuevo: 59800 })).toBe(true);
    expect(requiereConformidadCliente({ totalAnterior: 60000, totalNuevo: 60000 })).toBe(false);
    expect(requiereConformidadCliente({ totalAnterior: 60000, totalNuevo: 60000.004 })).toBe(false);
  });

  it("sin cambio de precio no deja nada pendiente", () => {
    expect(
      conformidadTrasMedir({
        pendienteActual: false,
        totalAceptadoPrevio: null,
        totalAnterior: 60000,
        totalNuevo: 60000,
      }),
    ).toEqual({ pendiente: false, totalAnterior: null, totalNuevo: null });
  });

  it("si cambió el precio queda pendiente con el importe anterior y el nuevo", () => {
    expect(
      conformidadTrasMedir({
        pendienteActual: false,
        totalAceptadoPrevio: null,
        totalAnterior: 60000,
        totalNuevo: 60100,
      }),
    ).toEqual({ pendiente: true, totalAnterior: 60000, totalNuevo: 60100 });
  });

  it("al re-medir con conformidad pendiente compara contra el importe que el cliente había aceptado", () => {
    // El cliente aceptó 60.000; una primera medición dio 60.100 y una segunda 60.300.
    expect(
      conformidadTrasMedir({
        pendienteActual: true,
        totalAceptadoPrevio: 60000,
        totalAnterior: 60100,
        totalNuevo: 60300,
      }),
    ).toEqual({ pendiente: true, totalAnterior: 60000, totalNuevo: 60300 });
    // Si la corrección vuelve al importe aceptado, ya no hace falta consultar.
    expect(
      conformidadTrasMedir({
        pendienteActual: true,
        totalAceptadoPrevio: 60000,
        totalAnterior: 60100,
        totalNuevo: 60000,
      }),
    ).toEqual({ pendiente: false, totalAnterior: null, totalNuevo: null });
  });
});

describe("validarImporteRenegociado", () => {
  const ok = { nuevoTotal: 62000, cobrado: 20000, motivo: "Acordado por teléfono" };

  it("acepta un importe válido con motivo", () => {
    expect(validarImporteRenegociado(ok)).toBeNull();
  });

  it("acepta un importe igual a lo ya cobrado", () => {
    expect(validarImporteRenegociado({ ...ok, nuevoTotal: 20000 })).toBeNull();
  });

  it("rechaza un importe vacío, cero o inválido", () => {
    expect(validarImporteRenegociado({ ...ok, nuevoTotal: 0 })).toMatch(/importe/);
    expect(validarImporteRenegociado({ ...ok, nuevoTotal: Number.NaN })).toMatch(/importe/);
    expect(validarImporteRenegociado({ ...ok, nuevoTotal: -5 })).toMatch(/importe/);
  });

  it("rechaza un importe menor a lo ya cobrado", () => {
    expect(validarImporteRenegociado({ ...ok, nuevoTotal: 19999 })).toMatch(/ya se cobró/);
  });

  it("exige un motivo", () => {
    expect(validarImporteRenegociado({ ...ok, motivo: "   " })).toMatch(/motivo/);
  });
});

describe("etiquetaMedicionEstado", () => {
  it("etiquetas en español", () => {
    expect(etiquetaMedicionEstado("listo_para_medir")).toBe("Para medir");
    expect(etiquetaMedicionEstado("no_requiere")).toBe("Sin medición");
  });
});
