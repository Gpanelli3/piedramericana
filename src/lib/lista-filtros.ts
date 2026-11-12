import { fechaEnRango, formatoDiaCalendario } from "@/lib/fecha-rango";
import { presupuestoEstaDormido } from "@/lib/presupuestos-api";

export type FiltroEstadoLista =
  | "todos"
  | "pendiente"
  | "aprobado"
  | "rechazado"
  | "dormido";

export type OrdenLista = "actividad" | "nuevos" | "antiguos" | "monto";

export const VENDEDOR_TODOS = "__all__";
export const VENDEDOR_SIN = "__none__";
export const CLIENTE_TODOS = "__all__";

export const FILTRO_ESTADO_LABELS: Record<FiltroEstadoLista, string> = {
  todos: "Todos",
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  dormido: "Dormido",
};

export const FILTRO_ESTADO_VALORES: FiltroEstadoLista[] = [
  "todos",
  "pendiente",
  "aprobado",
  "rechazado",
  "dormido",
];

export const ORDEN_LISTA_LABELS: Record<OrdenLista, string> = {
  actividad: "Última actividad",
  nuevos: "Más nuevos",
  antiguos: "Más antiguos",
  monto: "Mayor monto",
};

export const ORDEN_LISTA_VALORES: OrdenLista[] = [
  "actividad",
  "nuevos",
  "antiguos",
  "monto",
];

export const ORDEN_LISTA_DEFAULT: OrdenLista = "nuevos";

export type FiltrosLista = {
  estado: FiltroEstadoLista;
  vendedorId: string;
  clienteKey: string;
  soloSaldoPendiente: boolean;
  fechaDesde: string;
  fechaHasta: string;
};

export const FILTROS_LISTA_VACIOS: FiltrosLista = {
  estado: "todos",
  vendedorId: "",
  clienteKey: "",
  soloSaldoPendiente: false,
  fechaDesde: "",
  fechaHasta: "",
};

export type FilaFiltroLista = {
  status: string;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
  vendedor_nombre?: string | null;
  client_id?: string | null;
  cliente?: string;
  total?: number;
  saldo_misma_moneda?: number | null;
};

export type TabPresupuestoLista = "dormidos" | "aprobados" | "todos";

export type ChipFiltro = { id: string; label: string };

export function clienteKeyDe(row: {
  client_id?: string | null;
  cliente?: string;
}): string {
  const id = row.client_id?.trim();
  if (id) return `id:${id}`;
  const nombre = row.cliente?.trim() ?? "";
  return nombre ? `nombre:${nombre.toLowerCase()}` : "";
}

