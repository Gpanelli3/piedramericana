import { describe, expect, it } from "vitest";
import {
  MOTIVO_BLOQUEO_BACHA,
  bachaResuelta,
  camposRequisitoBacha,
  esBloqueoPorBacha,
  etapaExigeBachaAsignada,
  motivoBloqueoBacha,
  ordenBachaParaOt,
} from "./bacha-reglas";

describe("bachaResuelta", () => {
  it("ok si no requiere bacha", () => {
    const r = bachaResuelta({ bachaRequerida: false, bachaAsignada: false });
    expect(r.ok).toBe(true);
    expect(r.faltantes).toHaveLength(0);
  });

  it("ok si requiere y está asignada", () => {
    const r = bachaResuelta({ bachaRequerida: true, bachaAsignada: true });
    expect(r.ok).toBe(true);
  });

  it("falta si requiere y no está asignada", () => {
    const r = bachaResuelta({ bachaRequerida: true, bachaAsignada: false });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toEqual([MOTIVO_BLOQUEO_BACHA]);
    expect(motivoBloqueoBacha(r)).toBe(MOTIVO_BLOQUEO_BACHA);
  });
});

describe("camposRequisitoBacha", () => {
  it("limpia el requisito si la OT no lleva bacha", () => {
    expect(
      camposRequisitoBacha({
        llevaBacha: false,
        origen: "cliente",
        tipoEtiqueta: "Johnson",
        colocacion: "bajo",
      }),
    ).toEqual({
      bacha_requerida: false,
      bacha_origen: null,
      bacha_tipo: null,
      bacha_colocacion: null,
    });
  });

  it("copia tipo, colocación y origen cuando lleva bacha", () => {
    expect(
      camposRequisitoBacha({
        llevaBacha: true,
        origen: "cliente",
        tipoEtiqueta: "Johnson — Acero Premium",
        colocacion: "sobre",
      }),
    ).toEqual({
      bacha_requerida: true,
      bacha_origen: "cliente",
      bacha_tipo: "Johnson — Acero Premium",
      bacha_colocacion: "sobre",
    });
  });
});

describe("etapaExigeBachaAsignada", () => {
  it("exige desde corte en adelante", () => {
    expect(etapaExigeBachaAsignada("medicion")).toBe(false);
    expect(etapaExigeBachaAsignada("corte")).toBe(true);
    expect(etapaExigeBachaAsignada("produccion")).toBe(true);
    expect(etapaExigeBachaAsignada("despacho")).toBe(true);
    expect(etapaExigeBachaAsignada(null)).toBe(false);
  });
});

describe("ordenBachaParaOt", () => {
  const ordenes = [
    { key: "a", titulo: "Cocina" },
    { key: "b", titulo: "Baño" },
  ];

  it("matchea por orden_key", () => {
    const ots = [
      { orden_key: "a" },
      { orden_key: "b" },
    ];
    expect(ordenBachaParaOt(ots[1], ots, ordenes)?.titulo).toBe("Baño");
  });

  it("si hay una sola OT sin clave y una sola orden, las empareja", () => {
    const ots = [{ orden_key: null }];
    expect(ordenBachaParaOt(ots[0], ots, [ordenes[0]])?.titulo).toBe("Cocina");
  });

  it("no adivina si hay varias OT sin clave", () => {
    const ots = [{ orden_key: null }, { orden_key: null }];
    expect(ordenBachaParaOt(ots[0], ots, [ordenes[0]])).toBeNull();
  });
});

describe("esBloqueoPorBacha", () => {
  it("solo coincide con el motivo fijo", () => {
    expect(esBloqueoPorBacha(MOTIVO_BLOQUEO_BACHA)).toBe(true);
    expect(esBloqueoPorBacha("Falta seña")).toBe(false);
    expect(esBloqueoPorBacha(null)).toBe(false);
  });
});
