import { describe, expect, it } from "vitest";
import {
  armarRotuloOt,
  formatoDimRotulo,
  formatoFechaEntregaRotulo,
  textoBachaRotulo,
  textoMedidasPiezaRotulo,
} from "./rotulo-ot-api";

describe("formatoFechaEntregaRotulo", () => {
  it("formatea YYYY-MM-DD", () => {
    expect(formatoFechaEntregaRotulo("2026-10-18")).toBe("18/10/2026");
  });

  it("toma el día de un timestamp", () => {
    expect(formatoFechaEntregaRotulo("2026-10-18T15:00:00.000Z")).toBe("18/10/2026");
  });

  it("sin fecha queda en texto", () => {
    expect(formatoFechaEntregaRotulo(null)).toBe("Sin fecha");
    expect(formatoFechaEntregaRotulo("")).toBe("Sin fecha");
    expect(formatoFechaEntregaRotulo("corto")).toBe("Sin fecha");
  });
});

describe("formatoDimRotulo", () => {
  it("usa coma decimal", () => {
    expect(formatoDimRotulo("2.4")).toBe("2,4");
    expect(formatoDimRotulo("2,40")).toBe("2,4");
  });

  it("vacío queda en raya", () => {
    expect(formatoDimRotulo("")).toBe("—");
  });
});

describe("textoMedidasPiezaRotulo", () => {
  it("muestra alto por ancho en metros", () => {
    expect(
      textoMedidasPiezaRotulo({
        muestraAlto: true,
        muestraAncho: true,
        altoM: "2,40",
        anchoM: "0,60",
        cantidad: "1",
      }),
    ).toBe("2,4 × 0,6 m");
  });

  it("sin dimensiones usa cantidad", () => {
    expect(
      textoMedidasPiezaRotulo({
        muestraAlto: false,
        muestraAncho: false,
        altoM: "",
        anchoM: "",
        cantidad: "3",
      }),
    ).toBe("cant. 3");
  });
});

describe("textoBachaRotulo", () => {
  it("sin requisito", () => {
    expect(
      textoBachaRotulo({
        requerida: false,
        tipo: "Johnson — Acero Premium",
        origen: "propia",
        colocacion: "bajo",
      }),
    ).toEqual({ titulo: "Sin bacha", detalle: null });
  });

  it("modelo, origen y colocación", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        tipo: "Johnson — Acero Premium",
        origen: "propia",
        colocacion: "bajo",
      }),
    ).toEqual({
      titulo: "Johnson — Acero Premium",
      detalle: "Nuestra · Bajo mesada",
    });
  });

  it("bacha del cliente", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        tipo: "Franke — Orion 70",
        origen: "cliente",
        colocacion: "sobre",
      }),
    ).toEqual({
      titulo: "Franke — Orion 70",
      detalle: "Del cliente · Sobre mesada",
    });
  });

  it("sin tipo ni extras", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        tipo: "  ",
        origen: null,
        colocacion: null,
      }),
    ).toEqual({ titulo: "Sin especificar", detalle: null });
  });
});

describe("armarRotuloOt", () => {
  it("arma la hoja con título, fecha, bacha y piezas", () => {
    const rotulo = armarRotuloOt({
      titulo: "Mesada cocina",
      presupuestoNumero: "1842",
      fechaProgramada: "2026-10-18",
      cliente: "Familia García",
      direccion: "Av. San Martín 1240, San Rafael",
      material: "Silestone Blanco Zeus",
      bachaRequerida: true,
      bachaTipo: "Johnson — Acero Premium",
      bachaOrigen: "propia",
      bachaColocacion: "bajo",
      piezas: [
        {
          articuloLabel: "Mesada",
          muestraAlto: true,
          muestraAncho: true,
          altoM: "2,40",
          anchoM: "0,60",
          cantidad: "1",
          m2Approx: 1.44,
        },
      ],
    });
    expect(rotulo.titulo).toBe("Mesada cocina");
    expect(rotulo.presupuestoNumero).toBe("1842");
    expect(rotulo.fechaEntrega).toBe("18/10/2026");
    expect(rotulo.bachaTitulo).toBe("Johnson — Acero Premium");
    expect(rotulo.bachaDetalle).toBe("Nuestra · Bajo mesada");
    expect(rotulo.piezas).toEqual([
      { articulo: "Mesada", medidas: "2,4 × 0,6 m", m2: "1,44" },
    ]);
  });

  it("completa título vacío con el número de presupuesto", () => {
    const rotulo = armarRotuloOt({
      titulo: "  ",
      presupuestoNumero: "1842",
      fechaProgramada: null,
      cliente: "",
      direccion: "",
      material: "",
      bachaRequerida: false,
      bachaTipo: null,
      bachaOrigen: null,
      bachaColocacion: null,
      piezas: [],
    });
    expect(rotulo.titulo).toBe("OT · 1842");
    expect(rotulo.fechaEntrega).toBe("Sin fecha");
    expect(rotulo.cliente).toBe("—");
    expect(rotulo.bachaTitulo).toBe("Sin bacha");
    expect(rotulo.piezas).toEqual([]);
  });
});
