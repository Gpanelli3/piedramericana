"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  Minus,
  Save,
  Printer,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { LISTAS_PRECIO_MOCK, getArticuloById } from "@/data/presupuesto-articulos-mock";
import {
  CLIENTES_PRESUPUESTO_MOCK,
  ORIGEN_VENTA_OPCIONES,
  type ClientePresupuestoMock,
} from "@/data/presupuesto-clientes-mock";
import {
  buildLineaCalcInput,
  computeLineaPresupuesto,
  dimensionesHabilitadas,
  labelUnidad,
  materialPesoEstimadoDesdeOt,
  permiteModoManualCantidadM2,
  type ModoIngresoM2,
} from "@/lib/presupuesto-calculos";
import {
  PresupuestoResumenInterior,
  type LineaResumenMoneda,
} from "@/components/presupuesto/PresupuestoResumenInterior";
import { PresupuestoStepper } from "@/components/presupuesto/PresupuestoStepper";
import { StepCliente } from "@/components/presupuesto/wizard/StepCliente";
import { StepLogistica } from "@/components/presupuesto/wizard/StepLogistica";
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
  validateClienteYOrigen,
  validateMecRequisitos,
  mecAlgunoActivo,
} from "@/components/presupuesto/wizard/validacion";
import type { MaterialWizardRow } from "@/types/material-catalog";

export type { LineaItemOT } from "./wizard/types";

const MATERIALES_MOCK_FALLBACK: MaterialWizardRow[] = [
  {
    id: "__mock-silestone",
    name: "Silestone Blanco Norte",
    unit: "m2",
    material_kind: "marmol",
    peso_por_m2_kg: null,
    bulk_stock_kg: 0,
  },
  {
    id: "__mock-granito",
    name: "Granito Negro Brasil Extra 20mm",
    unit: "m2",
    material_kind: "otra_piedra",
    peso_por_m2_kg: 55,
    bulk_stock_kg: 0,
  },
  {
    id: "__mock-cuarcita",
    name: "Cuarcita Black Taurus",
    unit: "m2",
    material_kind: "otra_piedra",
    peso_por_m2_kg: 62,
    bulk_stock_kg: 0,
  },
  {
    id: "__mock-dekton",
    name: "Dekton DK Industrial Nilium Mate 8mm",
    unit: "m2",
    material_kind: "agglomerado_otro",
    peso_por_m2_kg: 28,
    bulk_stock_kg: 0,
  },
];

