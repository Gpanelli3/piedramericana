import { describe, expect, it } from "vitest";
import {
  chipsFiltros,
  clienteKeyDe,
  clientePasaFiltros,
  contarFiltrosActivos,
  FILTROS_LISTA_VACIOS,
  filaPasaFiltros,
  filaPasaTab,
  hayFiltrosPresupuestoParaCliente,
  opcionesClientes,
  opcionesVendedores,
  ordenarClientes,
  ordenarFilas,
  quitarChip,
  VENDEDOR_SIN,
  type FilaFiltroLista,
  type FiltrosLista,
} from "./lista-filtros";

function isoHaceDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

function fila(parcial: Partial<FilaFiltroLista> = {}): FilaFiltroLista {
  return {
    status: "pendiente",
    created_at: isoHaceDias(2),
    updated_at: isoHaceDias(2),
    created_by: "u1",
    client_id: "c1",
    cliente: "Acme",
    total: 100,
    saldo_misma_moneda: 40,
    ...parcial,
  };
}

const vacios: FiltrosLista = { ...FILTROS_LISTA_VACIOS };

describe("contarFiltrosActivos", () => {
  it("no cuenta el estado Todos ni campos vacíos", () => {
    expect(contarFiltrosActivos(vacios)).toBe(0);
  });

  it("suma cada control activo", () => {
    expect(
      contarFiltrosActivos({
        estado: "pendiente",
        vendedorId: "u1",
        clienteKey: "id:c1",
        soloSaldoPendiente: true,
        fechaDesde: "2026-10-13",
        fechaHasta: "2026-11-01",
      }),
    ).toBe(6);
  });
});

describe("filaPasaFiltros", () => {
  it("deja pasar con filtros vacíos", () => {
    expect(filaPasaFiltros(fila(), vacios)).toBe(true);
  });

  it("filtra por estado y por dormido", () => {
    const reciente = fila({
      status: "pendiente",
      created_at: isoHaceDias(1),
    });
    const dormido = fila({
      status: "pendiente",
      created_at: isoHaceDias(10),
    });
    const aprobado = fila({ status: "aprobado" });
    expect(filaPasaFiltros(reciente, { ...vacios, estado: "pendiente" })).toBe(true);
    expect(filaPasaFiltros(dormido, { ...vacios, estado: "pendiente" })).toBe(true);
    expect(filaPasaFiltros(dormido, { ...vacios, estado: "dormido" })).toBe(true);
    expect(filaPasaFiltros(reciente, { ...vacios, estado: "dormido" })).toBe(false);
    expect(filaPasaFiltros(aprobado, { ...vacios, estado: "aprobado" })).toBe(true);
    expect(filaPasaFiltros(aprobado, { ...vacios, estado: "pendiente" })).toBe(false);
  });

  it("filtra vendedor, cliente, saldo y fechas", () => {
    const r = fila();
    expect(filaPasaFiltros(r, { ...vacios, vendedorId: "u2" })).toBe(false);
    expect(filaPasaFiltros(r, { ...vacios, vendedorId: "u1" })).toBe(true);
    expect(filaPasaFiltros(r, { ...vacios, vendedorId: VENDEDOR_SIN })).toBe(false);
    expect(
      filaPasaFiltros(fila({ created_by: null }), { ...vacios, vendedorId: VENDEDOR_SIN }),
    ).toBe(true);
    expect(filaPasaFiltros(r, { ...vacios, clienteKey: "id:c2" })).toBe(false);
    expect(filaPasaFiltros(r, { ...vacios, clienteKey: "id:c1" })).toBe(true);
    expect(filaPasaFiltros(r, { ...vacios, soloSaldoPendiente: true })).toBe(true);
    expect(
      filaPasaFiltros(fila({ saldo_misma_moneda: 0 }), { ...vacios, soloSaldoPendiente: true }),
    ).toBe(false);
    expect(filaPasaFiltros(r, { ...vacios, fechaDesde: isoHaceDias(1).slice(0, 10) })).toBe(
      false,
    );
    expect(filaPasaFiltros(r, { ...vacios, fechaDesde: isoHaceDias(2).slice(0, 10) })).toBe(
      true,
    );
  });
});

describe("filaPasaTab", () => {
  it("combina con el estado del popover: las dos tienen que coincidir", () => {
    const aprobado = fila({ status: "aprobado" });
    const dormido = fila({
      status: "pendiente",
      created_at: isoHaceDias(10),
    });
    expect(filaPasaTab(aprobado, "aprobados")).toBe(true);
    expect(filaPasaTab(dormido, "aprobados")).toBe(false);
    expect(filaPasaTab(dormido, "dormidos")).toBe(true);
    expect(filaPasaTab(aprobado, "todos")).toBe(true);
    expect(filaPasaFiltros(aprobado, { ...vacios, estado: "pendiente" })).toBe(false);
  });
});

