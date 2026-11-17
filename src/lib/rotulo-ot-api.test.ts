import { describe, expect, it } from "vitest";
import {
  alturaZocaloCm,
  armarRotuloOt,
  formatoDimRotulo,
  formatoFechaEntregaRotulo,
  textoBachaRotulo,
  textoComoVaRotulo,
  textoMedidasPiezaRotulo,
  textoNotasRotulo,
  textoTelefonoRotulo,
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
  it("sin requisito queda en raya", () => {
    expect(
      textoBachaRotulo({
        requerida: false,
        tipo: "Johnson — Acero Premium",
        origen: "propia",
      }),
    ).toEqual({ titulo: "—", detalle: null });
  });

  it("modelo y origen, sin colocación", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: true,
        tipo: "Johnson — Acero Premium",
        origen: "propia",
      }),
    ).toEqual({
      titulo: "Johnson — Acero Premium",
      detalle: "Nuestra",
    });
  });

  it("bacha del cliente", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: true,
        tipo: "Franke — Orion 70",
        origen: "cliente",
      }),
    ).toEqual({
      titulo: "Franke — Orion 70",
      detalle: "Del cliente",
    });
  });

  it("sin tipo ni extras", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: true,
        tipo: "  ",
        origen: null,
      }),
    ).toEqual({ titulo: "Bacha", detalle: null });
  });

  it("sin tipo usa origen", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: true,
        tipo: null,
        origen: "propia",
      }),
    ).toEqual({ titulo: "Bacha", detalle: "Nuestra" });
  });

  it("pendiente: empieza con Bacha pendiente y sigue tipo y origen", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: false,
        tipo: "Franke — Orion 70",
        origen: "cliente",
      }),
    ).toEqual({
      titulo: "Bacha pendiente",
      detalle: "Franke — Orion 70 · Del cliente",
    });
  });

  it("pendiente sin tipo", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        tipo: "  ",
        origen: null,
      }),
    ).toEqual({
      titulo: "Bacha pendiente",
      detalle: null,
    });
  });

  it("pendiente sin tipo muestra origen", () => {
    expect(
      textoBachaRotulo({
        requerida: true,
        asignada: false,
        tipo: null,
        origen: "cliente",
      }),
    ).toEqual({
      titulo: "Bacha pendiente",
      detalle: "Del cliente",
    });
  });

  it("asignada no dice Bacha pendiente", () => {
    const r = textoBachaRotulo({
      requerida: true,
      asignada: true,
      tipo: "Johnson — Acero Premium",
      origen: "propia",
    });
    expect(`${r.titulo} · ${r.detalle}`).not.toContain("Bacha pendiente");
  });

  it("sin bacha no dice Bacha pendiente", () => {
    const r = textoBachaRotulo({
      requerida: false,
      asignada: false,
      tipo: "Johnson — Acero Premium",
      origen: "propia",
    });
    expect(r.titulo).toBe("—");
    expect(r.titulo).not.toContain("Bacha pendiente");
  });
});

describe("textoComoVaRotulo", () => {
  it("sin bacha queda en raya", () => {
    expect(textoComoVaRotulo({ requerida: false, colocacion: "bajo" })).toBe("—");
  });

  it("sin colocación queda en raya", () => {
    expect(textoComoVaRotulo({ requerida: true, colocacion: null })).toBe("—");
    expect(textoComoVaRotulo({ requerida: true, colocacion: "  " })).toBe("—");
  });

  it("muestra la colocación", () => {
    expect(textoComoVaRotulo({ requerida: true, colocacion: "bajo" })).toBe("Bajo mesada");
    expect(textoComoVaRotulo({ requerida: true, colocacion: "sobre" })).toBe("Sobre mesada");
    expect(textoComoVaRotulo({ requerida: true, colocacion: "ras" })).toBe("Al ras");
  });
});

describe("textoTelefonoRotulo", () => {
  it("vacío queda en raya", () => {
    expect(textoTelefonoRotulo(null)).toBe("—");
    expect(textoTelefonoRotulo("  ")).toBe("—");
  });

  it("muestra el número", () => {
    expect(textoTelefonoRotulo("2615122347")).toBe("2615122347");
  });
});

describe("textoNotasRotulo", () => {
  it("vacío queda en raya", () => {
    expect(textoNotasRotulo(null)).toBe("—");
    expect(textoNotasRotulo("  ")).toBe("—");
  });

  it("muestra el texto", () => {
    expect(textoNotasRotulo("No cortar el mueble")).toBe("No cortar el mueble");
  });
});