function formatUsd(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function abbrRubroFooter(id: string): string {
  switch (id) {
    case "piedra":
      return "Piedra";
    case "mo":
      return "M.O.";
    case "perf":
      return "Perf.";
    case "flete":
      return "Flete";
    default:
      return id;
  }
}

function nuevoNumeroPresupuestoMock(): string {
  const y = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `PR-${y}-${n} · v1`;
}

export function PresupuestoWizard() {
  const dolarHoy = 1250.5;

  /** Solo MEC único para todo el presupuesto (no hay modo por OT en UI). */
  const mecScope = "global" as const;
  const [mMedicionGlobal, setMMedicionGlobal] = useState(true);
  const [mEntregaGlobal, setMEntregaGlobal] = useState(true);
  const [mColocacionGlobal, setMColocacionGlobal] = useState(true);
  const [totalMecGlobal, setTotalMecGlobal] = useState("1");
  const [obsServiciosMec, setObsServiciosMec] = useState("");

  const [clientesLocales, setClientesLocales] = useState<
    ClientePresupuestoMock[]
  >(() => [...CLIENTES_PRESUPUESTO_MOCK]);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<
    string | null
  >(null);
  const [contacto, setContacto] = useState("");
  const [origenVentas, setOrigenVentas] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [obsCabecera, setObsCabecera] = useState("");
  const [listaPrecioId, setListaPrecioId] = useState<string>(
    LISTAS_PRECIO_MOCK[0]!.id,
  );
  const [monedaPresupuesto, setMonedaPresupuesto] = useState<"ars" | "usd">(
    "usd",
  );

  const defaultMat = MATERIALES_MOCK_FALLBACK[0]!.id;
  const [materials, setMaterials] = useState<MaterialWizardRow[]>(MATERIALES_MOCK_FALLBACK);
  const [tecnicos, setTecnicos] = useState<
    { id: string; full_name: string | null }[]
  >([]);
  const [catalogoCargando, setCatalogoCargando] =
    useState(isSupabaseConfigured);

  const [ordenes, setOrdenes] = useState<OrdenTrabajoWizard[]>(() => [
    newOrdenTrabajo(defaultMat),
  ]);
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState("");

  const [logistica, setLogistica] = useState<LogisticaPresupuesto>(() => ({
    fechaCoord: "",
    fechaEntrega: "",
    observacion: "Entregar de 12:00 a 15:00 hs",
  }));

  const [cotizacionMixtaActiva, setCotizacionMixtaActiva] = useState(true);
  const [monedaFinal, setMonedaFinal] = useState("pesos");
  const [lineasResumen, setLineasResumen] = useState<LineaResumenMoneda[]>([
    {
      id: "piedra",
      label: "Piedra / chapa del material",
      monto: "850",
      moneda: "usd",
    },
    {
      id: "mo",
      label: "Mano de obra y pulido",
      monto: "400000",
      moneda: "ars",
    },
    {
      id: "perf",
      label: "Perforaciones (trasforos)",
      monto: "118750",
      moneda: "ars",
    },
    { id: "flete", label: "Fletes e insumos", monto: "93750", moneda: "ars" },
  ]);
  const [resumenAbierto, setResumenAbierto] = useState(false);

  const [dialogClienteAbierto, setDialogClienteAbierto] = useState(false);
  const [draftCliente, setDraftCliente] = useState({
    nombre: "",
    contacto: "",
    tel: "",
    email: "",
    direccion: "",
  });

  const [grabarError, setGrabarError] = useState<string | null>(null);
  const [grabarExito, setGrabarExito] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCatalogoCargando(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setCatalogoCargando(true);
      const { data: mats, error: matsErr } = await supabase
        .from("materials")
        .select("id,name,unit,material_kind,peso_por_m2_kg,bulk_stock_kg")
        .order("name");
      if (!cancelled && !matsErr && mats?.length) {
        setMaterials(mats as MaterialWizardRow[]);
        setOrdenes((prev) =>
          prev.map((o) =>
            mats.some((m) => m.id === o.materialId)
              ? o
              : { ...o, materialId: mats[0]!.id },
          ),
        );
      } else if (!cancelled) {
        const { data: basic, error: basicErr } = await supabase
          .from("materials")
          .select("id,name,unit")
          .order("name");
        if (!cancelled && !basicErr && basic?.length) {
          const norm: MaterialWizardRow[] = basic.map((r) => ({
            id: r.id,
            name: r.name,
            unit: r.unit,
            material_kind: "marmol",
            peso_por_m2_kg: null,
            bulk_stock_kg: 0,
          }));
          setMaterials(norm);
          setOrdenes((prev) =>
            prev.map((o) =>
              norm.some((m) => m.id === o.materialId) ? o : { ...o, materialId: norm[0]!.id },
            ),
          );
        } else if (!cancelled) {
          setMaterials(MATERIALES_MOCK_FALLBACK);
        }
      }
      const { data: users, error: usersErr } = await supabase
        .from("usuarios")
        .select("id, full_name")
        .order("full_name");
      if (!cancelled && !usersErr && users?.length) setTecnicos(users);
      if (!cancelled) setCatalogoCargando(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const clienteSeleccionado = useMemo(
    () =>
      clienteSeleccionadoId
        ? clientesLocales.find((c) => c.id === clienteSeleccionadoId)
        : undefined,
    [clienteSeleccionadoId, clientesLocales],
  );

  const aplicarCliente = useCallback((c: ClientePresupuestoMock) => {
    setClienteSeleccionadoId(c.id);
    setContacto(c.contacto);
    setTel(c.tel);
    setEmail(c.email);
    setDireccion(c.direccion);
  }, []);

  const abrirNuevoCliente = (prefillNombre = "") => {
    setDraftCliente({
      nombre: prefillNombre,
      contacto: "",
      tel: "",
      email: "",
      direccion: "",
    });
    setDialogClienteAbierto(true);
  };

  const guardarDraftCliente = () => {
    const t = draftCliente.nombre.trim();
    if (!t) return;
    const nuevo: ClientePresupuestoMock = {
      id: crypto.randomUUID(),
      nombre: t,
      contacto: draftCliente.contacto.trim(),
      tel: draftCliente.tel.trim(),
      email: draftCliente.email.trim(),
      direccion: draftCliente.direccion.trim(),
    };
    setClientesLocales((rows) => [...rows, nuevo]);
    aplicarCliente(nuevo);
    setDialogClienteAbierto(false);
  };

  const patchOrden = (key: string, patch: Partial<OrdenTrabajoWizard>) => {
    setOrdenes((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  };

  const addOrdenTrabajo = () => {
    const mid = materials[0]?.id ?? defaultMat;
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
        cantidad: "",
        altoCm: "",
        anchoCm: "",
        desperdicioPct: "",
      });
      return;
    }
    const art = getArticuloById(articuloId);
    if (!art) return;
    patchItem(otKey, lineKey, {
      articuloId,
      modoIngreso: art.preferModoManualM2 ? "manual" : "dimensiones",
      precioUnitario: String(art.precioUnitario),
      cantidad: "",
      altoCm: "",
      anchoCm: "",
      desperdicioPct: "",
    });
  };

  const setLineaResumen = (id: string, patch: Partial<LineaResumenMoneda>) => {
    setLineasResumen((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const totalesItems = useMemo(() => {
    let subtotal = 0;
    let totalM2 = 0;
    let totalTon = 0;
    let faltaPesoNonMarmol = false;
    const porOt: {
      key: string;
      titulo: string;
      subtotal: number;
      m2: number;
      ton: number;
      cantLineas: number;
    }[] = [];
    for (const ot of ordenes) {
      const materialRow = materials.find((m) => m.id === ot.materialId);
      let sOt = 0;
      let m2Ot = 0;
      let tonOt = 0;
      let nLineas = 0;
      for (const line of ot.items) {
        const art = getArticuloById(line.articuloId);
        if (!art) continue;
        const calc = buildLineaCalcInput(art, line);
        const { m2Linea, subtotal: subL } = computeLineaPresupuesto(art, calc);
        subtotal += subL;
        totalM2 += m2Linea;
        sOt += subL;
        m2Ot += m2Linea;
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
      totalTon,
      totalConDesc,
      porOt,
      descuentoPct: dPct,
      faltaPesoNonMarmol,
    };
  }, [ordenes, descuentoGlobalPct, materials]);

  const totalMecImporte = useMemo(() => {
    return mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal)
      ? parseMoneyInput(totalMecGlobal)
      : 0;
  }, [mMedicionGlobal, mEntregaGlobal, mColocacionGlobal, totalMecGlobal]);

  const totalPresupuesto = totalesItems.totalConDesc + totalMecImporte;

  const { totalUsdEquivalente, totalArsEquivalente } = useMemo(() => {
    let sumUsd = 0;
    let sumArs = 0;
    for (const ln of lineasResumen) {
      const v = parseMoneyInput(ln.monto);
      if (ln.moneda === "usd") sumUsd += v;
      else sumArs += v;
    }
    return {
      totalUsdEquivalente: sumUsd + sumArs / dolarHoy,
      totalArsEquivalente: sumArs + sumUsd * dolarHoy,
    };
  }, [lineasResumen, dolarHoy]);

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
  ]);

  const handleGrabar = () => {
    const err = validarAntesGrabar();
    if (err) {
      setGrabarError(err);
      return;
    }
    setGrabarExito(nuevoNumeroPresupuestoMock());
  };

  const handleImprimir = () => {
    setResumenAbierto(true);
  };

  const [wizardStep, setWizardStep] = useState(0);
  const wizardLastIndex = 3;

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

  const formatArsEntero = useCallback((n: number) => {
    try {
      return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
        Math.round(n),
      );
    } catch {
      return String(Math.round(n));
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [wizardStep]);

  const handleWizardSiguiente = () => {
    const errCliente =
      wizardStep === 0
        ? validateClienteYOrigen(clienteSeleccionadoId, origenVentas)
        : null;
    if (errCliente) {
      setGrabarError(errCliente);
      return;
    }
    const errMec =
      wizardStep === 1
        ? validateMecRequisitos("global", {
            mMedicionGlobal,
            mEntregaGlobal,
            mColocacionGlobal,
            totalMecGlobal,
            ordenes,
          })
        : null;
    if (errMec) {
      setGrabarError(errMec);
      return;
    }
    if (wizardStep < wizardLastIndex) setWizardStep((s) => s + 1);
  };

  const handleWizardAnterior = () => setWizardStep((s) => Math.max(0, s - 1));

  const renderLineaCells = (ot: OrdenTrabajoWizard, line: LineaItemOT) => {
    const art = line.articuloId ? getArticuloById(line.articuloId) : undefined;
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
    const showAltoField = Boolean(
      hasArt &&
        art &&
        dim &&
        !manualM2 &&
        (art.unidad === "ML" || art.unidad === "M2"),
    );
    const showAnchoCm = Boolean(
      hasArt && art && dim && art.unidad === "M2" && !manualM2,
    );
    const showDesperdicio = Boolean(
      hasArt &&
        art &&
        dim &&
        !manualM2 &&
        (art.unidad === "M2" || art.unidad === "ML"),
    );
    const showM2Col = Boolean(hasArt && art && art.calculaMaterial);
    const puedeToggleManual = Boolean(
      hasArt && art && permiteModoManualCantidadM2(art),
    );
    const altoEsMetros = Boolean(hasArt && art?.unidad === "ML");

    return (
      <TableRow
        key={line.key}
        className="border-b border-border/70 odd:bg-background even:bg-muted/25 hover:bg-muted/40"
      >
        <TableCell className="px-2.5 py-2 align-middle text-xs font-mono text-muted-foreground whitespace-nowrap first:pl-3">
          {hasArt && art ? (
            art.codigo
          ) : (
            <span className="text-muted-foreground/30 select-none">–</span>
          )}
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[9rem]">
          <PickArticulo
            compact
            value={line.articuloId}
            onChange={(id) => onArticuloChange(ot.key, line.key, id)}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle text-xs font-medium whitespace-nowrap">
          {hasArt && art ? (
            labelUnidad(art.unidad)
          ) : (
            <span className="text-muted-foreground/30 select-none">–</span>
          )}
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[5.5rem]">
          <div className="flex flex-col gap-1">
            <Input
              className={cn(
                "h-8 text-xs tabular-nums px-2",
                "border-border bg-background shadow-sm",
                "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
              )}
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
            {puedeToggleManual ? (
              <button
                type="button"
                className="max-w-[7rem] text-left text-[10px] leading-tight text-primary font-medium underline-offset-2 hover:underline"
                onClick={() => {
                  const next: ModoIngresoM2 =
                    line.modoIngreso === "manual"
                      ? "dimensiones"
                      : "manual";
                  patchItem(ot.key, line.key, {
                    modoIngreso: next,
                    ...(next === "manual"
                      ? { altoCm: "", anchoCm: "", desperdicioPct: "" }
                      : {}),
                  });
                }}
              >
                {line.modoIngreso === "manual"
                  ? "Por alto × ancho"
                  : "Por m² totales"}
              </button>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle w-[4.75rem]">
          <Input
            className={cn(
              "h-8 text-xs tabular-nums px-2",
              "border-border bg-background shadow-sm",
              "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
            )}
            inputMode="decimal"
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
              ? subL.toLocaleString("es-AR", { maximumFractionDigits: 2 })
              : "–"}
          </span>
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[4rem]">
          <Input
            className={cn(
              "h-8 text-xs tabular-nums px-2",
              "border-border bg-background shadow-sm",
              "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
              "disabled:cursor-not-allowed disabled:bg-muted/40 disabled:border-border/60 disabled:text-muted-foreground/70 disabled:shadow-none",
            )}
            inputMode="decimal"
            placeholder={altoEsMetros ? "m" : "cm"}
            title={
              altoEsMetros
                ? "Alto en metros (metro lineal)"
                : "Alto en centímetros (m² por dimensiones)"
            }
            value={line.altoCm}
            onChange={(e) =>
              patchItem(ot.key, line.key, { altoCm: e.target.value })
            }
            disabled={!showAltoField}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle min-w-[4rem]">
          <Input
            className={cn(
              "h-8 text-xs tabular-nums px-2",
              "border-border bg-background shadow-sm",
              "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
              "disabled:cursor-not-allowed disabled:bg-muted/40 disabled:border-border/60 disabled:text-muted-foreground/70 disabled:shadow-none",
            )}
            inputMode="decimal"
            placeholder="cm"
            title="Ancho (centímetros)"
            value={line.anchoCm}
            onChange={(e) =>
              patchItem(ot.key, line.key, { anchoCm: e.target.value })
            }
            disabled={!showAnchoCm}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle w-[3.25rem]">
          <Input
            className={cn(
              "h-8 text-xs tabular-nums px-2",
              "border-border bg-background shadow-sm",
              "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
              "disabled:cursor-not-allowed disabled:bg-muted/40 disabled:border-border/60 disabled:text-muted-foreground/70 disabled:shadow-none",
            )}
            inputMode="decimal"
            placeholder="%"
            title="Desperdicio: % extra sobre el área (cortes, roturas). Vacío = 0%. Aplica a m² por dimensiones y a metro lineal."
            value={line.desperdicioPct}
            onChange={(e) =>
              patchItem(ot.key, line.key, { desperdicioPct: e.target.value })
            }
            disabled={!showDesperdicio}
          />
        </TableCell>
        <TableCell className="px-2.5 py-2 align-middle text-right text-xs font-semibold tabular-nums whitespace-nowrap text-foreground">
          {showM2Col ? (
            m2Linea.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 3,
            })
          ) : (
            <span className="font-medium text-muted-foreground/35">–</span>
          )}
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
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="w-full max-w-none pb-44">
      <div className="mx-auto max-w-6xl space-y-6 px-3 sm:px-4 lg:px-0 pb-8">
        <PresupuestoStepper step={wizardStep} />

        <div className="min-h-[260px]">
          {wizardStep === 0 ? (
            <StepCliente
              clientesLocales={clientesLocales}
              clienteSeleccionadoId={clienteSeleccionadoId}
              aplicarCliente={aplicarCliente}
              abrirNuevoCliente={abrirNuevoCliente}
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
              tecnicos={tecnicos}
              totalesItems={totalesItems}
              patchOrden={patchOrden}
              addOrdenTrabajo={addOrdenTrabajo}
              removeOrdenTrabajo={removeOrdenTrabajo}
              addItem={addItem}
              renderLineaCells={renderLineaCells}
            />
          ) : null}

          {wizardStep === 2 ? (
            <StepLogistica logistica={logistica} setLogistica={setLogistica} />
          ) : null}

          {wizardStep === 3 ? (
            <StepConfirmacion
              clienteNombre={clienteSeleccionado?.nombre ?? "—"}
              listaPrecioLabel={
                LISTAS_PRECIO_MOCK.find((l) => l.id === listaPrecioId)?.label ?? "—"
              }
              origenLabel={origenLabelDisplay}
              monedaPresupuesto={monedaPresupuesto}
              ordenesCount={ordenes.length}
              lineItemsCount={totalLineasOt}
              logistica={logistica}
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
              totalesTotalTon={totalesItems.totalTon}
            />
          ) : null}
        </div>
      </div>


      <Dialog
        open={dialogClienteAbierto}
        onOpenChange={setDialogClienteAbierto}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>
              Datos en memoria (mock). Guardar agrega el cliente a la lista y lo
              selecciona.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre / razón social</Label>
              <Input
                className="h-9 text-sm"
                value={draftCliente.nombre}
                onChange={(e) =>
                  setDraftCliente((d) => ({ ...d, nombre: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contacto</Label>
              <Input
                className="h-9 text-sm"
                value={draftCliente.contacto}
                onChange={(e) =>
                  setDraftCliente((d) => ({ ...d, contacto: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tel.</Label>
                <Input
                  className="h-9 text-sm"
                  value={draftCliente.tel}
                  onChange={(e) =>
                    setDraftCliente((d) => ({ ...d, tel: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  className="h-9 text-sm"
                  type="email"
                  value={draftCliente.email}
                  onChange={(e) =>
                    setDraftCliente((d) => ({ ...d, email: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input
                className="h-9 text-sm"
                value={draftCliente.direccion}
                onChange={(e) =>
                  setDraftCliente((d) => ({ ...d, direccion: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={guardarDraftCliente}
              disabled={!draftCliente.nombre.trim()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog
        open={!!grabarExito}
        onOpenChange={(o) => !o && setGrabarExito(null)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Presupuesto guardado</DialogTitle>
            <DialogDescription>
              Registro generado correctamente. Número y versión:{" "}
              <span className="font-semibold text-foreground">
                {grabarExito}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setGrabarExito(null)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                setGrabarExito(null);
                setResumenAbierto(true);
              }}
            >
              Ir al resumen / imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resumenAbierto} onOpenChange={setResumenAbierto}>
        <DialogContent
          className="gap-0 p-0 sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
          showCloseButton
        >
          <DialogHeader className="border-b bg-muted/30 px-6 py-5 shrink-0">
            <DialogTitle className="text-xl font-bold">
              Resumen del presupuesto
            </DialogTitle>
            <DialogDescription>
              Rubros. Dólar hoy {formatUsd(dolarHoy)}.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-6">
            <PresupuestoResumenInterior
              dolarHoy={dolarHoy}
              cotizacionMixtaActiva={cotizacionMixtaActiva}
              setCotizacionMixtaActiva={setCotizacionMixtaActiva}
              lineasResumen={lineasResumen}
              setLineaResumen={setLineaResumen}
              monedaFinal={monedaFinal}
              setMonedaFinal={setMonedaFinal}
              totalUsdEquivalente={totalUsdEquivalente}
              totalArsEquivalente={totalArsEquivalente}
              materialM2Presupuesto={totalesItems.totalM2}
              materialTonEstimadoPresupuesto={
                totalesItems.totalTon > 0 ? totalesItems.totalTon : null
              }
            />
          </div>
          <DialogFooter className="border-t px-6 py-4 gap-2">
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
          "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 sm:left-56",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {wizardStep < 3 ? (
            <div className="text-[11px] sm:text-xs min-w-0 flex-1 tabular-nums space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {lineasResumen.map((ln, idx) => (
                  <span key={ln.id}>
                    {idx > 0 ? (
                      <span className="text-border mx-1.5 hidden sm:inline">|</span>
                    ) : null}
                    <span className="text-muted-foreground">
                      {abbrRubroFooter(ln.id)}
                    </span>{" "}
                    <strong>
                      {ln.moneda === "usd"
                        ? `US$${formatUsd(parseMoneyInput(ln.monto))}`
                        : `$${formatArsEntero(parseMoneyInput(ln.monto))}`}
                    </strong>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground">
                <span>
                  Ítems{" "}
                  <strong className="text-foreground">
                    $
                    {monedaPresupuesto === "usd"
                      ? formatUsd(totalesItems.totalConDesc)
                      : formatArsEntero(totalesItems.totalConDesc)}
                  </strong>
                </span>
                <span className="hidden sm:inline text-border">|</span>
                <span>
                  m²{" "}
                  <strong className="text-foreground">
                    {totalesItems.totalM2.toLocaleString("es-AR", {
                      maximumFractionDigits: 3,
                    })}
                  </strong>
                </span>
                {totalesItems.totalTon > 0 ? (
                  <>
                    <span className="hidden sm:inline text-border">|</span>
                    <span>
                      ton (~){" "}
                      <strong className="text-foreground">
                        {totalesItems.totalTon.toLocaleString("es-AR", {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 4,
                        })}
                      </strong>
                    </span>
                  </>
                ) : null}
                <span className="hidden sm:inline text-border">|</span>
                <span>
                  TOTAL equiv. USD{" "}
                  <strong className="text-foreground">
                    US${formatUsd(totalUsdEquivalente)}
                  </strong>
                </span>
                <span className="text-border mx-1 sm:inline">·</span>
                <span>
                  ARS{" "}
                  <strong className="text-foreground">
                    ${formatArsEntero(totalArsEquivalente)}
                  </strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs sm:text-sm min-w-0 flex-1 tabular-nums">
              <span className="text-muted-foreground">Ítems c/ dto.</span>{" "}
              <strong>
                $
                {monedaPresupuesto === "usd"
                  ? formatUsd(totalesItems.totalConDesc)
                  : formatArsEntero(totalesItems.totalConDesc)}
              </strong>
              <span className="mx-2 text-border">|</span>
              <span className="text-muted-foreground">MEC</span>{" "}
              <strong>
                $
                {monedaPresupuesto === "usd"
                  ? formatUsd(totalMecImporte)
                  : formatArsEntero(totalMecImporte)}
              </strong>
              <span className="mx-2 text-border">|</span>
              <span className="text-muted-foreground">m²</span>{" "}
              <strong>
                {totalesItems.totalM2.toLocaleString("es-AR", {
                  maximumFractionDigits: 3,
                })}
              </strong>
              {totalesItems.totalTon > 0 ? (
                <>
                  <span className="mx-2 text-border">|</span>
                  <span className="text-muted-foreground">ton (~)</span>{" "}
                  <strong>
                    {totalesItems.totalTon.toLocaleString("es-AR", {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 4,
                    })}
                  </strong>
                </>
              ) : null}
              <span className="mx-2 text-border">|</span>
              <span className="text-muted-foreground">Total</span>{" "}
              <strong>
                $
                {monedaPresupuesto === "usd"
                  ? formatUsd(totalPresupuesto)
                  : formatArsEntero(totalPresupuesto)}
              </strong>
            </div>
          )}
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
            {wizardStep < 3 ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-muted-foreground"
                  onClick={handleImprimir}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  onClick={handleWizardSiguiente}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
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
                  className="gap-1 bg-green-700 text-white hover:bg-green-800"
                  onClick={handleGrabar}
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