export function opcionesVendedores(
  filas: Array<{ created_by?: string | null; vendedor_nombre?: string | null }>,
): { lista: { id: string; nombre: string }[]; haySinVendedor: boolean } {
  const map = new Map<string, string>();
  let haySinVendedor = false;
  for (const r of filas) {
    if (!r.created_by) {
      haySinVendedor = true;
      continue;
    }
    const nombre = r.vendedor_nombre?.trim() || "Sin nombre";
    if (!map.has(r.created_by)) map.set(r.created_by, nombre);
  }
  const lista = [...map.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { lista, haySinVendedor };
}

export function opcionesClientes(
  filas: Array<{ client_id?: string | null; cliente?: string }>,
): { key: string; nombre: string }[] {
  const map = new Map<string, string>();
  for (const r of filas) {
    const key = clienteKeyDe(r);
    if (!key) continue;
    if (!map.has(key)) map.set(key, r.cliente?.trim() || "Sin nombre");
  }
  return [...map.entries()]
    .map(([key, nombre]) => ({ key, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function contarFiltrosActivos(f: FiltrosLista): number {
  let n = 0;
  if (f.estado !== "todos") n += 1;
  if (f.vendedorId) n += 1;
  if (f.clienteKey) n += 1;
  if (f.soloSaldoPendiente) n += 1;
  if (f.fechaDesde) n += 1;
  if (f.fechaHasta) n += 1;
  return n;
}

export function hayFiltrosActivos(f: FiltrosLista): boolean {
  return contarFiltrosActivos(f) > 0;
}

/** En Clientes el desplegable de cliente no existe: el resto sí recorta el padrón. */
export function hayFiltrosPresupuestoParaCliente(f: FiltrosLista): boolean {
  return (
    f.estado !== "todos" ||
    Boolean(f.vendedorId) ||
    f.soloSaldoPendiente ||
    Boolean(f.fechaDesde) ||
    Boolean(f.fechaHasta)
  );
}

export function chipsFiltros(
  f: FiltrosLista,
  opts: { vendedorNombre?: string; clienteNombre?: string } = {},
): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  if (f.estado !== "todos") {
    chips.push({ id: "estado", label: FILTRO_ESTADO_LABELS[f.estado] });
  }
  if (f.vendedorId) {
    chips.push({
      id: "vendedor",
      label:
        f.vendedorId === VENDEDOR_SIN
          ? "Sin vendedor"
          : opts.vendedorNombre || "Vendedor",
    });
  }
  if (f.clienteKey) {
    chips.push({ id: "cliente", label: opts.clienteNombre || "Cliente" });
  }
  if (f.soloSaldoPendiente) {
    chips.push({ id: "saldo", label: "Solo con saldo pendiente" });
  }
  if (f.fechaDesde) {
    chips.push({ id: "desde", label: `Desde ${formatoDiaCalendario(f.fechaDesde)}` });
  }
  if (f.fechaHasta) {
    chips.push({ id: "hasta", label: `Hasta ${formatoDiaCalendario(f.fechaHasta)}` });
  }
  return chips;
}

export function quitarChip(f: FiltrosLista, id: string): FiltrosLista {
  switch (id) {
    case "estado":
      return { ...f, estado: "todos" };
    case "vendedor":
      return { ...f, vendedorId: "" };
    case "cliente":
      return { ...f, clienteKey: "" };
    case "saldo":
      return { ...f, soloSaldoPendiente: false };
    case "desde":
      return { ...f, fechaDesde: "" };
    case "hasta":
      return { ...f, fechaHasta: "" };
    default:
      return f;
  }
}

export function pasaEstado(
  row: { status: string; created_at: string },
  estado: FiltroEstadoLista,
): boolean {
  if (estado === "todos") return true;
  if (estado === "dormido") return presupuestoEstaDormido(row);
  if (estado === "pendiente") return row.status === "pendiente";
  if (estado === "aprobado") return row.status === "aprobado";
  if (estado === "rechazado") return row.status === "rechazado";
  return true;
}

export function filaPasaTab(
  row: { status: string; created_at: string },
  tab: TabPresupuestoLista,
): boolean {
  if (tab === "dormidos") return presupuestoEstaDormido(row);
  if (tab === "aprobados") return row.status === "aprobado";
  return true;
}

function tieneSaldoPendiente(saldo: number | null | undefined): boolean {
  return typeof saldo === "number" && saldo > 0.005;
}

export function filaPasaFiltros(row: FilaFiltroLista, f: FiltrosLista): boolean {
  if (!pasaEstado(row, f.estado)) return false;
  if (!fechaEnRango(row.created_at, f.fechaDesde, f.fechaHasta)) return false;
  if (f.vendedorId === VENDEDOR_SIN) {
    if (row.created_by) return false;
  } else if (f.vendedorId && row.created_by !== f.vendedorId) {
    return false;
  }
  if (f.clienteKey && clienteKeyDe(row) !== f.clienteKey) return false;
  if (f.soloSaldoPendiente && !tieneSaldoPendiente(row.saldo_misma_moneda)) {
    return false;
  }
  return true;
}

export function presupuestoDeCliente(
  presupuesto: FilaFiltroLista,
  cliente: { id: string; nombre: string },
): boolean {
  if (presupuesto.client_id) return presupuesto.client_id === cliente.id;
  return (presupuesto.cliente?.trim() ?? "") === cliente.nombre.trim();
}

export function clientePasaFiltros(
  cliente: { id: string; nombre: string },
  presupuestos: FilaFiltroLista[],
  f: FiltrosLista,
): boolean {
  if (!hayFiltrosPresupuestoParaCliente(f)) return true;
  return presupuestos.some(
    (p) => presupuestoDeCliente(p, cliente) && filaPasaFiltros(p, f),
  );
}

export function ordenarFilas<
  T extends { created_at: string; updated_at?: string; total?: number },
>(filas: T[], orden: OrdenLista): T[] {
  const copy = [...filas];
  copy.sort((a, b) => compararOrden(a, b, orden));
  return copy;
}

function compararOrden(
  a: { created_at: string; updated_at?: string; total?: number },
  b: { created_at: string; updated_at?: string; total?: number },
  orden: OrdenLista,
): number {
  switch (orden) {
    case "actividad": {
      const ta = a.updated_at || a.created_at;
      const tb = b.updated_at || b.created_at;
      return tb.localeCompare(ta);
    }
    case "nuevos":
      return b.created_at.localeCompare(a.created_at);
    case "antiguos":
      return a.created_at.localeCompare(b.created_at);
    case "monto":
      return (b.total ?? 0) - (a.total ?? 0);
    default:
      return 0;
  }
}

export function ordenarClientes<
  C extends { id: string; nombre: string; created_at: string },
>(
  clientes: C[],
  presupuestos: FilaFiltroLista[],
  orden: OrdenLista,
  f: FiltrosLista,
): C[] {
  const copy = [...clientes];
  copy.sort((a, b) => {
    const pa = presupuestosClienteParaOrden(a, presupuestos, f);
    const pb = presupuestosClienteParaOrden(b, presupuestos, f);
    if (orden === "actividad") {
      const ta = actividadCliente(a.created_at, pa);
      const tb = actividadCliente(b.created_at, pb);
      return tb.localeCompare(ta);
    }
    if (orden === "monto") {
      const ma = pa.reduce((s, p) => s + (p.total ?? 0), 0);
      const mb = pb.reduce((s, p) => s + (p.total ?? 0), 0);
      return mb - ma;
    }
    return compararOrden(
      { created_at: a.created_at },
      { created_at: b.created_at },
      orden,
    );
  });
  return copy;
}

function presupuestosClienteParaOrden(
  cliente: { id: string; nombre: string },
  presupuestos: FilaFiltroLista[],
  f: FiltrosLista,
): FilaFiltroLista[] {
  const delCliente = presupuestos.filter((p) => presupuestoDeCliente(p, cliente));
  if (!hayFiltrosPresupuestoParaCliente(f)) return delCliente;
  return delCliente.filter((p) => filaPasaFiltros(p, f));
}

function actividadCliente(
  createdAtCliente: string,
  presupuestos: Array<{ updated_at?: string; created_at: string }>,
): string {
  let max = createdAtCliente;
  for (const p of presupuestos) {
    const t = p.updated_at || p.created_at;
    if (t > max) max = t;
  }
  return max;
}
