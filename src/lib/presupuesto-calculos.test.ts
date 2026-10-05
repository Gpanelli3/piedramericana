import { describe, expect, it } from "vitest";
import {
  articuloConPrecioToMock,
  buildLineaCalcInput,
  computeLineaPresupuesto,
  computePresupuestoComercial,
  computePresupuestoTotalM2,
  equivalentesMonedaMixta,
  esArticuloCobraMaterial,
  formatMetraje,
  importeMecPresupuesto,
  precioSugeridoLinea,
  trioM2DeOrden,
} from "@/lib/presupuesto-calculos";
import {
  normalizeLineaItemFromPayload,
  normalizeOrdenesFromPayload,
} from "@/lib/presupuesto-payload-normalize";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { OrdenTrabajoWizard } from "@/components/presupuesto/wizard/types";

function art(partial: Partial<ArticuloConPrecio> & Pick<ArticuloConPrecio, "id" | "codigo" | "descripcion" | "unidad">): ArticuloConPrecio {
  return {
    calcula_material: true,
    medida_estandar_m2: null,
    prefer_modo_manual: false,
    sort_order: 0,
    precio: 100,
    moneda: "usd",
    ...partial,
  };
}

describe("computeLineaPresupuesto (OtFlex)", () => {
  it("mesada 2×2 m con 1% desperdicio → 4,04 m²", () => {
    const mesada = articuloConPrecioToMock(
      art({ id: "1", codigo: "MES-ALZ", descripcion: "Mesada y alzada", unidad: "M2" }),
    );
    const line = buildLineaCalcInput(mesada, {
      articuloId: "1",
      modoIngreso: "dimensiones",
      cantidad: "1",
      precioUnitario: "85",
      altoM: "2",
      anchoM: "2",
      desperdicioPct: "1",
    });
    const { m2Linea, subtotal } = computeLineaPresupuesto(mesada, line);
    expect(m2Linea).toBeCloseTo(4.04, 2);
    expect(subtotal).toBeCloseTo(4.04 * 85, 2);
  });

  it("M2 manual 10 m² totales", () => {
    const asador = articuloConPrecioToMock(
      art({
        id: "2",
        codigo: "MES-ASA",
        descripcion: "Mesada de asador",
        unidad: "M2",
        prefer_modo_manual: true,
      }),
    );
    const line = buildLineaCalcInput(asador, {
      articuloId: "2",
      modoIngreso: "manual",
      cantidad: "10",
      precioUnitario: "80",
      altoM: "",
      anchoM: "",
      desperdicioPct: "",
    });
    const { m2Linea } = computeLineaPresupuesto(asador, line);
    expect(m2Linea).toBe(10);
  });

  it("bacha MO no calcula material → m² = 0", () => {
    const bacha = articuloConPrecioToMock(
      art({
        id: "3",
        codigo: "BACH-MO",
        descripcion: "Bacha integrada — mano de obra",
        unidad: "UNI",
        calcula_material: false,
      }),
    );
    const line = buildLineaCalcInput(bacha, {
      articuloId: "3",
      modoIngreso: "dimensiones",
      cantidad: "5",
      precioUnitario: "45",
      altoM: "1",
      anchoM: "1",
      desperdicioPct: "0",
    });
    const { m2Linea, subtotal } = computeLineaPresupuesto(bacha, line);
    expect(m2Linea).toBe(0);
    expect(subtotal).toBe(225);
  });

  it("ML se cobra por metro lineal y no suma m²", () => {
    const inglete = articuloConPrecioToMock(
      art({ id: "4", codigo: "ING", descripcion: "Inglete", unidad: "ML" }),
    );
    const line = buildLineaCalcInput(inglete, {
      articuloId: "4",
      modoIngreso: "dimensiones",
      cantidad: "2",
      precioUnitario: "35",
      altoM: "0.5",
      anchoM: "",
      desperdicioPct: "",
    });
    const { m2Linea, mlLinea, subtotal } = computeLineaPresupuesto(inglete, line);
    expect(m2Linea).toBe(0);
    expect(mlLinea).toBe(2);
    expect(subtotal).toBe(70);
  });

  it("UNI no suma m² aunque tenga medida estándar", () => {
    const prueba = articuloConPrecioToMock(
      art({
        id: "5",
        codigo: "COR",
        descripcion: "Corte",
        unidad: "UNI",
        medida_estandar_m2: 3,
      }),
    );
    const line = buildLineaCalcInput(prueba, {
      articuloId: "5",
      modoIngreso: "dimensiones",
      cantidad: "2",
      precioUnitario: "50",
      altoM: "",
      anchoM: "",
      desperdicioPct: "",
    });
    const { m2Linea, subtotal } = computeLineaPresupuesto(prueba, line);
    expect(m2Linea).toBe(0);
    expect(subtotal).toBe(100);
  });

  it("sub-ítem Pieza (m²) cobra m² × precio del material, no el fijo de Trabajos", () => {
    const pieza = articuloConPrecioToMock(
      art({
        id: "pieza",
        codigo: "PIEZA",
        descripcion: "Pieza",
        unidad: "M2",
        precio: 100,
      }),
    );
    const precioMaterial = 85;
    expect(esArticuloCobraMaterial(pieza.codigo)).toBe(true);
    expect(
      precioSugeridoLinea({
        codigoArticulo: pieza.codigo,
        precioTrabajo: 100,
        precioMaterial,
      }),
    ).toBe("85");

    const line = buildLineaCalcInput(pieza, {
      articuloId: "pieza",
      modoIngreso: "dimensiones",
      cantidad: "1",
      precioUnitario: precioSugeridoLinea({
        codigoArticulo: pieza.codigo,
        precioTrabajo: 100,
        precioMaterial,
      }),
      altoM: "2",
      anchoM: "2",
      desperdicioPct: "0",
    });
    const { m2Linea, subtotal } = computeLineaPresupuesto(pieza, line);
    expect(m2Linea).toBeCloseTo(4, 5);
    expect(subtotal).toBeCloseTo(4 * 85, 5);
  });

  it("Revestimiento usa el precio fijo del trabajo, no el del material", () => {
    const rev = articuloConPrecioToMock(
      art({
        id: "rev",
        codigo: "REV",
        descripcion: "Revestimiento",
        unidad: "M2",
        precio: 40,
      }),
    );
    expect(esArticuloCobraMaterial(rev.codigo)).toBe(false);
    expect(
      precioSugeridoLinea({
        codigoArticulo: rev.codigo,
        precioTrabajo: 40,
        precioMaterial: 85,
      }),
    ).toBe("40");

    const line = buildLineaCalcInput(rev, {
      articuloId: "rev",
      modoIngreso: "dimensiones",
      cantidad: "1",
      precioUnitario: precioSugeridoLinea({
        codigoArticulo: rev.codigo,
        precioTrabajo: 40,
        precioMaterial: 85,
      }),
      altoM: "2",
      anchoM: "1",
      desperdicioPct: "0",
    });
    const { m2Linea, subtotal } = computeLineaPresupuesto(rev, line);
    expect(m2Linea).toBeCloseTo(2, 5);
    expect(subtotal).toBeCloseTo(80, 5);
  });

  it("PIEZA, KG y TON se cobran por cantidad y no suman m²", () => {
    for (const unidad of ["PIEZA", "KG", "TON"] as const) {
      const item = articuloConPrecioToMock(
        art({ id: unidad, codigo: unidad, descripcion: unidad, unidad }),
      );
      const line = buildLineaCalcInput(item, {
        articuloId: unidad,
        modoIngreso: "dimensiones",
        cantidad: "3",
        precioUnitario: "20",
        altoM: "",
        anchoM: "",
        desperdicioPct: "",
      });
      const { m2Linea, subtotal } = computeLineaPresupuesto(item, line);
      expect(m2Linea).toBe(0);
      expect(subtotal).toBe(60);
    }
  });
});

