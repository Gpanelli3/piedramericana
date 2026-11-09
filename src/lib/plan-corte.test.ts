import { describe, expect, it } from "vitest";
import type { ArticuloConPrecio } from "@/types/articulos";
import { newOrdenTrabajo } from "@/components/presupuesto/wizard/types";
import {
  ALTO_ALZADA_CM,
  ALTO_ZOCALO_CM,
  confirmarPlanCorte,
  fingerprintPlanCorte,
  otRequierePlanConfirmado,
  packGuillotineForTest,
  piezasDesdeOrden,
  planificarCorte,
  validarPlanesConfirmados,
} from "./plan-corte";

const mesada: ArticuloConPrecio = {
  id: "mes",
  codigo: "PIEZA",
  descripcion: "Mesada",
  unidad: "M2",
  calcula_material: true,
  medida_estandar_m2: null,
  prefer_modo_manual: false,
  sort_order: 1,
  precio: 100,
  moneda: "usd",
};

const zocalo: ArticuloConPrecio = {
  id: "zoc",
  codigo: "ZOC-ML",
  descripcion: "Zócalo",
  unidad: "ML",
  calcula_material: true,
  medida_estandar_m2: null,
  prefer_modo_manual: false,
  sort_order: 2,
  precio: 20,
  moneda: "usd",
};

const alzada: ArticuloConPrecio = {
  id: "alz",
  codigo: "ALZ-ML",
  descripcion: "Alzada",
  unidad: "ML",
  calcula_material: true,
  medida_estandar_m2: null,
  prefer_modo_manual: false,
  sort_order: 3,
  precio: 20,
  moneda: "usd",
};

const mo: ArticuloConPrecio = {
  id: "mo",
  codigo: "BACH-MO",
  descripcion: "Mano de obra",
  unidad: "UNI",
  calcula_material: false,
  medida_estandar_m2: null,
  prefer_modo_manual: false,
  sort_order: 4,
  precio: 40,
  moneda: "ars",
};

describe("piezasDesdeOrden", () => {
  it("arma piezas M2 con cantidad y tiras ML con alto fijo", () => {
    const ot = newOrdenTrabajo("mat-1");
    ot.items = [
      {
        key: "l1",
        articuloId: "mes",
        modoIngreso: "dimensiones",
        cantidad: "2",
        precioUnitario: "100",
        altoM: "2,10",
        anchoM: "0,60",
        desperdicioPct: "0",
      },
      {
        key: "l2",
        articuloId: "zoc",
        modoIngreso: "dimensiones",
        cantidad: "2,10",
        precioUnitario: "20",
        altoM: "0",
        anchoM: "0",
        desperdicioPct: "0",
      },
      {
        key: "l3",
        articuloId: "alz",
        modoIngreso: "dimensiones",
        cantidad: "1,10",
        precioUnitario: "20",
        altoM: "0",
        anchoM: "0",
        desperdicioPct: "0",
      },
      {
        key: "l4",
        articuloId: "mo",
        modoIngreso: "dimensiones",
        cantidad: "1",
        precioUnitario: "40",
        altoM: "0",
        anchoM: "0",
        desperdicioPct: "0",
      },
    ];
    const piezas = piezasDesdeOrden(ot, [mesada, zocalo, alzada, mo]);
    expect(piezas).toHaveLength(4);
    expect(piezas.filter((p) => p.itemKey === "l1")).toHaveLength(2);
    expect(piezas.find((p) => p.itemKey === "l2")).toMatchObject({
      largoCm: 210,
      anchoCm: ALTO_ZOCALO_CM,
    });
    expect(piezas.find((p) => p.itemKey === "l3")).toMatchObject({
      largoCm: 110,
      anchoCm: ALTO_ALZADA_CM,
    });
  });

  it("no arma piezas si la piedra es del cliente", () => {
    const ot = newOrdenTrabajo("mat-1");
    ot.piedraDelCliente = true;
    ot.items = [
      {
        key: "l1",
        articuloId: "mes",
        modoIngreso: "dimensiones",
        cantidad: "1",
        precioUnitario: "100",
        altoM: "2",
        anchoM: "0,6",
        desperdicioPct: "0",
      },
    ];
    expect(piezasDesdeOrden(ot, [mesada])).toEqual([]);
  });
});

describe("packGuillotine", () => {
  it("coloca una mesada y deja sobrante rectangular", () => {
    const packed = packGuillotineForTest(320, 190, [
      { key: "p1", itemKey: "l1", label: "Mesada", largoCm: 210, anchoCm: 60 },
    ]);
    expect(packed.placed).toHaveLength(1);
    expect(packed.leftover).toHaveLength(0);
    expect(packed.remnants.length).toBeGreaterThan(0);
    const areaPieza = 210 * 60;
    const areaSobra = packed.remnants.reduce((s, r) => s + r.w * r.h, 0);
    expect(areaPieza + areaSobra).toBeLessThanOrEqual(320 * 190);
  });

  it("rota la pieza si hace falta", () => {
    const packed = packGuillotineForTest(
      80,
      120,
      [{ key: "p1", itemKey: "l1", label: "Mesada", largoCm: 110, anchoCm: 70 }],
      0,
      true,
    );
    expect(packed.placed).toHaveLength(1);
    expect(packed.placed[0]?.rotada).toBe(true);
  });

  it("no rota si está deshabilitado", () => {
    const packed = packGuillotineForTest(
      80,
      120,
      [{ key: "p1", itemKey: "l1", label: "Mesada", largoCm: 110, anchoCm: 70 }],
      0,
      false,
    );
    expect(packed.placed).toHaveLength(0);
    expect(packed.leftover).toHaveLength(1);
  });
});

