import { describe, expect, it } from "vitest";
import {
  articuloConPrecioToMock,
  buildLineaCalcInput,
  computeLineaPresupuesto,
  computePresupuestoTotalM2,
  formatMetraje,
} from "@/lib/presupuesto-calculos";
import { normalizeLineaItemFromPayload } from "@/lib/presupuesto-payload-normalize";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { OrdenTrabajoWizard } from "@/components/presupuesto/wizard/types";

function art(partial: Partial<ArticuloConPrecio> & Pick<ArticuloConPrecio, "id" | "codigo" | "descripcion" | "unidad">): ArticuloConPrecio {
  return {
    calcula_material: true,
    medida_estandar_m2: null,
    prefer_modo_manual: false,
    sort_order: 0,
    precio: 100,
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
        panelExpandido: true,
      },
    ];
    const total = computePresupuestoTotalM2(ordenes, articulos);
    expect(total).toBeCloseTo(4.04 + 3, 2);
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