describe("equivalentesMonedaMixta", () => {
  it("producto USD + MEC ARS con dólar del día", () => {
    const r = equivalentesMonedaMixta({
      items: 100,
      monedaItems: "usd",
      mecArs: 1250,
      dolarHoy: 1250,
    });
    expect(r.totalUsd).toBeCloseTo(101, 4);
    expect(r.totalArs).toBeCloseTo(126250, 2);
    expect(r.totalEnMonedaItems).toBeCloseTo(101, 4);
  });
});

describe("computePresupuestoTotalM2", () => {
  it("suma m² de varias OTs", () => {
    const articulos: ArticuloConPrecio[] = [
      art({ id: "1", codigo: "MES-ALZ", descripcion: "Mesada", unidad: "M2" }),
      art({ id: "3", codigo: "BACH-MO", descripcion: "Bacha MO", unidad: "UNI", calcula_material: false }),
    ];
    const ordenes: OrdenTrabajoWizard[] = [
      {
        key: "ot1",
        titulo: "Cocina",
        fecha: "",
        tecnicoId: "",
        fechaMedicion: "",
        fechaEntrega: "",
        materialId: "mat",
        chapaSugeridaId: null,
        chapaSugeridaBulto: "",
        chapaSugeridaLabel: "",
        tipoColocacion: "bajo",
        bachaId: "sin",
        llevaBacha: false,
        bachaOrigen: "propia",
        items: [
          {
            key: "l1",
            articuloId: "1",
            modoIngreso: "dimensiones",
            cantidad: "1",
            precioUnitario: "85",
            altoM: "2",
            anchoM: "2",
            desperdicioPct: "1",
          },
        ],
        direccionObra: "",
        obraLat: null,
        obraLng: null,
        obraFormattedAddress: "",
        referenciaObra: "",
        planoAdjunto: null,
        mMedicion: true,
        mEntrega: true,
        mColocacion: true,
        totalMec: "1",
        excluirMec: false,
        obsMec: "",
        panelExpandido: true,
      },
      {
        key: "ot2",
        titulo: "Baño",
        fecha: "",
        tecnicoId: "",
        fechaMedicion: "",
        fechaEntrega: "",
        materialId: "mat",
        chapaSugeridaId: null,
        chapaSugeridaBulto: "",
        chapaSugeridaLabel: "",
        tipoColocacion: "bajo",
        bachaId: "sin",
        llevaBacha: false,
        bachaOrigen: "propia",
        items: [
          {
            key: "l2",
            articuloId: "1",
            modoIngreso: "manual",
            cantidad: "3",
            precioUnitario: "85",
            altoM: "",
            anchoM: "",
            desperdicioPct: "",
          },
          {
            key: "l3",
            articuloId: "3",
            modoIngreso: "dimensiones",
            cantidad: "2",
            precioUnitario: "45",
            altoM: "",
            anchoM: "",
            desperdicioPct: "",
          },
        ],
        direccionObra: "",
        obraLat: null,
        obraLng: null,
        obraFormattedAddress: "",
        referenciaObra: "",
        planoAdjunto: null,
        mMedicion: true,
        mEntrega: true,
        mColocacion: true,
        totalMec: "1",
        excluirMec: false,
        obsMec: "",
        panelExpandido: true,
      },
    ];
    const total = computePresupuestoTotalM2(ordenes, articulos);
    expect(total).toBeCloseTo(4.04 + 3, 2);
  });
});

