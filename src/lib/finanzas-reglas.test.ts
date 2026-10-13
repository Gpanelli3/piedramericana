import { describe, expect, it } from "vitest";
import { validarMontoAcreditado } from "@/lib/finanzas-api";

describe("validarMontoAcreditado", () => {
  it("acepta un monto entre 0 exclusivo y el cobrado", () => {
    expect(validarMontoAcreditado(10, 7)).toEqual({ ok: true });
    expect(validarMontoAcreditado(10, 10)).toEqual({ ok: true });
  });

  it("rechaza cero o negativo", () => {
    expect(validarMontoAcreditado(10, 0).ok).toBe(false);
    expect(validarMontoAcreditado(10, -1).ok).toBe(false);
  });

  it("rechaza más de lo cobrado", () => {
    const r = validarMontoAcreditado(10, 11);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/superar/i);
  });
});