describe("clienteKeyDe y opciones", () => {
  it("usa id si hay client_id y nombre si no", () => {
    expect(clienteKeyDe({ client_id: "c1", cliente: "Acme" })).toBe("id:c1");
    expect(clienteKeyDe({ client_id: null, cliente: "Acme" })).toBe("nombre:acme");
  });

  it("arma vendedores y clientes únicos", () => {
    const filas = [
      fila({ created_by: "u1", vendedor_nombre: "Ana", client_id: "c1", cliente: "Acme" }),
      fila({ created_by: null, client_id: "c1", cliente: "Acme" }),
      fila({ created_by: "u2", vendedor_nombre: "Beto", client_id: null, cliente: "Beta" }),
    ];
    const vend = opcionesVendedores(filas);
    expect(vend.haySinVendedor).toBe(true);
    expect(vend.lista.map((v) => v.nombre)).toEqual(["Ana", "Beto"]);
    expect(opcionesClientes(filas).map((c) => c.nombre)).toEqual(["Acme", "Beta"]);
  });
});

describe("chips y quitarChip", () => {
  it("arma chips y los saca de a uno", () => {
    const f: FiltrosLista = {
      estado: "aprobado",
      vendedorId: "u1",
      clienteKey: "id:c1",
      soloSaldoPendiente: true,
      fechaDesde: "2026-10-13",
      fechaHasta: "",
    };
    const chips = chipsFiltros(f, { vendedorNombre: "Ana", clienteNombre: "Acme" });
    expect(chips.map((c) => c.label)).toEqual([
      "Aprobado",
      "Ana",
      "Acme",
      "Solo con saldo pendiente",
      "Desde 13/10/2026",
    ]);
    const sinDesde = quitarChip(f, "desde");
    expect(sinDesde.fechaDesde).toBe("");
    expect(quitarChip(f, "estado").estado).toBe("todos");
  });
});

describe("clientes según presupuestos", () => {
  it("sin filtros de presupuesto muestra el padrón completo", () => {
    expect(hayFiltrosPresupuestoParaCliente(vacios)).toBe(false);
    expect(
      clientePasaFiltros({ id: "c9", nombre: "Nadie" }, [], vacios),
    ).toBe(true);
  });

  it("con filtros entra quien tenga al menos un presupuesto que coincida", () => {
    const pres = [
      fila({ client_id: "c1", cliente: "Acme", status: "aprobado" }),
      fila({ client_id: "c2", cliente: "Beta", status: "pendiente" }),
    ];
    const f: FiltrosLista = { ...vacios, estado: "aprobado" };
    expect(clientePasaFiltros({ id: "c1", nombre: "Acme" }, pres, f)).toBe(true);
    expect(clientePasaFiltros({ id: "c2", nombre: "Beta" }, pres, f)).toBe(false);
    expect(clientePasaFiltros({ id: "c3", nombre: "Gamma" }, pres, f)).toBe(false);
  });
});

describe("ordenarFilas y ordenarClientes", () => {
  it("ordena presupuestos por fecha y por monto", () => {
    const filas = [
      fila({ created_at: "2026-11-01T00:00:00.000Z", total: 10, cliente: "a" }),
      fila({ created_at: "2026-11-10T00:00:00.000Z", total: 50, cliente: "b" }),
      fila({ created_at: "2026-11-05T00:00:00.000Z", total: 30, cliente: "c" }),
    ];
    expect(ordenarFilas(filas, "nuevos").map((r) => r.cliente)).toEqual(["b", "c", "a"]);
    expect(ordenarFilas(filas, "antiguos").map((r) => r.cliente)).toEqual(["a", "c", "b"]);
    expect(ordenarFilas(filas, "monto").map((r) => r.total)).toEqual([50, 30, 10]);
  });

  it("ordena clientes por última actividad y por suma de totales", () => {
    const clientes = [
      { id: "c1", nombre: "Acme", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "c2", nombre: "Beta", created_at: "2026-06-01T00:00:00.000Z" },
    ];
    const pres = [
      fila({
        client_id: "c1",
        cliente: "Acme",
        updated_at: "2026-11-20T00:00:00.000Z",
        total: 10,
      }),
      fila({
        client_id: "c2",
        cliente: "Beta",
        updated_at: "2026-11-01T00:00:00.000Z",
        total: 80,
      }),
    ];
    expect(ordenarClientes(clientes, pres, "actividad", vacios).map((c) => c.id)).toEqual([
      "c1",
      "c2",
    ]);
    expect(ordenarClientes(clientes, pres, "monto", vacios).map((c) => c.id)).toEqual([
      "c2",
      "c1",
    ]);
    expect(ordenarClientes(clientes, pres, "nuevos", vacios).map((c) => c.id)).toEqual([
      "c2",
      "c1",
    ]);
  });
});