describe("trioM2DeOrden", () => {
  const articulos: ArticuloConPrecio[] = [
    art({ id: "1", codigo: "MES-ALZ", descripcion: "Mesada", unidad: "M2", precio: 100 }),
  ];

  function otM2(key: string, cantidad: string): OrdenTrabajoWizard {
    return {
      key,
      titulo: key,
      fecha: "",
      tecnicoId: "",
      fechaMedicion: "",
      fechaEntrega: "",
      materialId: "",
      chapaSugeridaId: null,
      chapaSugeridaBulto: "",
      chapaSugeridaLabel: "",
      tipoColocacion: "bajo",
      bachaId: "",
      llevaBacha: false,
      bachaOrigen: "propia",
      items: [
        {
          key: "l1",
          articuloId: "1",
          modoIngreso: "manual",
          cantidad,
          precioUnitario: "100",
          altoM: "",
          anchoM: "",
          desperdicioPct: "",
        },
      ],
      direccionObra: "",
      obraLat: null,
      obraLng: null,
      obraFormattedAddress: "",
      referenciaObra: "",
      planoAdjunto: null,
      mMedicion: false,
      mEntrega: false,
      mColocacion: false,
      totalMec: "",
      excluirMec: false,
      obsMec: "",
      panelExpandido: true,
    };
  }

  it("parte m² venta/obra por orden.key", () => {
    const venta = [otM2("cocina", "4"), otM2("bano", "2")];
    const obra = [otM2("cocina", "4.5"), otM2("bano", "2")];
    const cocina = trioM2DeOrden({
      ordenKey: "cocina",
      ordenesVenta: venta,
      ordenesObra: obra,
      articulos,
    });
    expect(cocina.venta).toBeCloseTo(4, 2);
    expect(cocina.obra).toBeCloseTo(4.5, 2);
    expect(cocina.dif).toBeCloseTo(0.5, 2);
  });

  it("sin orden_key usa el total del presupuesto", () => {
    const venta = [otM2("cocina", "4"), otM2("bano", "2")];
    const obra = [otM2("cocina", "5"), otM2("bano", "2")];
    const t = trioM2DeOrden({
      ordenKey: null,
      ordenesVenta: venta,
      ordenesObra: obra,
      articulos,
    });
    expect(t.venta).toBeCloseTo(6, 2);
    expect(t.obra).toBeCloseTo(7, 2);
    expect(t.dif).toBeCloseTo(1, 2);
  });
});

