import { describe, expect, it } from "vitest";
import {
  MOTIVO_BLOQUEO_BACHA,
  bachaCorrespondeACliente,
  bachaResuelta,
  camposRequisitoBacha,
  esBloqueoPorBacha,
  etapaExigeBachaAsignada,
  frenaAvancePorBacha,
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
  it("exige desde producción, no en corte", () => {
    expect(etapaExigeBachaAsignada("medicion")).toBe(false);
    expect(etapaExigeBachaAsignada("corte")).toBe(false);
    expect(etapaExigeBachaAsignada("produccion")).toBe(true);
    expect(etapaExigeBachaAsignada("despacho")).toBe(true);
    expect(etapaExigeBachaAsignada(null)).toBe(false);
  });
});

describe("frenaAvancePorBacha", () => {
  it("deja cortar aunque falte la bacha", () => {
    expect(
      frenaAvancePorBacha({
        bachaRequerida: true,
        bachaAsignada: false,
        nextEtapa: "corte",
      }),
    ).toBe(false);
  });

  it("frena el paso a producción si esa OT lleva bacha y no está asignada", () => {
    expect(
      frenaAvancePorBacha({
        bachaRequerida: true,
        bachaAsignada: false,
        nextEtapa: "produccion",
      }),
    ).toBe(true);
  });

  it("no frena si la OT no lleva bacha", () => {
    expect(
      frenaAvancePorBacha({
        bachaRequerida: false,
        bachaAsignada: false,
        nextEtapa: "produccion",
      }),
    ).toBe(false);
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

describe("bachaCorrespondeACliente", () => {
  it("la propia entra en cualquier OT", () => {
    expect(
      bachaCorrespondeACliente(
        { origen: "propia", cliente_nombre: null },
        { clienteNombre: "García" },
      ),
    ).toBe(true);
  });

  it("la del cliente entra si el id coincide", () => {
    expect(
      bachaCorrespondeACliente(
        { origen: "cliente", cliente_id: "c1", cliente_nombre: "Otro" },
        { clienteId: "c1", clienteNombre: "García" },
      ),
    ).toBe(true);
  });

  it("la del cliente no entra en la OT de otro cliente", () => {
    expect(
      bachaCorrespondeACliente(
        { origen: "cliente", cliente_id: "c1", cliente_nombre: "García" },
        { clienteId: "c2", clienteNombre: "García" },
      ),
    ).toBe(false);
  });

  it("sin id, compara el nombre", () => {
    expect(
      bachaCorrespondeACliente(
        { origen: "cliente", cliente_nombre: "García" },
        { clienteNombre: "garcía" },
      ),
    ).toBe(true);
    expect(
      bachaCorrespondeACliente(
        { origen: "cliente", cliente_nombre: "García" },
        { clienteNombre: "López" },
      ),
    ).toBe(false);
  });
});

describe("esBloqueoPorBacha", () => {
  it("solo coincide con el motivo fijo", () => {
    expect(esBloqueoPorBacha(MOTIVO_BLOQUEO_BACHA)).toBe(true);
    expect(esBloqueoPorBacha("Falta seña")).toBe(false);
    expect(esBloqueoPorBacha(null)).toBe(false);
  });
});
