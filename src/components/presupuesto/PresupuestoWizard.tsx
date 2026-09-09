"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getPresupuestoById,
  insertPresupuestoRow,
  updatePresupuestoRow,
} from "@/lib/presupuestos-api";
import {
  PRESUPUESTO_PAYLOAD_VERSION,
  hydratePresupuestoPayloadV1,
  isPresupuestoPayloadV1,
  type PresupuestoPayloadV1,
} from "@/types/presupuesto-payload";
import {
  Trash2,
  Save,
  Printer,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useArticulos } from "@/hooks/useArticulos";
import {
  articuloConPrecioToMock,
  buildLineaCalcInput,
  computeLineaPresupuesto,
  dimensionesHabilitadas,
  formatMetraje,
  formatToneladas,
  importeMecPresupuesto,
  labelUnidad,
  materialPesoEstimadoDesdeOt,
  todasOtsExcluyenMec,
} from "@/lib/presupuesto-calculos";
import { listClients, type ClientePresupuesto } from "@/lib/clients-api";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { listMaterials } from "@/lib/materials-api";
import { ORIGEN_VENTA_OPCIONES } from "@/data/origen-venta";
import type { LineaResumenMoneda } from "@/components/presupuesto/PresupuestoResumenInterior";
import { PresupuestoDocumento } from "@/components/presupuesto/PresupuestoDocumento";
import { PresupuestoStepper } from "@/components/presupuesto/PresupuestoStepper";
import { StepCliente } from "@/components/presupuesto/wizard/StepCliente";
import { StepOrdenes } from "@/components/presupuesto/wizard/StepOrdenes";
import { StepConfirmacion } from "@/components/presupuesto/wizard/StepConfirmacion";
import { PickArticulo } from "@/components/presupuesto/wizard/fields";
import {
  newEmptyLineaItem,
  newOrdenTrabajo,
  type LogisticaPresupuesto,
  type LineaItemOT,
  type OrdenTrabajoWizard,
} from "@/components/presupuesto/wizard/types";
import {
  parseMoneyInput,
  validarPresupuestoCompleto,
  validateCliente,
  validateMaterialesOt,
  validateOrdenesItems,
} from "@/components/presupuesto/wizard/validacion";
import type { MaterialWizardRow } from "@/types/material-catalog";

export type { LineaItemOT } from "./wizard/types";