describe("alturaZocaloCm", () => {
  it("usa el alto si es de hasta 50 cm", () => {
    expect(alturaZocaloCm({ altoM: "0,05" })).toBe(5);
  });

  it("en m² toma el lado menor", () => {
    expect(
      alturaZocaloCm({
        muestraAncho: true,
        altoM: "2,40",
        anchoM: "0,10",
      }),
    ).toBe(10);
  });

  it("sin medida chica usa 10 cm", () => {
    expect(alturaZocaloCm({ altoM: "2,40" })).toBe(10);
    expect(alturaZocaloCm({})).toBe(10);
  });
});

describe("textoZocaloRotulo", () => {
  it("altura en cm con código ZOC-M2", () => {
    expect(
      textoZocaloRotulo([
        {
          articuloCodigo: "ZOC-M2",
          articuloLabel: "Zócalo",
          muestraAlto: true,
          muestraAncho: true,
          altoM: "2,40",
          anchoM: "0,05",
        },
      ]),
    ).toBe("5 cm");
  });

  it("altura en cm con código viejo ZOC-ML", () => {
    expect(
      textoZocaloRotulo([
        { articuloCodigo: "zoc-ml", articuloLabel: "ML", altoM: "0,10" },
      ]),
    ).toBe("10 cm");
  });

  it("por descripción aunque el código no coincida", () => {
    expect(
      textoZocaloRotulo([
        { articuloCodigo: "OTRO", articuloLabel: "Zócalo cocina", altoM: "0,07" },
      ]),
    ).toBe("7 cm");
  });

  it("raya si no hay zócalo", () => {
    expect(
      textoZocaloRotulo([{ articuloCodigo: "PIEZA", articuloLabel: "Mesada" }]),
    ).toBe("—");
    expect(textoZocaloRotulo([])).toBe("—");
  });

  it("lista alturas distintas", () => {
    expect(
      textoZocaloRotulo([
        {
          articuloCodigo: "ZOC-M2",
          articuloLabel: "Zócalo",
          muestraAncho: true,
          altoM: "2,00",
          anchoM: "0,05",
        },
        {
          articuloCodigo: "ZOC-M2",
          articuloLabel: "Zócalo",
          muestraAncho: true,
          altoM: "1,20",
          anchoM: "0,07",
        },
      ]),
    ).toBe("5 cm · 7 cm");
  });
});

describe("armarRotuloOt", () => {
  it("arma la hoja con título, fecha, bacha y piezas", () => {
    const rotulo = armarRotuloOt({
      titulo: "Mesada cocina",
      presupuestoNumero: "1842",
      fechaProgramada: "2026-10-18",
      cliente: "Familia García",
      telefono: "2615122347",
      direccion: "Av. San Martín 1240, San Rafael",
      material: "Silestone Blanco Zeus",
      bachaRequerida: true,
      bachaAsignada: true,
      bachaTipo: "Johnson — Acero Premium",
      bachaOrigen: "propia",
      bachaColocacion: "bajo",
      notas: "En obra, en contenedor",
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
    expect(rotulo.telefono).toBe("2615122347");
    expect(rotulo.zocalo).toBe("—");
    expect(rotulo.bachaTitulo).toBe("Johnson — Acero Premium");
    expect(rotulo.bachaDetalle).toBe("Nuestra");
    expect(rotulo.comoVa).toBe("Bajo mesada");
    expect(rotulo.notas).toBe("En obra, en contenedor");
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
    expect(rotulo.telefono).toBe("—");
    expect(rotulo.zocalo).toBe("—");
    expect(rotulo.bachaTitulo).toBe("—");
    expect(rotulo.comoVa).toBe("—");
    expect(rotulo.notas).toBe("—");
    expect(rotulo.piezas).toEqual([]);
  });

  it("marca bacha pendiente y zócalo cuando corresponde", () => {
    const rotulo = armarRotuloOt({
      titulo: "Cocina — mesada principal",
      presupuestoNumero: "1842",
      fechaProgramada: "2026-10-18",
      cliente: "Familia García",
      telefono: "2615122347",
      direccion: "Av. San Martín 1240",
      material: "Granito negro",
      bachaRequerida: true,
      bachaAsignada: false,
      bachaTipo: "Franke — Orion 70",
      bachaOrigen: "cliente",
      bachaColocacion: "bajo",
      notas: "No cortar",
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
    expect(rotulo.zocalo).toBe("10 cm");
    expect(rotulo.bachaTitulo).toBe("Bacha pendiente");
    expect(rotulo.bachaDetalle).toBe("Franke — Orion 70 · Del cliente");
    expect(rotulo.comoVa).toBe("Bajo mesada");
    expect(rotulo.notas).toBe("No cortar");
  });
});