describe("normalizeLineaItemFromPayload", () => {
  it("convierte altoCm histórico a metros", () => {
    const line = normalizeLineaItemFromPayload({
      key: "k",
      articuloId: "1",
      modoIngreso: "dimensiones",
      cantidad: "1",
      precioUnitario: "85",
      altoCm: "200",
      anchoCm: "250",
      desperdicioPct: "1",
    });
    expect(line.altoM).toBe("2");
    expect(line.anchoM).toBe("2.5");
  });
});

describe("formatMetraje", () => {
  it("muestra 4 m² como 4,00 y no como 4,000", () => {
    expect(formatMetraje(4)).toBe("4,00");
    expect(formatMetraje(4)).not.toBe("4,000");
  });

  it("conserva hasta 3 decimales útiles", () => {
    expect(formatMetraje(4.125)).toBe("4,125");
  });
});

describe("computePresupuestoComercial", () => {
  const articulos: ArticuloConPrecio[] = [
    art({ id: "1", codigo: "MES-ALZ", descripcion: "Mesada", unidad: "M2", precio: 100 }),
  ];

  function otBase(patch: Partial<OrdenTrabajoWizard> = {}): OrdenTrabajoWizard {
    return {
      key: "ot1",
      titulo: "Cocina",
      fecha: "",
      tecnicoId: "",
      fechaMedicion: "",
      fechaEntrega: "",
      materialId: "mat",
      chapaSugeridaId: null,
      chapaSugeridaBulto: "",
      chapaSugeridaLabel: "",
      tipoColocacion: "bajo",
      bachaId: "sin",
      llevaBacha: false,
      bachaOrigen: "propia",
      items: [
        {
          key: "l1",
          articuloId: "1",
          modoIngreso: "manual",
          cantidad: "10",
          precioUnitario: "100",
          altoM: "",
          anchoM: "",
          desperdicioPct: "",
        },
      ],
      direccionObra: "",
      obraLat: null,
      obraLng: null,
      obraFormattedAddress: "",
      referenciaObra: "",
      planoAdjunto: null,
      mMedicion: true,
      mEntrega: true,
      mColocacion: true,
      totalMec: "1",
      excluirMec: false,
      obsMec: "",
      panelExpandido: true,
      ...patch,
    };
  }

  it("el descuento no come el MEC", () => {
    const r = computePresupuestoComercial({
      ordenes: [otBase()],
      articulos,
      descuentoGlobalPct: "10",
      mMedicionGlobal: true,
      mEntregaGlobal: true,
      mColocacionGlobal: true,
      totalMecGlobal: "200",
    });
    expect(r.subtotalItems).toBe(1000);
    expect(r.netoItems).toBe(900);
    expect(r.mec).toBe(200);
    expect(r.total).toBe(1100);
  });

  it("si todas las OTs excluyen MEC el importe es 0", () => {
    const r = computePresupuestoComercial({
      ordenes: [otBase({ excluirMec: true, obsMec: "mesa redonda" })],
      articulos,
      descuentoGlobalPct: "0",
      mMedicionGlobal: true,
      mEntregaGlobal: true,
      mColocacionGlobal: true,
      totalMecGlobal: "200",
    });
    expect(r.mec).toBe(0);
    expect(r.total).toBe(1000);
    expect(
      importeMecPresupuesto({
        mMedicion: true,
        mEntrega: true,
        mColocacion: true,
        totalMec: "200",
        ordenes: [otBase({ excluirMec: true })],
      }),
    ).toBe(0);
  });

  it("recalcula m² y $ aunque el artículo no esté en el catálogo", () => {
    const r = computePresupuestoComercial({
      ordenes: [
        otBase({
          items: [
            {
              key: "l1",
              articuloId: "inactivo-o-borrado",
              modoIngreso: "dimensiones",
              cantidad: "1",
              precioUnitario: "200",
              altoM: "2.5",
              anchoM: "3.5",
              desperdicioPct: "",
            },
          ],
        }),
      ],
      articulos: [],
      descuentoGlobalPct: "0",
      mMedicionGlobal: true,
      mEntregaGlobal: true,
      mColocacionGlobal: true,
      totalMecGlobal: "200",
    });
    expect(r.m2).toBeCloseTo(8.75, 2);
    expect(r.subtotalItems).toBeCloseTo(1750, 2);
    expect(r.mec).toBe(200);
    expect(r.total).toBeCloseTo(1950, 2);
  });
});

describe("normalizeOrdenesFromPayload MEC", () => {
  it("lee excluirMec y obsMec", () => {
    const ordenes = normalizeOrdenesFromPayload([
      {
        key: "ot1",
        titulo: "Mesa",
        excluirMec: true,
        obsMec: "mesa redonda",
        items: [],
      },
    ]);
    expect(ordenes[0]?.excluirMec).toBe(true);
    expect(ordenes[0]?.obsMec).toBe("mesa redonda");
  });
});
