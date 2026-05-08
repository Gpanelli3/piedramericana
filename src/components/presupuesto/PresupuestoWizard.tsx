"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Plus,
  Minus,
  ClipboardList,
  Check,
  ChevronsUpDown,
  Trash2,
  Ruler,
  ChevronDown,
  Save,
  Printer,
  Search,
} from "lucide-react";
import {
  ARTICULOS_MOCK,
  LISTAS_PRECIO_MOCK,
  getArticuloById,
} from "@/data/presupuesto-articulos-mock";
import {
  CLIENTES_PRESUPUESTO_MOCK,
  ORIGEN_VENTA_OPCIONES,
  type ClientePresupuestoMock,
} from "@/data/presupuesto-clientes-mock";
import {
  buildLineaCalcInput,
  computeLineaPresupuesto,
  dimensionesHabilitadas,
  permiteModoManualCantidadM2,
  labelUnidad,
  type ModoIngresoM2,
} from "@/lib/presupuesto-calculos";
import {
  PresupuestoResumenInterior,
  type LineaResumenMoneda,
} from "@/components/presupuesto/PresupuestoResumenInterior";

const MSG_MEC_INCORRECTO =
  "El costo del servicio MEC es incorrecto. Si tenés tildada medición, entrega o colocación, cargá un importe mayor a cero o destildá los servicios que no correspondan.";

const TIPOS_COLOCACION = [
  { value: "bajo", label: "Bajo mesada" },
  { value: "sobre", label: "Sobre mesada" },
  { value: "ras", label: "Al ras" },
] as const;

const MODELOS_BACHA = [
  { value: "johnson-ss", label: "Johnson — Acero Premium" },
  { value: "mi-pileta", label: "Mi Pileta — Linea Cocina" },
  { value: "franke", label: "Franke — Orion 70" },
  { value: "rohe", label: "Rohé — Oval 60" },
  { value: "sin", label: "Sin especificar / a definir" },
] as const;

const MATERIALES_MOCK_FALLBACK = [
  { id: "__mock-silestone", name: "Silestone Blanco Norte", unit: "m2" },
  { id: "__mock-granito", name: "Granito Negro Brasil Extra 20mm", unit: "m2" },
  { id: "__mock-cuarcita", name: "Cuarcita Black Taurus", unit: "m2" },
  { id: "__mock-dekton", name: "Dekton DK Industrial Nilium Mate 8mm", unit: "m2" },
];

type LogisticaPresupuesto = {
  fechaCoord: string;
  fechaEntrega: string;
  observacion: string;
};

export type LineaItemOT = {
  key: string;
  articuloId: string;
  modoIngreso: ModoIngresoM2;
  cantidad: string;
  precioUnitario: string;
  altoCm: string;
  anchoCm: string;
  desperdicioPct: string;
};

type OrdenTrabajoWizard = {
  key: string;
  titulo: string;
  fecha: string;
  tecnicoId: string;
  fechaMedicion: string;
  fechaEntrega: string;
  materialId: string;
  tipoColocacion: (typeof TIPOS_COLOCACION)[number]["value"];
  bachaId: string;
  items: LineaItemOT[];
  mMedicion: boolean;
  mEntrega: boolean;
  mColocacion: boolean;
  totalMec: string;
  /** Panel de detalle de la OT (ítems, etc.); nuevas OT empiezan cerradas. */
  panelExpandido: boolean;
};