describe("planificarCorte", () => {
  const plancha = {
    id: "s1",
    bulto: "MAN-001",
    largoCm: 320,
    anchoCm: 190,
    loteCodigo: "L1",
    esRetazo: false,
  };
  const retazo = {
    id: "r1",
    bulto: "MAN-000-R1",
    largoCm: 100,
    anchoCm: 80,
    loteCodigo: "L1",
    esRetazo: true,
  };
  const plancha2 = {
    id: "s2",
    bulto: "MAN-002",
    largoCm: 320,
    anchoCm: 190,
    loteCodigo: "L2",
    esRetazo: false,
  };

  it("elige el retazo más chico que sirve antes que una plancha entera", () => {
    const plan = planificarCorte({
      piezas: [{ key: "p1", itemKey: "l1", label: "Mesada", largoCm: 80, anchoCm: 60 }],
      planchas: [plancha, retazo],
      materialLabel: "Granito negro",
    });
    expect(plan.planchas).toHaveLength(1);
    expect(plan.planchas[0]?.chapaId).toBe("r1");
    expect(plan.planchas[0]?.esRetazo).toBe(true);
    expect(plan.piezasSinCabida).toHaveLength(0);
  });

  it("usa varias planchas si no entra en una", () => {
    const plan = planificarCorte({
      piezas: [
        { key: "p1", itemKey: "l1", label: "A", largoCm: 300, anchoCm: 180 },
        { key: "p2", itemKey: "l2", label: "B", largoCm: 300, anchoCm: 180 },
      ],
      planchas: [plancha, plancha2],
    });
    expect(plan.planchas).toHaveLength(2);
    expect(plan.piezasSinCabida).toHaveLength(0);
  });

  it("marca empalme si la pieza no entra en ninguna plancha", () => {
    const plan = planificarCorte({
      piezas: [{ key: "p1", itemKey: "l1", label: "Isla", largoCm: 400, anchoCm: 200 }],
      planchas: [plancha],
    });
    expect(plan.planchas).toHaveLength(0);
    expect(plan.piezasSinCabida).toHaveLength(1);
    expect(plan.piezasSinCabida[0]?.motivo).toBe("empalme");
  });

  it("respeta la plancha forzada", () => {
    const plan = planificarCorte({
      piezas: [{ key: "p1", itemKey: "l1", label: "Mesada", largoCm: 80, anchoCm: 60 }],
      planchas: [plancha, retazo],
      forzarChapaIds: ["s1"],
    });
    expect(plan.planchas[0]?.chapaId).toBe("s1");
  });

  it("calcula aprovechamiento y sobrante", () => {
    const plan = planificarCorte({
      piezas: [{ key: "p1", itemKey: "l1", label: "Mesada", largoCm: 210, anchoCm: 60 }],
      planchas: [plancha],
    });
    const p = plan.planchas[0]!;
    expect(p.pctAprovechado).toBeGreaterThan(10);
    expect(p.pctAprovechado).toBeLessThan(50);
    expect(p.m2Sobrante).toBeGreaterThan(0);
    expect(p.sobrantes.length).toBeGreaterThan(0);
    expect(p.m2Usado + p.m2Sobrante + p.m2Perdido).toBeCloseTo(3.2 * 1.9, 2);
  });
});

describe("confirmación", () => {
  it("no deja confirmar sin plancha", () => {
    const plan = planificarCorte({
      piezas: [{ key: "p1", itemKey: "l1", label: "Isla", largoCm: 400, anchoCm: 200 }],
      planchas: [],
    });
    expect(confirmarPlanCorte(plan).confirmado).toBe(false);
  });

  it("el fingerprint cambia si cambian las medidas", () => {
    const a = fingerprintPlanCorte({
      materialId: "m",
      piezas: [{ itemKey: "l1", largoCm: 210, anchoCm: 60 }],
    });
    const b = fingerprintPlanCorte({
      materialId: "m",
      piezas: [{ itemKey: "l1", largoCm: 220, anchoCm: 60 }],
    });
    expect(a).not.toBe(b);
  });

  it("exige confirmación para señar cuando hay piezas", () => {
    const ot = newOrdenTrabajo("mat-1");
    ot.titulo = "Cocina";
    ot.items = [
      {
        key: "l1",
        articuloId: "mes",
        modoIngreso: "dimensiones",
        cantidad: "1",
        precioUnitario: "100",
        altoM: "2,10",
        anchoM: "0,60",
        desperdicioPct: "0",
      },
    ];
    expect(otRequierePlanConfirmado(ot, [mesada])).toBe(true);
    expect(validarPlanesConfirmados([ot], [mesada])).toMatch(/plancha/i);
    ot.planCorte = confirmarPlanCorte(
      planificarCorte({
        piezas: piezasDesdeOrden(ot, [mesada]),
        planchas: [
          {
            id: "s1",
            bulto: "MAN-001",
            largoCm: 320,
            anchoCm: 190,
            loteCodigo: "L1",
            esRetazo: false,
          },
        ],
      }),
    );
    expect(validarPlanesConfirmados([ot], [mesada])).toBeNull();
  });
});
