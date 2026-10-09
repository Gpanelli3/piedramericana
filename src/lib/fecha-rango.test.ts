import { describe, expect, it } from "vitest";
import { diaDeIso, fechaEnRango, formatoDiaCalendario, rangoFechasInvertido } from "./fecha-rango";

describe("diaDeIso", () => {
  it("toma el día de un timestamp", () => {
    expect(diaDeIso("2026-10-01T15:40:00.000Z")).toBe("2026-10-01");
  });

  it("deja pasar una fecha suelta", () => {
    expect(diaDeIso("2026-10-01")).toBe("2026-10-01");
  });
});

describe("formatoDiaCalendario", () => {
  it("no atrasa un día al formatear YYYY-MM-DD", () => {
    expect(formatoDiaCalendario("2026-10-01")).toBe("01/10/2026");
  });
});

describe("fechaEnRango", () => {
  it("sin extremos deja pasar cualquier fecha", () => {
    expect(fechaEnRango("2026-10-15T12:00:00.000Z", "", "")).toBe(true);
  });

  it("solo desde incluye el borde y lo posterior", () => {
    expect(fechaEnRango("2026-10-01", "2026-10-01", "")).toBe(true);
    expect(fechaEnRango("2026-10-30", "2026-10-01", "")).toBe(true);
    expect(fechaEnRango("2026-09-30", "2026-10-01", "")).toBe(false);
  });

  it("solo hasta incluye el borde y lo anterior", () => {
    expect(fechaEnRango("2026-10-30", "", "2026-10-30")).toBe(true);
    expect(fechaEnRango("2026-10-01", "", "2026-10-30")).toBe(true);
    expect(fechaEnRango("2026-10-31", "", "2026-10-30")).toBe(false);
  });

  it("rango inclusivo en ambos bordes", () => {
    expect(fechaEnRango("2026-10-01T08:00:00.000Z", "2026-10-01", "2026-10-30")).toBe(true);
    expect(fechaEnRango("2026-10-15", "2026-10-01", "2026-10-30")).toBe(true);
    expect(fechaEnRango("2026-10-30T23:00:00.000Z", "2026-10-01", "2026-10-30")).toBe(true);
    expect(fechaEnRango("2026-09-30", "2026-10-01", "2026-10-30")).toBe(false);
    expect(fechaEnRango("2026-10-31", "2026-10-01", "2026-10-30")).toBe(false);
  });

  it("desde posterior a hasta no deja pasar ninguna fecha", () => {
    expect(rangoFechasInvertido("2026-10-30", "2026-10-01")).toBe(true);
    expect(fechaEnRango("2026-10-15", "2026-10-30", "2026-10-01")).toBe(false);
    expect(fechaEnRango("2026-10-30", "2026-10-30", "2026-10-01")).toBe(false);
    expect(fechaEnRango("2026-10-01", "2026-10-30", "2026-10-01")).toBe(false);
  });
});