function parseMoneyInput(v: string): number {
  const t = v.trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function formatUsd(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mecAlgunoActivo(m: boolean, e: boolean, c: boolean): boolean {
  return m || e || c;
}

function validarTotalMecSiAplica(m: boolean, e: boolean, c: boolean, totalStr: string): boolean {
  if (!mecAlgunoActivo(m, e, c)) return true;
  return parseMoneyInput(totalStr) > 0;
}

function nuevoNumeroPresupuestoMock(): string {
  const y = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `PR-${y}-${n} · v1`;
}

function newLineaItem(articuloId: string): LineaItemOT {
  const art = getArticuloById(articuloId);
  const modo: ModoIngresoM2 =
    art && permiteModoManualCantidadM2(art) ? "dimensiones" : "manual";
  const dimM2 = art?.unidad === "M2" && modo === "dimensiones" && art.calculaMaterial && !art.medidaEstandarM2;
  const ml = art?.unidad === "ML" && art.calculaMaterial && !art.medidaEstandarM2;
  return {
    key: crypto.randomUUID(),
    articuloId,
    modoIngreso: modo,
    cantidad: "1",
    precioUnitario: art ? String(art.precioUnitario) : "0",
    altoCm: dimM2 ? "200" : ml ? "5" : "",
    anchoCm: dimM2 ? "200" : "",
    desperdicioPct: dimM2 ? "1" : "0",
  };
}

function newOrdenTrabajo(materialIdDefault: string): OrdenTrabajoWizard {
  return {
    key: crypto.randomUUID(),
    titulo: "",
    fecha: "",
    tecnicoId: "",
    fechaMedicion: "",
    fechaEntrega: "",
    materialId: materialIdDefault,
    tipoColocacion: "bajo",
    bachaId: MODELOS_BACHA[0]!.value,
    items: [],
    mMedicion: true,
    mEntrega: true,
    mColocacion: true,
    totalMec: "1",
    panelExpandido: false,
  };
}

function SectionPresupuesto({
  title,
  borderAccentClass,
  children,
}: {
  title: string;
  borderAccentClass: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-white overflow-hidden shadow-sm scroll-mt-4",
        borderAccentClass
      )}
    >
      <div className="border-b border-border bg-muted/35 px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function PickCliente({
  clientes,
  value,
  onChange,
  onNuevoCliente,
}: {
  clientes: ClientePresupuestoMock[];
  value: string | null;
  onChange: (c: ClientePresupuestoMock) => void;
  /** Abre el alta de cliente; recibe el texto buscado para precargar nombre si no hubo coincidencias. */
  onNuevoCliente: (textoBuscado: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();
  const selected = value ? clientes.find((c) => c.id === value) : undefined;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.contacto.toLowerCase().includes(q)
    );
  }, [clientes, search]);

  const clearBlurTimer = () => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      setSearch(selected?.nombre ?? "");
    }
  }, [open, value, selected?.nombre]);

  useEffect(
    () => () => {
      clearBlurTimer();
    },
    []
  );

  const handleAbrirAltaDesdeLista = () => {
    onNuevoCliente(search.trim());
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        clearBlurTimer();
        setOpen(next);
      }}
    >
      <PopoverAnchor asChild>
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-primary-foreground/90"
            aria-hidden
          />
          <Input
            type="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-label="Buscar cliente o profesional"
            placeholder="Nombre o firma…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              clearBlurTimer();
              setOpen(true);
            }}
            onBlur={() => {
              clearBlurTimer();
              blurCloseTimer.current = setTimeout(() => setOpen(false), 150);
            }}
            className={cn(
              "h-9 w-full pl-8 pr-2.5 text-sm shadow-sm md:text-sm",
              "border-cyan-600 bg-cyan-600 text-primary-foreground",
              "placeholder:text-primary-foreground/75",
              "focus-visible:border-cyan-500 focus-visible:ring-[3px] focus-visible:ring-cyan-500",
              "[&::-webkit-search-cancel-button]:appearance-none"
            )}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[min(100vw-2rem,32rem)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList id={listboxId} className="max-h-[min(18rem,50vh)]">
            <CommandEmpty className="py-4 px-3 space-y-3 text-left">
              <p className="text-sm text-muted-foreground">
                No hay ningún cliente que coincida{search.trim() ? ` con «${search.trim()}»` : ""}.
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                Usá el botón <span className="font-medium text-foreground">+</span> al lado del buscador o el acceso de abajo para dar de alta uno nuevo.
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAbrirAltaDesdeLista}
              >
                <Plus className="h-4 w-4 shrink-0" />
                Agregar nuevo cliente
              </Button>
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => {
                    onChange(c);
                    setSearch(c.nombre);
                    setOpen(false);
                  }}
                  className="data-[selected=true]:bg-cyan-600 data-[selected=true]:text-primary-foreground cursor-pointer"
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col gap-0 min-w-0">
                    <span className="truncate font-medium">{c.nombre}</span>
                    <span className="text-[10px] opacity-80 truncate">{c.contacto}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PickMaterial({
  materials,
  value,
  onChange,
  disabled,
  triggerClassName,
}: {
  materials: { id: string; name: string; unit: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = materials.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-full justify-between px-3 text-sm font-normal", triggerClassName)}
        >
          <span className="truncate">
            {selected ? `${selected.name}${selected.unit ? ` (${selected.unit})` : ""}` : "Elegir material…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,26rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar material…" />
          <CommandList>
            <CommandEmpty>{materials.length ? "Sin coincidencias." : "Sin materiales."}</CommandEmpty>
            <CommandGroup>
              {materials.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name} ${m.id}`}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 shrink-0", value === m.id ? "opacity-100" : "opacity-0")}
                  />
                  {m.name}
                  {m.unit ? ` (${m.unit})` : ""}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PickTecnico({
  tecnicos,
  value,
  onChange,
}: {
  tecnicos: { id: string; full_name: string | null }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = tecnicos.find((t) => t.id === value);
  if (tecnicos.length === 0) {
    return (
      <Input readOnly disabled className="h-9 text-sm" placeholder="Sin técnicos (tabla usuarios)" />
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="h-9 w-full justify-between px-3 text-sm font-normal"
        >
          <span className="truncate">
            {selected ? selected.full_name?.trim() || selected.id.slice(0, 8) : "Elegir técnico…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar técnico…" />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              {tecnicos.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.full_name ?? ""} ${t.id}`}
                  onSelect={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 shrink-0", value === t.id ? "opacity-100" : "opacity-0")}
                  />
                  {t.full_name?.trim() || t.id.slice(0, 8)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PickBacha({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = MODELOS_BACHA.find((b) => b.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="h-9 w-full justify-between px-3 text-sm font-normal">
          <span className="truncate">{selected?.label ?? "Elegir bacha…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,24rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar modelo…" />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              {MODELOS_BACHA.map((b) => (
                <CommandItem
                  key={b.value}
                  value={b.label}
                  onSelect={() => {
                    onChange(b.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === b.value ? "opacity-100" : "opacity-0")} />
                  {b.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PickArticulo({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = getArticuloById(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between text-xs font-normal",
            compact ? "h-7 min-w-[7rem] px-1.5" : "h-8 min-w-[12rem] px-2"
          )}
        >
          <span className="truncate text-left">{selected?.descripcion ?? "Seleccionar…"}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar artículo…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {ARTICULOS_MOCK.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.descripcion} ${a.codigo}`}
                  onSelect={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === a.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex flex-col gap-0">
                    <span>{a.descripcion}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {a.codigo} · {labelUnidad(a.unidad)}
                      {!a.calculaMaterial ? " · sin m²" : a.medidaEstandarM2 ? ` · std ${a.medidaEstandarM2} m²` : ""}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PresupuestoWizard() {
  const dolarHoy = 1250.5;

  const [mecScope, setMecScope] = useState<"global" | "por_ot">("global");
  const [mMedicionGlobal, setMMedicionGlobal] = useState(true);
  const [mEntregaGlobal, setMEntregaGlobal] = useState(true);
  const [mColocacionGlobal, setMColocacionGlobal] = useState(true);
  const [totalMecGlobal, setTotalMecGlobal] = useState("1");

  const [clientesLocales, setClientesLocales] = useState<ClientePresupuestoMock[]>(() => [...CLIENTES_PRESUPUESTO_MOCK]);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);
  const [contacto, setContacto] = useState("");
  const [origenVentas, setOrigenVentas] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [obsCabecera, setObsCabecera] = useState("");
  const [listaPrecioId, setListaPrecioId] = useState<string>(LISTAS_PRECIO_MOCK[0]!.id);
  const [monedaPresupuesto, setMonedaPresupuesto] = useState<"ars" | "usd">("usd");

  const defaultMat = MATERIALES_MOCK_FALLBACK[0]!.id;
  const [materials, setMaterials] = useState(MATERIALES_MOCK_FALLBACK);
  const [tecnicos, setTecnicos] = useState<{ id: string; full_name: string | null }[]>([]);
  const [catalogoCargando, setCatalogoCargando] = useState(isSupabaseConfigured);

  const [ordenes, setOrdenes] = useState<OrdenTrabajoWizard[]>(() => [newOrdenTrabajo(defaultMat)]);
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState("");

  const [logistica, setLogistica] = useState<LogisticaPresupuesto>(() => ({
    fechaCoord: "",
    fechaEntrega: "",
    observacion: "Entregar de 12:00 a 15:00 hs",
  }));

  const [cotizacionMixtaActiva, setCotizacionMixtaActiva] = useState(true);
  const [monedaFinal, setMonedaFinal] = useState("pesos");
  const [lineasResumen, setLineasResumen] = useState<LineaResumenMoneda[]>([
    { id: "piedra", label: "Piedra / chapa del material", monto: "850", moneda: "usd" },
    { id: "mo", label: "Mano de obra y pulido", monto: "400000", moneda: "ars" },
    { id: "perf", label: "Perforaciones (trasforos)", monto: "118750", moneda: "ars" },
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
        .select("id,name,unit")
        .order("name");
      if (!cancelled && !matsErr && mats?.length) {
        setMaterials(mats);
        setOrdenes((prev) =>
          prev.map((o) =>
            mats.some((m) => m.id === o.materialId) ? o : { ...o, materialId: mats[0]!.id }
          )
        );
      } else if (!cancelled) {
        setMaterials(MATERIALES_MOCK_FALLBACK);
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
    () => (clienteSeleccionadoId ? clientesLocales.find((c) => c.id === clienteSeleccionadoId) : undefined),
    [clienteSeleccionadoId, clientesLocales]
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
    setOrdenes((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addOrdenTrabajo = () => {
    const mid = materials[0]?.id ?? defaultMat;
    setOrdenes((rows) => [...rows, newOrdenTrabajo(mid)]);
  };

  const removeOrdenTrabajo = (key: string) => {
    setOrdenes((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  };

  const addItem = (otKey: string) => {
    const aid = ARTICULOS_MOCK[0]!.id;
    setOrdenes((rows) =>
      rows.map((r) => (r.key === otKey ? { ...r, items: [...r.items, newLineaItem(aid)] } : r))
    );
  };

  const removeItem = (otKey: string, lineKey: string) => {
    setOrdenes((rows) =>
      rows.map((r) => {
        if (r.key !== otKey) return r;
        return { ...r, items: r.items.filter((l) => l.key !== lineKey) };
      })
    );
  };

  const patchItem = (otKey: string, lineKey: string, patch: Partial<LineaItemOT>) => {
    setOrdenes((rows) =>
      rows.map((r) =>
        r.key !== otKey
          ? r
          : {
              ...r,
              items: r.items.map((l) => (l.key === lineKey ? { ...l, ...patch } : l)),
            }
      )
    );
  };

  const onArticuloChange = (otKey: string, lineKey: string, articuloId: string) => {
    const art = getArticuloById(articuloId);
    const modo: ModoIngresoM2 =
      art && permiteModoManualCantidadM2(art) ? "dimensiones" : "manual";
    const dimM2 = art?.unidad === "M2" && modo === "dimensiones" && art.calculaMaterial && !art.medidaEstandarM2;
    const ml = art?.unidad === "ML" && art.calculaMaterial && !art.medidaEstandarM2;
    patchItem(otKey, lineKey, {
      articuloId,
      modoIngreso: modo,
      precioUnitario: art ? String(art.precioUnitario) : "0",
      cantidad: "1",
      altoCm: dimM2 ? "200" : ml ? "5" : "",
      anchoCm: dimM2 ? "200" : "",
      desperdicioPct: dimM2 ? "1" : "0",
    });
  };

  const setLineaResumen = (id: string, patch: Partial<LineaResumenMoneda>) => {
    setLineasResumen((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const totalesItems = useMemo(() => {
    let subtotal = 0;
    let totalM2 = 0;
    const porOt: { key: string; titulo: string; subtotal: number; m2: number; cantLineas: number }[] = [];
    for (const ot of ordenes) {
      let sOt = 0;
      let m2Ot = 0;
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
      }
      porOt.push({
        key: ot.key,
        titulo: ot.titulo.trim() || "Sin título",
        subtotal: sOt,
        m2: m2Ot,
        cantLineas: nLineas,
      });
    }
    const dPct = Math.max(0, parseMoneyInput(descuentoGlobalPct));
    const factor = 1 - Math.min(dPct, 100) / 100;
    const totalConDesc = subtotal * factor;
    return { subtotal, totalM2, totalConDesc, porOt, descuentoPct: dPct };
  }, [ordenes, descuentoGlobalPct]);

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
    if (!clienteSeleccionadoId) return "Seleccioná un cliente de la lista o cargá uno nuevo con +.";
    if (!origenVentas) return "El origen de la venta es obligatorio (dato estadístico).";
    if (mecScope === "global") {
      if (!validarTotalMecSiAplica(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal, totalMecGlobal)) {
        return MSG_MEC_INCORRECTO;
      }
    } else {
      for (const ot of ordenes) {
        if (!validarTotalMecSiAplica(ot.mMedicion, ot.mEntrega, ot.mColocacion, ot.totalMec)) {
          return MSG_MEC_INCORRECTO;
        }
      }
    }
    return null;
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

  const renderLineaCells = (ot: OrdenTrabajoWizard, line: LineaItemOT) => {
    const art = getArticuloById(line.articuloId);
    if (!art) return null;
    const calc = buildLineaCalcInput(art, line);
    const { m2Linea, subtotal: subL } = computeLineaPresupuesto(art, calc);
    const dim = dimensionesHabilitadas(art);
    const manualM2 = permiteModoManualCantidadM2(art);
    const showAltoCm = dim && (art.unidad === "ML" || (art.unidad === "M2" && line.modoIngreso === "dimensiones"));
    const showAnchoCm = dim && art.unidad === "M2" && line.modoIngreso === "dimensiones";
    const showDesperdicio = dim && art.unidad === "M2" && line.modoIngreso === "dimensiones";

    return (
      <TableRow key={line.key} className="border-b border-border/70">
        <TableCell className="px-1 py-0.5 align-middle text-[10px] font-mono text-muted-foreground whitespace-nowrap">
          {art.codigo}
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle min-w-[8rem]">
          <PickArticulo compact value={line.articuloId} onChange={(id) => onArticuloChange(ot.key, line.key, id)} />
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle text-[10px] font-medium whitespace-nowrap">{labelUnidad(art.unidad)}</TableCell>
        <TableCell className="px-1 py-0.5 align-middle w-[4.75rem]">
          <div className="flex flex-col gap-0.5">
            {manualM2 ? (
              <div className="flex gap-0.5">
                <Button
                  type="button"
                  variant={line.modoIngreso === "dimensiones" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-5 px-1 text-[9px] leading-none"
                  onClick={() => patchItem(ot.key, line.key, { modoIngreso: "dimensiones" })}
                >
                  dim.
                </Button>
                <Button
                  type="button"
                  variant={line.modoIngreso === "manual" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-5 px-1 text-[9px] leading-none"
                  onClick={() => patchItem(ot.key, line.key, { modoIngreso: "manual" })}
                >
                  man.
                </Button>
              </div>
            ) : null}
            <Input
              className="h-7 text-[11px] px-1.5"
              inputMode="decimal"
              title="Cantidad"
              value={line.cantidad}
              onChange={(e) => patchItem(ot.key, line.key, { cantidad: e.target.value })}
            />
          </div>
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle w-[4.25rem]">
          <Input
            className="h-7 text-[11px] px-1.5 tabular-nums"
            inputMode="decimal"
            value={line.precioUnitario}
            onChange={(e) => patchItem(ot.key, line.key, { precioUnitario: e.target.value })}
          />
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle text-right">
          <span className="text-[11px] font-semibold tabular-nums leading-none">
            {subL.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
          </span>
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle w-[3.25rem]">
          <Input
            className="h-7 text-[11px] px-1 tabular-nums"
            inputMode="decimal"
            placeholder="cm"
            title="Alto (cm)"
            value={line.altoCm}
            onChange={(e) => patchItem(ot.key, line.key, { altoCm: e.target.value })}
            disabled={!showAltoCm}
          />
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle w-[3.25rem]">
          <Input
            className="h-7 text-[11px] px-1 tabular-nums"
            inputMode="decimal"
            placeholder="cm"
            title="Ancho (cm)"
            value={line.anchoCm}
            onChange={(e) => patchItem(ot.key, line.key, { anchoCm: e.target.value })}
            disabled={!showAnchoCm}
          />
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle w-11">
          <Input
            className="h-7 text-[11px] px-1 tabular-nums"
            inputMode="decimal"
            placeholder="%"
            value={line.desperdicioPct}
            onChange={(e) => patchItem(ot.key, line.key, { desperdicioPct: e.target.value })}
            disabled={!showDesperdicio}
          />
        </TableCell>
        <TableCell className="px-1 py-0.5 align-middle text-right text-[11px] font-medium tabular-nums whitespace-nowrap">
          {art.calculaMaterial ? m2Linea.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : "—"}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-36">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
        <Label className="text-xs font-semibold sm:shrink-0">Ámbito del servicio MEC</Label>
        <RadioGroup
          value={mecScope}
          onValueChange={(v) => setMecScope(v as "global" | "por_ot")}
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="global" id="mec-g" />
            <Label htmlFor="mec-g" className="text-sm font-normal cursor-pointer">
              MEC único para todo el presupuesto (habitual)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="por_ot" id="mec-o" />
            <Label htmlFor="mec-o" className="text-sm font-normal cursor-pointer">
              MEC por cada orden de trabajo
            </Label>
          </div>
        </RadioGroup>
      </div>

      {catalogoCargando ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
          Cargando materiales y técnicos…
        </p>
      ) : null}

      <SectionPresupuesto title="Cliente / Profesional" borderAccentClass="border-t-4 border-t-red-500">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-xs font-medium text-foreground">Cliente / Profesional</Label>
              <PickCliente
                clientes={clientesLocales}
                value={clienteSeleccionadoId}
                onChange={aplicarCliente}
                onNuevoCliente={abrirNuevoCliente}
              />
            </div>
            <div className="flex shrink-0 justify-end sm:justify-start sm:pb-px">
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 shrink-0 bg-sky-600 hover:bg-sky-700 text-white"
                onClick={() => abrirNuevoCliente()}
                title="Nuevo cliente (si no aparece en el buscador)"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Lista de precio</Label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={listaPrecioId}
                onChange={(e) => setListaPrecioId(e.target.value)}
              >
                {LISTAS_PRECIO_MOCK.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Moneda</Label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={monedaPresupuesto}
                onChange={(e) => setMonedaPresupuesto(e.target.value as "ars" | "usd")}
              >
                <option value="usd">Dólares (USD)</option>
                <option value="ars">Pesos (ARS)</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs font-medium">
                Origen <span className="text-destructive">*</span>
              </Label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={origenVentas}
                onChange={(e) => setOrigenVentas(e.target.value)}
              >
                {ORIGEN_VENTA_OPCIONES.map((o) => (
                  <option key={o.value === "" ? "_sin_origen" : o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Contacto</Label>
              <Input className="h-8 text-sm px-2.5" value={contacto} onChange={(e) => setContacto(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Tel. / Celular</Label>
              <Input className="h-8 text-sm px-2.5" value={tel} onChange={(e) => setTel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Email</Label>
              <Input type="email" className="h-8 text-sm px-2.5" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:items-start">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Dirección de entrega</Label>
              <Input className="h-8 text-sm px-2.5" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Observaciones grales.</Label>
              <Textarea
                className="min-h-[52px] max-h-32 resize-y py-1.5 text-sm px-2.5"
                placeholder="Observaciones Grales - Max. 500 caracteres"
                maxLength={500}
                value={obsCabecera}
                onChange={(e) => setObsCabecera(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground text-right leading-none pt-0.5">{obsCabecera.length}/500</p>
            </div>
          </div>
        </div>
      </SectionPresupuesto>

      {ordenes.map((ot, idx) => {
        const materialRow = materials.find((m) => m.id === ot.materialId);
        const materialNombre = materialRow
          ? `${materialRow.name}${materialRow.unit ? ` (${materialRow.unit})` : ""}`
          : "Material";

        return (
          <section key={ot.key} className="rounded-lg border border-border bg-white border-t-4 border-t-sky-500 shadow-sm overflow-hidden">
            <Collapsible open={ot.panelExpandido} onOpenChange={(open) => patchOrden(ot.key, { panelExpandido: open })}>
              <div className="flex flex-wrap items-stretch gap-0 border-b border-border bg-muted/30">
                <span className="inline-flex items-center self-center rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white shrink-0 m-2">
                  OT Nro. {idx}
                </span>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-1 pr-2 text-left rounded-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        ot.panelExpandido && "rotate-180"
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {ot.titulo.trim() || "Sin título"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{materialNombre}</span>
                    </div>
                  </button>
                </CollapsibleTrigger>
                {ordenes.length > 1 ? (
                  <div className="flex items-center pr-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeOrdenTrabajo(ot.key)}
                      aria-label="Quitar orden de trabajo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>

              <CollapsibleContent>
                <div className="p-3 sm:p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Título</Label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="titulo"
                        value={ot.titulo}
                        onChange={(e) => patchOrden(ot.key, { titulo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Material (chapa)</Label>
                      <PickMaterial materials={materials} value={ot.materialId} onChange={(id) => patchOrden(ot.key, { materialId: id })} />
                    </div>
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground px-0 text-xs">
                        <ChevronDown className="h-3.5 w-3.5" />
                        Más datos de la OT (bacha, fechas, técnico, colocación)
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-dashed border-border mt-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Bacha</Label>
                          <PickBacha value={ot.bachaId} onChange={(id) => patchOrden(ot.key, { bachaId: id })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fecha OT</Label>
                          <Input type="date" className="h-9 text-sm" value={ot.fecha} onChange={(e) => patchOrden(ot.key, { fecha: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Técnico a medir</Label>
                          <PickTecnico tecnicos={tecnicos} value={ot.tecnicoId} onChange={(id) => patchOrden(ot.key, { tecnicoId: id })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fecha medición</Label>
                          <Input
                            type="date"
                            className="h-9 text-sm"
                            value={ot.fechaMedicion}
                            onChange={(e) => patchOrden(ot.key, { fechaMedicion: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fecha entrega estimada</Label>
                          <Input
                            type="date"
                            className="h-9 text-sm"
                            value={ot.fechaEntrega}
                            onChange={(e) => patchOrden(ot.key, { fechaEntrega: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-xs">Colocación en obra (referencia)</Label>
                          <RadioGroup
                            value={ot.tipoColocacion}
                            onValueChange={(v) =>
                              patchOrden(ot.key, { tipoColocacion: v as (typeof TIPOS_COLOCACION)[number]["value"] })
                            }
                            className="flex flex-wrap gap-4"
                          >
                            {TIPOS_COLOCACION.map((opt) => (
                              <div key={opt.value} className="flex items-center gap-2">
                                <RadioGroupItem value={opt.value} id={`${ot.key}-${opt.value}`} />
                                <Label htmlFor={`${ot.key}-${opt.value}`} className="text-sm font-normal">
                                  {opt.label}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator className="my-1" />

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ítems</span>
                    </div>
                    <div className="flex overflow-hidden rounded-md border border-border bg-background">
                      <div className="min-w-0 flex-1 overflow-x-auto">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow className="bg-muted/40 [&_th]:h-8 [&_th]:py-1 [&_th]:text-[10px]">
                              <TableHead className="whitespace-nowrap font-medium">Cód.</TableHead>
                              <TableHead className="min-w-[7rem] font-medium">Descripción</TableHead>
                              <TableHead className="font-medium">Unidad</TableHead>
                              <TableHead className="font-medium">Cant.</TableHead>
                              <TableHead className="font-medium">P. unit.</TableHead>
                              <TableHead className="text-right font-medium">Total $</TableHead>
                              <TableHead className="whitespace-nowrap font-medium">Alto (cm)</TableHead>
                              <TableHead className="whitespace-nowrap font-medium">Ancho (cm)</TableHead>
                              <TableHead className="font-medium">Desp.%</TableHead>
                              <TableHead className="text-right font-medium">m²</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ot.items.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={10} className="py-5 text-center text-[11px] text-muted-foreground">
                                  Todavía no hay ítems. Usá{" "}
                                  <button
                                    type="button"
                                    className="font-medium text-green-700 underline-offset-2 hover:underline"
                                    onClick={() => addItem(ot.key)}
                                  >
                                    Agregar ítem (+)
                                  </button>{" "}
                                  debajo para sumar la primera línea.
                                </TableCell>
                              </TableRow>
                            ) : (
                              ot.items.map((line) => renderLineaCells(ot, line))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {ot.items.length > 0 ? (
                        <div
                          className="flex w-11 shrink-0 flex-col border-l border-border bg-muted/15"
                          aria-hidden={false}
                        >
                          <div className="h-8 shrink-0 border-b border-border bg-muted/40" aria-hidden />
                          {ot.items.map((line) => (
                            <div
                              key={`${line.key}-quitar`}
                              className="flex min-h-[3.25rem] flex-1 items-center justify-center border-b border-border/70 px-0.5 py-1"
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label="Quitar ítem"
                                onClick={() => removeItem(ot.key, line.key)}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex justify-center pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 border-green-600 bg-green-50 text-green-800 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-100 dark:hover:bg-green-950/70"
                        onClick={() => addItem(ot.key)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar ítem (+)
                      </Button>
                    </div>
                  </div>

                  {mecScope === "por_ot" ? (
                    <>
                      <div className="flex flex-wrap items-center gap-5 border-t border-border pt-3">
                        <div className="flex items-center gap-2">
                          <Checkbox id={`m-${ot.key}`} checked={ot.mMedicion} onCheckedChange={(c) => patchOrden(ot.key, { mMedicion: Boolean(c) })} />
                          <Label htmlFor={`m-${ot.key}`} className="text-xs font-medium">
                            M Medición
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id={`e-${ot.key}`} checked={ot.mEntrega} onCheckedChange={(c) => patchOrden(ot.key, { mEntrega: Boolean(c) })} />
                          <Label htmlFor={`e-${ot.key}`} className="text-xs font-medium">
                            E Entrega
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id={`c-${ot.key}`} checked={ot.mColocacion} onCheckedChange={(c) => patchOrden(ot.key, { mColocacion: Boolean(c) })} />
                          <Label htmlFor={`c-${ot.key}`} className="text-xs font-medium">
                            C Colocación
                          </Label>
                        </div>
                        <div className="space-y-1 w-full max-w-[11rem] sm:ml-auto">
                          <Label className="text-xs">Total (M/E/C) $</Label>
                          <Input
                            className="h-8 text-sm tabular-nums"
                            inputMode="decimal"
                            value={ot.totalMec}
                            onChange={(e) => patchOrden(ot.key, { totalMec: e.target.value })}
                            disabled={!mecAlgunoActivo(ot.mMedicion, ot.mEntrega, ot.mColocacion)}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                      El servicio MEC de esta OT se gestiona en el bloque <span className="font-medium">Servicio MEC (presupuesto)</span>, después de Logística.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-6 text-xs border-t border-border pt-3 justify-between sm:justify-start">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cantidad</p>
                      <p className="font-semibold tabular-nums">{totalesItems.porOt.find((p) => p.key === ot.key)?.cantLineas ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Subtotal ($)</p>
                      <p className="font-semibold tabular-nums">
                        {totalesItems.porOt.find((p) => p.key === ot.key)?.subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 }) ?? "0"}
                      </p>
                    </div>
                    <div className="sm:ml-auto">
                      <p className="text-[10px] text-muted-foreground">Total m²</p>
                      <p className="font-semibold tabular-nums text-primary">
                        {totalesItems.porOt.find((p) => p.key === ot.key)?.m2.toLocaleString("es-AR", { minimumFractionDigits: 3 }) ?? "0"}
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>
        );
      })}

      <div className="flex justify-center pt-1">
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
          onClick={addOrdenTrabajo}
          title="Agregar orden de trabajo"
          aria-label="Agregar orden de trabajo"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SectionPresupuesto title="Logística" borderAccentClass="border-t-4 border-t-amber-500">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Coordinación de visita y entrega.</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs min-w-[9rem]">Fecha coordinación</TableHead>
                  <TableHead className="text-xs min-w-[9rem]">Fecha entrega pactada</TableHead>
                  <TableHead className="text-xs min-w-[240px]">Observación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="p-2">
                    <Input
                      type="date"
                      className="h-8 text-xs w-36"
                      value={logistica.fechaCoord}
                      onChange={(e) => setLogistica((l) => ({ ...l, fechaCoord: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="date"
                      className="h-8 text-xs w-36"
                      value={logistica.fechaEntrega}
                      onChange={(e) => setLogistica((l) => ({ ...l, fechaEntrega: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      className="h-8 text-xs"
                      value={logistica.observacion}
                      onChange={(e) => setLogistica((l) => ({ ...l, observacion: e.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPresupuesto>

      {mecScope === "global" ? (
        <SectionPresupuesto title="Servicio MEC (presupuesto)" borderAccentClass="border-t-4 border-t-emerald-600">
          <p className="text-xs text-muted-foreground mb-3">
            Medición, entrega y colocación. Si alguno está activo, el importe total del servicio es obligatorio.
          </p>
          <div className="flex flex-wrap items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <Checkbox id="mg-m" checked={mMedicionGlobal} onCheckedChange={(c) => setMMedicionGlobal(Boolean(c))} />
              <Label htmlFor="mg-m" className="text-xs font-medium">
                M Medición
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="mg-e" checked={mEntregaGlobal} onCheckedChange={(c) => setMEntregaGlobal(Boolean(c))} />
              <Label htmlFor="mg-e" className="text-xs font-medium">
                E Entrega
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="mg-c" checked={mColocacionGlobal} onCheckedChange={(c) => setMColocacionGlobal(Boolean(c))} />
              <Label htmlFor="mg-c" className="text-xs font-medium">
                C Colocación
              </Label>
            </div>
          </div>
          <div className="space-y-1 max-w-xs">
            <Label className="text-xs">Total (M/E/C) $</Label>
            <Input
              className="h-9 text-sm tabular-nums"
              inputMode="decimal"
              value={totalMecGlobal}
              onChange={(e) => setTotalMecGlobal(e.target.value)}
              disabled={!mecAlgunoActivo(mMedicionGlobal, mEntregaGlobal, mColocacionGlobal)}
            />
          </div>
        </SectionPresupuesto>
      ) : null}

      <SectionPresupuesto title="Totales y descuento" borderAccentClass="border-t-4 border-t-violet-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium">{clienteSeleccionado?.nombre ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-2">Lista de precio</p>
            <p>{LISTAS_PRECIO_MOCK.find((l) => l.id === listaPrecioId)?.label}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Moneda</p>
            <p className="font-medium uppercase">{monedaPresupuesto}</p>
            <p className="text-xs text-muted-foreground mt-2">MEC</p>
            <p className="text-xs">{mecScope === "global" ? "Global (presupuesto)" : "Por orden de trabajo"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Subtotal ítems ($)</Label>
            <Input readOnly className="h-9 text-sm font-semibold tabular-nums" value={totalesItems.subtotal.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descuento (%)</Label>
            <Input className="h-9 text-sm w-28" inputMode="decimal" placeholder="%" value={descuentoGlobalPct} onChange={(e) => setDescuentoGlobalPct(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Total ($)</Label>
            <Input readOnly className="h-9 text-sm font-bold tabular-nums" value={totalesItems.totalConDesc.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Total (m²)</Label>
            <Input readOnly className="h-9 text-sm font-bold tabular-nums text-primary" value={totalesItems.totalM2.toLocaleString("es-AR", { minimumFractionDigits: 3 })} />
          </div>
        </div>
        <p className="text-xs font-semibold mb-2">Desglose por OT</p>
        <ul className="space-y-1 text-sm mb-4">
          {totalesItems.porOt.map((p, i) => (
            <li key={p.key} className="flex justify-between border-b border-border/60 py-1 gap-2">
              <span className="min-w-0 truncate">
                OT {i}: {p.titulo}
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                {p.m2.toLocaleString("es-AR", { minimumFractionDigits: 3 })} m² · ${p.subtotal.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" className="gap-2" onClick={() => setResumenAbierto(true)}>
          <ClipboardList className="h-4 w-4" />
          Rubros / multimcurrency (resumen)
        </Button>
      </SectionPresupuesto>

      <Dialog open={dialogClienteAbierto} onOpenChange={setDialogClienteAbierto}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Datos en memoria (mock). Grabar agrega el cliente a la lista y lo selecciona.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre / razón social</Label>
              <Input className="h-9 text-sm" value={draftCliente.nombre} onChange={(e) => setDraftCliente((d) => ({ ...d, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contacto</Label>
              <Input className="h-9 text-sm" value={draftCliente.contacto} onChange={(e) => setDraftCliente((d) => ({ ...d, contacto: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tel.</Label>
                <Input className="h-9 text-sm" value={draftCliente.tel} onChange={(e) => setDraftCliente((d) => ({ ...d, tel: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input className="h-9 text-sm" type="email" value={draftCliente.email} onChange={(e) => setDraftCliente((d) => ({ ...d, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input className="h-9 text-sm" value={draftCliente.direccion} onChange={(e) => setDraftCliente((d) => ({ ...d, direccion: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={guardarDraftCliente} disabled={!draftCliente.nombre.trim()}>
              Grabar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!grabarError} onOpenChange={(o) => !o && setGrabarError(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>No se puede grabar</DialogTitle>
            <DialogDescription>{grabarError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setGrabarError(null)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!grabarExito} onOpenChange={(o) => !o && setGrabarExito(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Presupuesto grabado</DialogTitle>
            <DialogDescription>
              Registro generado correctamente. Número y versión: <span className="font-semibold text-foreground">{grabarExito}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => setGrabarExito(null)}>
              Cerrar
            </Button>
            <Button type="button" className="gap-2" onClick={() => { setGrabarExito(null); setResumenAbierto(true); }}>
              Ir al resumen / imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resumenAbierto} onOpenChange={setResumenAbierto}>
        <DialogContent className="gap-0 p-0 sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden" showCloseButton>
          <DialogHeader className="border-b bg-muted/30 px-6 py-5 shrink-0">
            <DialogTitle className="text-xl font-bold">Resumen del presupuesto</DialogTitle>
            <DialogDescription>Rubros. Dólar hoy {formatUsd(dolarHoy)}.</DialogDescription>
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
            />
          </div>
          <DialogFooter className="border-t px-6 py-4 gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}>
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
          "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 sm:left-56"
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs sm:text-sm min-w-0 tabular-nums">
            <span className="text-muted-foreground">Ítems</span> <strong>${totalesItems.subtotal.toFixed(2)}</strong>
            <span className="mx-2 text-border">|</span>
            <span className="text-muted-foreground">m²</span>{" "}
            <strong>{totalesItems.totalM2.toLocaleString("es-AR", { maximumFractionDigits: 3 })}</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="gap-1 bg-green-700 hover:bg-green-800 text-white" onClick={handleGrabar}>
              <Save className="h-4 w-4" />
              Grabar
            </Button>
            <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => setResumenAbierto(true)}>
              <ClipboardList className="h-4 w-4" />
              Rubros
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={handleImprimir}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