function formatUsd(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMontoFooter(n: number, moneda: "ars" | "usd"): string {
  if (moneda === "usd") return `US$${formatUsd(n)}`;
  try {
    return `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
  } catch {
    return `$${Math.round(n)}`;
  }
}

export type PresupuestoWizardProps = {
  /** Si viene, abre el wizard hidratado para editar un pendiente existente. */
  presupuestoId?: string | null;
  /** Tras INSERT/UPDATE en Supabase: vuelta al listado y apertura de resumen desde el padre. */
  onPersisted?: (result: { id: string; numero: string }) => void | Promise<void>;
};

function generarNumeroPresupuesto(): string {
  const y = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `PR-${y}-${n}`;
}

function buildPresupuestoPayloadV1(opts: {
  dolarHoy: number;
  clienteSeleccionadoId: string | null;
  clienteNombre: string;
  contacto: string;
  origenVentas: string;
  tel: string;
  email: string;
  direccion: string;
  obsCabecera: string;
  listaPrecioId: string;
  monedaPresupuesto: "ars" | "usd";
  ordenes: OrdenTrabajoWizard[];
  descuentoGlobalPct: string;
  logistica: LogisticaPresupuesto;
  mMedicionGlobal: boolean;
  mEntregaGlobal: boolean;
  mColocacionGlobal: boolean;
  totalMecGlobal: string;
  obsServiciosMec: string;
  lineasResumen: LineaResumenMoneda[];
  cotizacionMixtaActiva: boolean;
  monedaFinal: string;
  totalUsdEquivalente: number;
  totalArsEquivalente: number;
  materialM2: number;
  materialTon: number | null;
  totalPresupuesto: number;
}): PresupuestoPayloadV1 {
  return {
    version: PRESUPUESTO_PAYLOAD_VERSION,
    dolarHoy: opts.dolarHoy,
    clienteId: opts.clienteSeleccionadoId,
    clienteNombre: opts.clienteNombre,
    contacto: opts.contacto,
    origenVentas: opts.origenVentas,
    tel: opts.tel,
    email: opts.email,
    direccion: opts.direccion,
    obsCabecera: opts.obsCabecera,
    listaPrecioId: opts.listaPrecioId,
    monedaPresupuesto: opts.monedaPresupuesto,
    ordenes: opts.ordenes,
    descuentoGlobalPct: opts.descuentoGlobalPct,
    logistica: opts.logistica,
    mMedicionGlobal: opts.mMedicionGlobal,
    mEntregaGlobal: opts.mEntregaGlobal,
    mColocacionGlobal: opts.mColocacionGlobal,
    totalMecGlobal: opts.totalMecGlobal,
    obsServiciosMec: opts.obsServiciosMec,
    lineasResumen: opts.lineasResumen.map((ln) => ({ ...ln })),
    cotizacionMixtaActiva: opts.cotizacionMixtaActiva,
    monedaFinal: opts.monedaFinal,
    totalUsdEquivalente: opts.totalUsdEquivalente,
    totalArsEquivalente: opts.totalArsEquivalente,
    materialM2Presupuesto: opts.materialM2,
    materialTonEstimadoPresupuesto: opts.materialTon,
    totalPresupuesto: opts.totalPresupuesto,
  };
}

export function PresupuestoWizard(props: PresupuestoWizardProps = {}) {
  const { onPersisted, presupuestoId = null } = props;
  const { user } = useAuth();
  const dolarHoy = 1250.5;
  const editando = Boolean(presupuestoId);
  /** En la 1ª carga de artículos en edición no pisamos precios guardados. */
  const omitirSyncPreciosRef = useRef(editando);
  const [editCargando, setEditCargando] = useState(editando);
  const [editNumero, setEditNumero] = useState<string | null>(null);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);

  /** Solo MEC único para todo el presupuesto (no hay modo por OT en UI). */
  const mecScope = "global" as const;
  const [mMedicionGlobal, setMMedicionGlobal] = useState(false);
  const [mEntregaGlobal, setMEntregaGlobal] = useState(false);
  const [mColocacionGlobal, setMColocacionGlobal] = useState(false);
  const [totalMecGlobal, setTotalMecGlobal] = useState("0");
  const [obsServiciosMec, setObsServiciosMec] = useState("");

  const [clientesLocales, setClientesLocales] = useState<ClientePresupuesto[]>(
    () => [],
  );
  const [clientesCargando, setClientesCargando] = useState(isSupabaseConfigured);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<
    string | null
  >(null);
  const [contacto, setContacto] = useState("");
  const [origenVentas, setOrigenVentas] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [obsCabecera, setObsCabecera] = useState("");
  const [listaPrecioId, setListaPrecioId] = useState<string>("");
  const [monedaPresupuesto, setMonedaPresupuesto] = useState<"ars" | "usd">(
    "usd",
  );

  // Hook de artículos dinámicos: se recarga cuando cambia la lista de precio
  const {
    listas: listasPrecios,
    articulos: articulosBd,
    cargando: articulosCargando,
  } = useArticulos(listaPrecioId);

  // Cuando llegan las listas reales desde BD, inicializar el ID con la primera
  useEffect(() => {
    if (editCargando) return;
    if (listasPrecios.length === 0) return;

    const listaActualSigueDisponible = listasPrecios.some(
      (lista) => lista.id === listaPrecioId,
    );

    if (!listaPrecioId || !listaActualSigueDisponible) {
      setListaPrecioId(listasPrecios[0]!.id);
    }
  }, [listaPrecioId, listasPrecios, editCargando]);

  const [materials, setMaterials] = useState<MaterialWizardRow[]>([]);
  const [materialesCargando, setMateriaesCargando] =
    useState(isSupabaseConfigured);
  const catalogoCargando = materialesCargando || articulosCargando;

  const [ordenes, setOrdenes] = useState<OrdenTrabajoWizard[]>(() => [
    newOrdenTrabajo(""),
  ]);
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState("");

  const [logistica, setLogistica] = useState<LogisticaPresupuesto>(() => ({
    fechaCoord: "",
    fechaEntrega: "",
    observacion: "",
  }));

  const [cotizacionMixtaActiva] = useState(false);
  const [monedaFinal] = useState("pesos");
  const [lineasResumen, setLineasResumen] = useState<LineaResumenMoneda[]>([
    {
      id: "piedra",
      label: "Piedra / chapa del material",
      monto: "0",
      moneda: "usd",
    },
    {
      id: "mo",
      label: "Mano de obra y pulido",
      monto: "0",
      moneda: "ars",
    },
    {
      id: "perf",
      label: "Perforaciones (trasforos)",
      monto: "0",
      moneda: "ars",
    },
    { id: "flete", label: "Fletes e insumos", monto: "0", moneda: "ars" },
  ]);
  const [resumenAbierto, setResumenAbierto] = useState(false);

  const [dialogClienteAbierto, setDialogClienteAbierto] = useState(false);
  const [prefillNombreCliente, setPrefillNombreCliente] = useState("");

  const [grabarError, setGrabarError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setClientesCargando(false);
      return;
    }
    let cancelled = false;
    async function loadClientes() {
      setClientesCargando(true);
      const { data, error } = await listClients();
      if (cancelled) return;
      if (error) {
        toast.error(`No se pudieron cargar los clientes: ${error.message}`);
        setClientesLocales([]);
      } else {
        setClientesLocales(data);
      }
      setClientesCargando(false);
    }
    void loadClientes();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setMateriaesCargando(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setMateriaesCargando(true);
      try {
        const { data: mats, error: matsErr } = await listMaterials();
        if (cancelled) return;
        if (matsErr) {
          setMaterials([]);
          toast.error(`No se pudo cargar el catálogo de materiales: ${matsErr.message}`);
        } else {
          setMaterials(mats);
          if (mats.length > 0) {
            setOrdenes((prev) =>
              prev.map((o) =>
                mats.some((m) => m.id === o.materialId)
                  ? o
                  : { ...o, materialId: mats[0]!.id },
              ),
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el catálogo inicial del presupuesto.",
          );
        }
      } finally {
        if (!cancelled) setMateriaesCargando(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (articulosBd.length === 0) return;
    if (omitirSyncPreciosRef.current) {
      omitirSyncPreciosRef.current = false;
      return;
    }

    setOrdenes((prev) => {
      let changed = false;

      const next = prev.map((orden) => ({
        ...orden,
        items: orden.items.map((linea) => {
          if (!linea.articuloId) return linea;

          const articulo = articulosBd.find((item) => item.id === linea.articuloId);
          if (!articulo) return linea;

          const precioUnitario = articulo.precio != null ? String(articulo.precio) : "";
          if (linea.precioUnitario === precioUnitario) return linea;

          changed = true;
          return { ...linea, precioUnitario };
        }),
      }));

      return changed ? next : prev;
    });
  }, [articulosBd]);

  useEffect(() => {
    if (!presupuestoId) {
      setEditCargando(false);
      setEditNumero(null);
      setEditLoadError(null);
      return;
    }
    if (!isSupabaseConfigured) {
      setEditCargando(false);
      setEditLoadError("Supabase no está configurado; no se puede editar.");
      return;
    }

    let cancelled = false;
    async function loadEdit() {
      setEditCargando(true);
      setEditLoadError(null);
      omitirSyncPreciosRef.current = true;
      const { data, error } = await getPresupuestoById(presupuestoId!);
      if (cancelled) return;
      if (error || !data) {
        setEditLoadError(error?.message ?? "No se pudo cargar el presupuesto.");
        setEditCargando(false);
        return;
      }
      if (data.status !== "pendiente") {
        setEditLoadError("Solo se pueden editar presupuestos pendientes.");
        setEditCargando(false);
        return;
      }
      const raw = data.payload;
      if (!raw || !isPresupuestoPayloadV1(raw)) {
        setEditLoadError("El detalle guardado no es compatible con el wizard.");
        setEditCargando(false);
        return;
      }
      const payload = hydratePresupuestoPayloadV1(raw);
      setEditNumero(data.numero);
      setClienteSeleccionadoId(payload.clienteId ?? data.client_id ?? null);
      setContacto(payload.contacto ?? "");
      setOrigenVentas(payload.origenVentas ?? "");
      setTel(payload.tel ?? "");
      setEmail(payload.email ?? "");
      setDireccion(payload.direccion ?? "");
      setObsCabecera(payload.obsCabecera ?? "");
      setListaPrecioId(payload.listaPrecioId ?? "");
      setMonedaPresupuesto(payload.monedaPresupuesto === "ars" ? "ars" : "usd");
      setOrdenes(
        payload.ordenes.length > 0 ? payload.ordenes : [newOrdenTrabajo("")],
      );
      setDescuentoGlobalPct(payload.descuentoGlobalPct ?? "");
      setLogistica({
        fechaCoord: payload.logistica?.fechaCoord ?? "",
        fechaEntrega: payload.logistica?.fechaEntrega ?? "",
        observacion: payload.logistica?.observacion ?? "",
      });
      setMMedicionGlobal(Boolean(payload.mMedicionGlobal));
      setMEntregaGlobal(Boolean(payload.mEntregaGlobal));
      setMColocacionGlobal(Boolean(payload.mColocacionGlobal));
      setTotalMecGlobal(payload.totalMecGlobal ?? "0");
      setObsServiciosMec(payload.obsServiciosMec ?? "");
      if (payload.lineasResumen?.length) {
        setLineasResumen(payload.lineasResumen.map((ln) => ({ ...ln })));
      }
      setEditCargando(false);
    }
    void loadEdit();
    return () => {
      cancelled = true;
    };
  }, [presupuestoId]);

  const clienteSeleccionado = useMemo(
    () =>
      clienteSeleccionadoId
        ? clientesLocales.find((c) => c.id === clienteSeleccionadoId)
        : undefined,
    [clienteSeleccionadoId, clientesLocales],
  );

  const aplicarCliente = useCallback((c: ClientePresupuesto) => {
    setClienteSeleccionadoId(c.id);
    setContacto(c.contacto);
    setTel(c.tel);
    setEmail(c.email);
    setDireccion(c.direccion);
  }, []);

  const limpiarCliente = useCallback(() => {
    setClienteSeleccionadoId(null);
  }, []);

  const abrirNuevoCliente = (prefillNombre = "") => {
    setPrefillNombreCliente(prefillNombre);
    setDialogClienteAbierto(true);
  };

  const onClienteGuardadoDesdeWizard = (data: ClientePresupuesto) => {
    setClientesLocales((rows) => {
      const sin = rows.filter((c) => c.id !== data.id);
      return [...sin, data].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
    aplicarCliente(data);
  };

  const patchOrden = (key: string, patch: Partial<OrdenTrabajoWizard>) => {
    setOrdenes((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  };

  const addOrdenTrabajo = () => {
    const mid = materials[0]?.id ?? "";
    setOrdenes((rows) => [...rows, newOrdenTrabajo(mid)]);
  };

  const removeOrdenTrabajo = (key: string) => {
    setOrdenes((rows) =>
      rows.length <= 1 ? rows : rows.filter((r) => r.key !== key),
    );
  };

  const addItem = (otKey: string) => {
    setOrdenes((rows) =>
      rows.map((r) =>
        r.key === otKey
          ? { ...r, items: [...r.items, newEmptyLineaItem()] }
          : r,
      ),
    );
  };

  const removeItem = (otKey: string, lineKey: string) => {
    setOrdenes((rows) =>
      rows.map((r) => {
        if (r.key !== otKey) return r;
        return { ...r, items: r.items.filter((l) => l.key !== lineKey) };
      }),
    );
  };

  const patchItem = (
    otKey: string,
    lineKey: string,
    patch: Partial<LineaItemOT>,
  ) => {
    setOrdenes((rows) =>
      rows.map((r) =>
        r.key !== otKey
          ? r
          : {
              ...r,
              items: r.items.map((l) =>
                l.key === lineKey ? { ...l, ...patch } : l,
              ),
            },
      ),
    );
  };

  const onArticuloChange = (
    otKey: string,
    lineKey: string,
    articuloId: string,
  ) => {
    if (!articuloId) {
      patchItem(otKey, lineKey, {
        articuloId: "",
        modoIngreso: "dimensiones",
        precioUnitario: "",
        cantidad: "1",
        altoM: "0",
        anchoM: "0",
        desperdicioPct: "0",
      });
      return;
    }
    const artBd = articulosBd.find((a) => a.id === articuloId);
    if (!artBd) return;
    const art = articuloConPrecioToMock(artBd);
    patchItem(otKey, lineKey, {
      articuloId,
      modoIngreso: art.preferModoManualM2 ? "manual" : "dimensiones",
      precioUnitario: artBd.precio != null ? String(artBd.precio) : "",
      cantidad: "1",
      altoM: "0",
      anchoM: "0",
      desperdicioPct: "0",
    });
  };

  const totalesItems = useMemo(() => {
    let subtotal = 0;
    let totalM2 = 0;
    let totalMl = 0;
    let totalTon = 0;
    let faltaPesoNonMarmol = false;
    const porOt: {
      key: string;
      titulo: string;
      subtotal: number;
      m2: number;
      ml: number;
      ton: number;
      cantLineas: number;
    }[] = [];
    for (const ot of ordenes) {
      const materialRow = materials.find((m) => m.id === ot.materialId);
      let sOt = 0;
      let m2Ot = 0;
      let mlOt = 0;
      let tonOt = 0;
      let nLineas = 0;
      for (const line of ot.items) {
        const artBd = articulosBd.find((a) => a.id === line.articuloId);
        const art = artBd ? articuloConPrecioToMock(artBd) : undefined;
        if (!art) continue;
        const calc = buildLineaCalcInput(art, line);
        const { m2Linea, mlLinea, subtotal: subL } = computeLineaPresupuesto(art, calc);
        subtotal += subL;
        totalM2 += m2Linea;
        totalMl += mlLinea;
        sOt += subL;
        m2Ot += m2Linea;
        mlOt += mlLinea;
        nLineas += 1;
        const peso = materialPesoEstimadoDesdeOt(m2Linea, {
          materialKind: materialRow?.material_kind ?? "marmol",
          pesoPorM2Kg: materialRow?.peso_por_m2_kg,
        });
        if (peso) {
          totalTon += peso.ton;
          tonOt += peso.ton;
        }
        if (
          art.calculaMaterial &&
          m2Linea > 0 &&
          materialRow &&
          materialRow.material_kind !== "marmol" &&
          (materialRow.peso_por_m2_kg == null || !(materialRow.peso_por_m2_kg > 0))
        ) {
          faltaPesoNonMarmol = true;
        }
      }
      porOt.push({
        key: ot.key,
        titulo: ot.titulo.trim() || "Sin título",
        subtotal: sOt,
        m2: m2Ot,
        ml: mlOt,
        ton: tonOt,
        cantLineas: nLineas,
      });
    }
    const dPct = Math.max(0, parseMoneyInput(descuentoGlobalPct));
    const factor = 1 - Math.min(dPct, 100) / 100;
    const totalConDesc = subtotal * factor;
    return {
      subtotal,
      totalM2,
      totalMl,
      totalTon,
      totalConDesc,
      porOt,
      descuentoPct: dPct,
      faltaPesoNonMarmol,
    };
  }, [ordenes, descuentoGlobalPct, materials, articulosBd]);

  useEffect(() => {
    const v = totalesItems.totalConDesc;
    const montoStr = typeof v === "number" && Number.isFinite(v) ? String(v) : "0";
    setLineasResumen((prev) =>
      prev.map((row) =>
        row.id === "piedra" ? { ...row, moneda: monedaPresupuesto, monto: montoStr } : row,
      ),
    );
  }, [totalesItems.totalConDesc, monedaPresupuesto]);

  const totalMecImporte = useMemo(() => {
    return importeMecPresupuesto({
      mMedicion: mMedicionGlobal,
      mEntrega: mEntregaGlobal,
      mColocacion: mColocacionGlobal,
      totalMec: totalMecGlobal,
      ordenes,
    });
  }, [mMedicionGlobal, mEntregaGlobal, mColocacionGlobal, totalMecGlobal, ordenes]);

  const totalPresupuesto = totalesItems.totalConDesc + totalMecImporte;

  const { totalUsdEquivalente, totalArsEquivalente } = useMemo(() => {
    const items = totalesItems.totalConDesc;
    let sumUsd = 0;
    let sumArs = 0;
    if (monedaPresupuesto === "usd") {
      sumUsd += items;
    } else {
      sumArs += items;
    }
    for (const ln of lineasResumen) {
      if (ln.id === "piedra") continue;
      const v = parseMoneyInput(ln.monto);
      if (ln.moneda === "usd") sumUsd += v;
      else sumArs += v;
    }
    return {
      totalUsdEquivalente: sumUsd + sumArs / dolarHoy,
      totalArsEquivalente: sumArs + sumUsd * dolarHoy,
    };
  }, [lineasResumen, dolarHoy, totalesItems.totalConDesc, monedaPresupuesto]);

  const validarAntesGrabar = useCallback((): string | null => {
    return validarPresupuestoCompleto(
      clienteSeleccionadoId,
      origenVentas,
      mecScope,
      {
        mMedicionGlobal,
        mEntregaGlobal,
        mColocacionGlobal,
        totalMecGlobal,
        ordenes,
      },
      articulosBd,
    );
  }, [
    clienteSeleccionadoId,
    origenVentas,
    mecScope,
    mMedicionGlobal,
    mEntregaGlobal,
    mColocacionGlobal,
    totalMecGlobal,
    ordenes,
    articulosBd,
  ]);

  const handleGrabar = async () => {
    const err = validarAntesGrabar();
    if (err) {
      setGrabarError(err);
      return;
    }
    if (!isSupabaseConfigured) {
      setGrabarError("Supabase no está configurado; no se puede guardar.");
      return;
    }
    const payload = buildPresupuestoPayloadV1({
      dolarHoy,
      clienteSeleccionadoId,
      clienteNombre: clienteSeleccionado?.nombre ?? "",
      contacto,
      origenVentas,
      tel,
      email,
      direccion,
      obsCabecera,
      listaPrecioId,
      monedaPresupuesto,
      ordenes,
      descuentoGlobalPct,
      logistica,
      mMedicionGlobal,
      mEntregaGlobal,
      mColocacionGlobal,
      totalMecGlobal,
      obsServiciosMec,
      lineasResumen,
      cotizacionMixtaActiva,
      monedaFinal,
      totalUsdEquivalente,
      totalArsEquivalente,
      materialM2: totalesItems.totalM2,
      materialTon:
        totalesItems.totalTon > 0 ? totalesItems.totalTon : null,
      totalPresupuesto,
    });
    const nombreCliente = clienteSeleccionado?.nombre?.trim() || "Sin cliente";
    setGuardando(true);

    if (presupuestoId) {
      const { data, error } = await updatePresupuestoRow(presupuestoId, {
        cliente: nombreCliente,
        client_id: clienteSeleccionadoId,
        total: totalPresupuesto,
        moneda: monedaPresupuesto,
        payload,
      });
      setGuardando(false);
      if (error) {
        const msg = error.message;
        toast.error(msg);
        setGrabarError(msg);
        return;
      }
      if (!data) {
        const msg = "Solo se pueden editar presupuestos pendientes.";
        toast.error(msg);
        setGrabarError(msg);
        return;
      }
      toast.success(`Presupuesto ${data.numero} actualizado.`);
      if (onPersisted) await Promise.resolve(onPersisted({ id: data.id, numero: data.numero }));
      return;
    }

    let lastMsg: string | null = null;
    for (let i = 0; i < 15; i++) {
      const numero = generarNumeroPresupuesto();
      let { data, error } = await insertPresupuestoRow({
        numero,
        cliente: nombreCliente,
        client_id: clienteSeleccionadoId,
        total: totalPresupuesto,
        moneda: monedaPresupuesto,
        status: "pendiente",
        payload,
        created_by: user?.id ?? null,
      });
      if (error?.code === "23503") {
        ({ data, error } = await insertPresupuestoRow({
          numero,
          cliente: nombreCliente,
          client_id: clienteSeleccionadoId,
          total: totalPresupuesto,
          moneda: monedaPresupuesto,
          status: "pendiente",
          payload,
          created_by: null,
        }));
      }
      if (!error && data) {
        toast.success(`Presupuesto ${data.numero} guardado como pendiente.`);
        setGuardando(false);
        if (onPersisted) await Promise.resolve(onPersisted({ id: data.id, numero: data.numero }));
        return;
      }
      lastMsg = error?.message ?? "Error desconocido.";
      const code = error && "code" in error ? String((error as { code?: string }).code) : "";
      const dup = code === "23505";
      if (!dup) {
        toast.error(lastMsg);
        setGuardando(false);
        setGrabarError(lastMsg);
        return;
      }
    }
    setGuardando(false);
    setGrabarError(
      lastMsg ?? "No se pudo obtener un número de presupuesto único.",
    );
    toast.error("No se pudo guardar después de varios intentos.");
  };

  const handleImprimir = () => {
    setResumenAbierto(true);
  };

  const [wizardStep, setWizardStep] = useState(0);
  const wizardLastIndex = 2;

  const origenLabelDisplay = useMemo(
    () =>
      ORIGEN_VENTA_OPCIONES.find((o) => o.value === origenVentas)?.label ??
      (origenVentas.trim() ? origenVentas : "—"),
    [origenVentas],
  );

  const totalLineasOt = useMemo(
    () => totalesItems.porOt.reduce((acc, p) => acc + p.cantLineas, 0),
    [totalesItems.porOt],
  );

  const listaPrecioLabel = useMemo(
    () => listasPrecios.find((lista) => lista.id === listaPrecioId)?.label ?? "—",
    [listaPrecioId, listasPrecios],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [wizardStep]);

  const handleWizardSiguiente = () => {
    const errCliente =
      wizardStep === 0
        ? validateCliente(clienteSeleccionadoId)
        : null;
    if (errCliente) {
      setGrabarError(errCliente);
      return;
    }
    if (wizardStep === 1) {
      const errMat = validateMaterialesOt(ordenes);
      if (errMat) {
        setGrabarError(errMat);
        return;
      }
      const errItems = validateOrdenesItems(ordenes, articulosBd);
      if (errItems) {
        setGrabarError(errItems);
        return;
      }
    }
    if (wizardStep < wizardLastIndex) setWizardStep((s) => s + 1);
  };

  const handleWizardAnterior = () => setWizardStep((s) => Math.max(0, s - 1));

  const renderLineaCells = (
    ot: OrdenTrabajoWizard,
    line: LineaItemOT,
    index: number,
  ) => {
    const artBd = line.articuloId ? articulosBd.find((a) => a.id === line.articuloId) : undefined;
    const art = artBd ? articuloConPrecioToMock(artBd) : undefined;
    const hasArt = Boolean(art);

    let m2Linea = 0;
    let subL = 0;
    if (art) {
      const calc = buildLineaCalcInput(art, line);
      const r = computeLineaPresupuesto(art, calc);
      m2Linea = r.m2Linea;
      subL = r.subtotal;
    }

    const manualM2 = Boolean(
      hasArt && art && art.unidad === "M2" && line.modoIngreso === "manual",
    );
    const dim = hasArt && art ? dimensionesHabilitadas(art) : false;
    const isM2Dimensiones = Boolean(
      hasArt && art && art.unidad === "M2" && dim && !manualM2,
    );
    const showLargoField = isM2Dimensiones;
    const showAnchoM = isM2Dimensiones;
    const showDesperdicio = Boolean(
      hasArt &&
        art &&
        !manualM2 &&
        ((art.unidad === "M2" && dim) || art.unidad === "ML"),
    );
    /** En m² por dimensiones: m² calculado; si no: input de cantidad. */
    const showM2Calculado = isM2Dimensiones;
    const showCantidadEnM2Cant = Boolean(hasArt && !isM2Dimensiones);
    /** En m² por dimensiones: piezas; si no: label de unidad. */
    const showUnidPiezas = isM2Dimensiones;

    const inputClass = cn(
      "h-8 text-xs tabular-nums px-2",
      "border-border bg-background shadow-sm",
      "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
    );
    const inputDisabledClass = cn(
      inputClass,
      "disabled:cursor-not-allowed disabled:bg-muted/40 disabled:border-border/60 disabled:text-muted-foreground/70 disabled:shadow-none",
    );

    return (
      <TableRow
        key={line.key}
        className="border-b border-border/70 odd:bg-background even:bg-muted/25 hover:bg-muted/40"
      >
        <TableCell className="px-2.5 py-2 align-middle text-xs tabular-nums text-muted-foreground whitespace-nowrap first:pl-3">
          {index + 1}
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[9rem]">
          <PickArticulo
            compact
            value={line.articuloId}
            onChange={(id) => onArticuloChange(ot.key, line.key, id)}
            articulos={articulosBd}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[4rem]">
          <Input
            className={inputDisabledClass}
            inputMode="decimal"
            placeholder="m"
            title="Largo en metros (m² por dimensiones)"
            value={line.altoM}
            onChange={(e) =>
              patchItem(ot.key, line.key, { altoM: e.target.value })
            }
            disabled={!showLargoField}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[4rem]">
          <Input
            className={inputDisabledClass}
            inputMode="decimal"
            placeholder="m"
            title="Ancho en metros"
            value={line.anchoM}
            onChange={(e) =>
              patchItem(ot.key, line.key, { anchoM: e.target.value })
            }
            disabled={!showAnchoM}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[5.5rem]">
          {showM2Calculado ? (
            <span className="block text-xs font-medium tabular-nums text-muted-foreground">
              {formatMetraje(m2Linea)}
            </span>
          ) : showCantidadEnM2Cant ? (
            <Input
              className={inputClass}
              inputMode="decimal"
              title={
                manualM2
                  ? "Superficie total de material en m² (precio unitario $/m²)"
                  : "Cantidad según unidad del artículo"
              }
              value={line.cantidad}
              onChange={(e) =>
                patchItem(ot.key, line.key, { cantidad: e.target.value })
              }
            />
          ) : (
            <span className="block text-xs font-medium tabular-nums text-muted-foreground">
              {formatMetraje(0)}
            </span>
          )}
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[3.5rem]">
          {showUnidPiezas || !hasArt ? (
            <Input
              className={inputClass}
              inputMode="decimal"
              title="Cantidad de piezas"
              value={line.cantidad}
              onChange={(e) =>
                patchItem(ot.key, line.key, { cantidad: e.target.value })
              }
            />
          ) : art ? (
            <span className="text-xs font-semibold whitespace-nowrap">
              {labelUnidad(art.unidad)}
            </span>
          ) : (
            <span className="text-muted-foreground/30 select-none">–</span>
          )}
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle w-[3.25rem]">
          <Input
            className={inputDisabledClass}
            inputMode="decimal"
            placeholder="%"
            title="Desperdicio: % extra sobre el área (cortes, roturas). Vacío = 0%."
            value={line.desperdicioPct}
            onChange={(e) =>
              patchItem(ot.key, line.key, { desperdicioPct: e.target.value })
            }
            disabled={!showDesperdicio}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle w-[4.75rem]">
          <Input
            className={cn(
              inputClass,
              !line.precioUnitario.trim() && "placeholder:text-muted-foreground/40",
            )}
            inputMode="decimal"
            placeholder="—"
            value={line.precioUnitario}
            onChange={(e) =>
              patchItem(ot.key, line.key, { precioUnitario: e.target.value })
            }
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle text-right">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums leading-none",
              !hasArt && "text-muted-foreground/35",
            )}
          >
            {hasArt
              ? `$${subL.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "$0.00"}
          </span>
        </TableCell>
        <TableCell className="w-12 px-1.5 py-2 align-middle text-center last:pr-3">
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Quitar ítem"
              onClick={() => removeItem(ot.key, line.key)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (editCargando) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-16 text-center text-sm text-muted-foreground sm:px-4">
        Cargando presupuesto para editar…
      </div>
    );
  }

  if (editLoadError) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-3 py-16 text-center sm:px-4">
        <p className="text-sm text-destructive">{editLoadError}</p>
        <p className="text-xs text-muted-foreground">
          Volvé al listado e intentá con un presupuesto pendiente.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none pb-44">
      <div className="mx-auto max-w-6xl space-y-6 px-3 sm:px-4 lg:px-0 pb-8">
        {editando && editNumero ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
            Editando <span className="font-semibold tabular-nums">{editNumero}</span>
            {" — "}se conserva el mismo número al guardar.
          </div>
        ) : null}
        <PresupuestoStepper step={wizardStep} />

        <div className="min-h-[260px]">
          {wizardStep === 0 ? (
            <StepCliente
              clientesLocales={clientesLocales}
              clientesCargando={clientesCargando}
              clienteSeleccionadoId={clienteSeleccionadoId}
              aplicarCliente={aplicarCliente}
              limpiarCliente={limpiarCliente}
              abrirNuevoCliente={abrirNuevoCliente}
              listasPrecios={listasPrecios}
              listaPrecioId={listaPrecioId}
              setListaPrecioId={setListaPrecioId}
              monedaPresupuesto={monedaPresupuesto}
              setMonedaPresupuesto={setMonedaPresupuesto}
              origenVentas={origenVentas}
              setOrigenVentas={setOrigenVentas}
              contacto={contacto}
              setContacto={setContacto}
              tel={tel}
              setTel={setTel}
              email={email}
              setEmail={setEmail}
              direccion={direccion}
              setDireccion={setDireccion}
              obsCabecera={obsCabecera}
              setObsCabecera={setObsCabecera}
            />
          ) : null}

          {wizardStep === 1 ? (
            <StepOrdenes
              catalogoCargando={catalogoCargando}
              ordenes={ordenes}
              materials={materials}
              materialesCargando={materialesCargando}
              totalesItems={totalesItems}
              patchOrden={patchOrden}
              addOrdenTrabajo={addOrdenTrabajo}
              removeOrdenTrabajo={removeOrdenTrabajo}
              addItem={addItem}
              renderLineaCells={renderLineaCells}
            />
          ) : null}

          {wizardStep === 2 ? (
            <StepConfirmacion
              clienteNombre={clienteSeleccionado?.nombre ?? "—"}
              listaPrecioLabel={listaPrecioLabel}
              origenLabel={origenLabelDisplay}
              monedaPresupuesto={monedaPresupuesto}
              ordenesCount={ordenes.length}
              lineItemsCount={totalLineasOt}
              faltaPesoNonMarmol={totalesItems.faltaPesoNonMarmol}
              totalesPorOt={totalesItems.porOt}
              mMedicionGlobal={mMedicionGlobal}
              setMMedicionGlobal={setMMedicionGlobal}
              mEntregaGlobal={mEntregaGlobal}
              setMEntregaGlobal={setMEntregaGlobal}
              mColocacionGlobal={mColocacionGlobal}
              setMColocacionGlobal={setMColocacionGlobal}
              totalMecGlobal={totalMecGlobal}
              setTotalMecGlobal={setTotalMecGlobal}
              obsServiciosMec={obsServiciosMec}
              setObsServiciosMec={setObsServiciosMec}
              totalesItemsSubtotal={totalesItems.subtotal}
              descuentoGlobalPct={descuentoGlobalPct}
              setDescuentoGlobalPct={setDescuentoGlobalPct}
              totalesItemsTotalConDesc={totalesItems.totalConDesc}
              totalMecImporte={totalMecImporte}
              totalPresupuesto={totalPresupuesto}
              totalesTotalM2={totalesItems.totalM2}
              totalesTotalMl={totalesItems.totalMl}
              totalesTotalTon={totalesItems.totalTon}
              mecExcluidoTodasOts={todasOtsExcluyenMec(ordenes)}
            />
          ) : null}
        </div>
      </div>


      <ClienteFormDialog
        open={dialogClienteAbierto}
        onOpenChange={setDialogClienteAbierto}
        prefillNombre={prefillNombreCliente}
        onSaved={onClienteGuardadoDesdeWizard}
      />

      <Dialog
        open={!!grabarError}
        onOpenChange={(o) => !o && setGrabarError(null)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>No se puede guardar</DialogTitle>
            <DialogDescription>{grabarError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setGrabarError(null)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resumenAbierto} onOpenChange={setResumenAbierto}>
        <DialogContent
          className="gap-0 p-0 sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
          showCloseButton
        >
          <DialogHeader className="border-b bg-muted/30 px-5 py-4 shrink-0 print:hidden">
            <DialogTitle className="text-lg font-bold">
              Resumen del presupuesto
            </DialogTitle>
            <DialogDescription>
              Vista para imprimir · {listaPrecioLabel}
              {monedaPresupuesto === "usd"
                ? ` · Dólar hoy ${formatUsd(dolarHoy)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-4 py-4 sm:px-6 bg-neutral-100/80 print:bg-white print:p-0">
            <PresupuestoDocumento
              clienteNombre={clienteSeleccionado?.nombre ?? ""}
              contacto={contacto}
              tel={tel}
              email={email}
              direccion={direccion}
              observacion={obsCabecera}
              origenLabel={origenLabelDisplay}
              listaPrecioLabel={listaPrecioLabel}
              moneda={monedaPresupuesto}
              ordenes={ordenes}
              articulos={articulosBd}
              materials={materials}
              descuentoPct={totalesItems.descuentoPct}
              mMedicion={mMedicionGlobal}
              mEntrega={mEntregaGlobal}
              mColocacion={mColocacionGlobal}
              totalMec={totalMecImporte}
              obsMec={obsServiciosMec}
              className="mx-auto max-w-3xl shadow-sm border border-neutral-200 print:shadow-none print:border-0"
            />
          </div>
          <DialogFooter className="border-t px-6 py-4 gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 sm:left-60",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="text-xs sm:text-sm min-w-0 flex-1 tabular-nums flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground">
            {totalMecImporte > 0 ? (
              <>
                <span>
                  MEC{" "}
                  <strong className="text-foreground">
                    {formatMontoFooter(totalMecImporte, monedaPresupuesto)}
                  </strong>
                </span>
                <span className="text-border">|</span>
              </>
            ) : null}
            <span>
              m²{" "}
              <strong className="text-foreground">
                {formatMetraje(totalesItems.totalM2)}
              </strong>
            </span>
            <span className="text-border">|</span>
            <span>
              ml{" "}
              <strong className="text-foreground">
                {formatMetraje(totalesItems.totalMl)}
              </strong>
            </span>
            {totalesItems.totalTon > 0 ? (
              <>
                <span className="text-border">|</span>
                <span>
                  ton{" "}
                  <strong className="text-foreground">
                    {formatToneladas(totalesItems.totalTon)}
                  </strong>
                </span>
              </>
            ) : null}
            <span className="text-border">|</span>
            <span>
              Total{" "}
              <strong className="text-foreground">
                {formatMontoFooter(totalPresupuesto, monedaPresupuesto)}
              </strong>
            </span>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
            {wizardStep > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={handleWizardAnterior}
              >
                <ChevronLeft className="h-4 w-4" />
                Atrás
              </Button>
            ) : null}
            {wizardStep < 2 ? (
              <Button
                type="button"
                size="sm"
                className="gap-1"
                onClick={handleWizardSiguiente}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={handleImprimir}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  className="gap-1"
                  disabled={guardando}
                  onClick={() => void handleGrabar()}
                >
                  <Save className="h-4 w-4" />
                  {editando ? "Guardar cambios" : "Guardar"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
