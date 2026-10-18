import { describe, expect, it } from "vitest";
import {
  armarRotuloOt,
  formatoDimRotulo,
  formatoFechaEntregaRotulo,
  textoBachaRotulo,
  textoMedidasPiezaRotulo,
  textoNafeRotulo,
  textoZocaloRotulo,
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
        asignada: true,
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
        asignada: true,
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
        asignada: true,
        tipo: "  ",
        origen: null,
        colocacion: null,
      }),
    ).toEqual({ titulo: "Bacha", detalle: null });
  });

  it("sin tipo usa colocación y origen", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: true,
        tipo: null,
        origen: "propia",
        colocacion: "bajo",
      }),
    ).toEqual({ titulo: "Bajo mesada", detalle: "Nuestra" });
  });

  it("pendiente: empieza con Bacha pendiente y sigue tipo, origen y colocación", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: false,
        tipo: "Franke — Orion 70",
        origen: "cliente",
        colocacion: "bajo",
      }),
    ).toEqual({
      titulo: "Bacha pendiente",
      detalle: "Franke — Orion 70 · Del cliente · Bajo mesada",
    });
  });

  it("pendiente sin tipo", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        tipo: "  ",
        origen: null,
        colocacion: null,
      }),
    ).toEqual({
      titulo: "Bacha pendiente",
      detalle: null,
    });
  });

  it("pendiente sin tipo muestra origen y colocación", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: false,
        tipo: null,
        origen: "cliente",
        colocacion: "bajo",
      }),
    ).toEqual({
      titulo: "Bacha pendiente",
      detalle: "Del cliente · Bajo mesada",
    });
  });

  it("asignada no dice Bacha pendiente", () => {
    const r = textoBachaRotulo({
      requerida: true,
      asignada: true,
      tipo: "Johnson — Acero Premium",
      origen: "propia",
      colocacion: "bajo",
    });
    expect(`${r.titulo} · ${r.detalle}`).not.toContain("Bacha pendiente");
  });

  it("sin bacha no dice Bacha pendiente", () => {
    const r = textoBachaRotulo({
      requerida: false,
      asignada: false,
      tipo: "Johnson — Acero Premium",
      origen: "propia",
      colocacion: "bajo",
    });
    expect(r.titulo).toBe("Sin bacha");
    expect(r.titulo).not.toContain("Bacha pendiente");
  });
});

describe("textoZocaloRotulo", () => {
  it("Sí con código ZOC-M2", () => {
    expect(
      textoZocaloRotulo([{ articuloCodigo: "ZOC-M2", articuloLabel: "Zócalo" }]),
    ).toBe("Sí");
  });

  it("Sí con código viejo ZOC-ML", () => {
    expect(textoZocaloRotulo([{ articuloCodigo: "zoc-ml", articuloLabel: "ML" }])).toBe(
      "Sí",
    );
  });

  it("Sí por descripción aunque el código no coincida", () => {
    expect(
      textoZocaloRotulo([{ articuloCodigo: "OTRO", articuloLabel: "Zócalo cocina" }]),
    ).toBe("Sí");
  });

  it("No si no hay zócalo", () => {
    expect(
      textoZocaloRotulo([{ articuloCodigo: "PIEZA", articuloLabel: "Mesada" }]),
    ).toBe("No");
    expect(textoZocaloRotulo([])).toBe("No");
  });
});

describe("textoNafeRotulo", () => {
  it("vacío queda en raya", () => {
    expect(textoNafeRotulo(null)).toBe("—");
    expect(textoNafeRotulo("  ")).toBe("—");
  });

  it("muestra el valor cargado", () => {
    expect(textoNafeRotulo("Pulido")).toBe("Pulido");
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
      bachaAsignada: true,
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
    expect(rotulo.ambiente).toBe("Mesada cocina");
    expect(rotulo.presupuestoNumero).toBe("1842");
    expect(rotulo.fechaEntrega).toBe("18/10/2026");
    expect(rotulo.zocalo).toBe("No");
    expect(rotulo.nafe).toBe("—");
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
    expect(rotulo.ambiente).toBe("—");
    expect(rotulo.fechaEntrega).toBe("Sin fecha");
    expect(rotulo.cliente).toBe("—");
    expect(rotulo.zocalo).toBe("No");
    expect(rotulo.bachaTitulo).toBe("Sin bacha");
    expect(rotulo.piezas).toEqual([]);
  });

  it("marca bacha pendiente y zócalo cuando corresponde", () => {
    const rotulo = armarRotuloOt({
      titulo: "Cocina — mesada principal",
      presupuestoNumero: "1842",
      fechaProgramada: "2026-10-18",
      cliente: "Familia García",
      direccion: "Av. San Martín 1240",
      material: "Granito negro",
      bachaRequerida: true,
      bachaAsignada: false,
      bachaTipo: "Franke — Orion 70",
      bachaOrigen: "cliente",
      bachaColocacion: "bajo",
      nafe: "Pulido",
      piezas: [
        {
          articuloLabel: "Mesada",
          articuloCodigo: "PIEZA",
          muestraAlto: true,
          muestraAncho: true,
          altoM: "2,40",
          anchoM: "0,60",
          cantidad: "1",
          m2Approx: 1.44,
        },
        {
          articuloLabel: "Zócalo",
          articuloCodigo: "ZOC-M2",
          muestraAlto: true,
          muestraAncho: true,
          altoM: "2,40",
          anchoM: "0,10",
          cantidad: "1",
          m2Approx: 0.24,
        },
      ],
    });
    expect(rotulo.ambiente).toBe("Cocina — mesada principal");
    expect(rotulo.zocalo).toBe("Sí");
    expect(rotulo.nafe).toBe("Pulido");
    expect(rotulo.bachaTitulo).toBe("Bacha pendiente");
    expect(rotulo.bachaDetalle).toBe("Franke — Orion 70 · Del cliente · Bajo mesada");
  });
});
