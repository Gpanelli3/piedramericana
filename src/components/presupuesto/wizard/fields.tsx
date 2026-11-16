import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  menuItemActiveClass,
  menuItemClass,
  menuItemIdleClass,
  menuPanelClass,
} from "@/components/ui/menu-styles";
import { Plus, Check, ChevronsUpDown, Search } from "lucide-react";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { ClientePresupuesto } from "@/lib/clients-api";
import { labelUnidad } from "@/lib/presupuesto-calculos";
import type { UnidadArticuloDb } from "@/types/database";
import type { PlanchaBuscadorRow } from "@/lib/stock-api";
import { useEffect, useId, useMemo, useRef, useState } from "react";

function labelTipoUnidad(unidad: UnidadArticuloDb): string {
  if (unidad === "UNI") return "unidad";
  if (unidad === "PIEZA") return "pieza";
  if (unidad === "KG") return "kilo";
  if (unidad === "TON") return "tonelada";
  return labelUnidad(unidad);
}

export function SectionPresupuesto({
  title,
  borderAccentClass,
  className,
  contentClassName,
  children,
}: {
  /** Si se omite, no se muestra barra de título (p. ej. wizard con stepper arriba). */
  title?: string;
  borderAccentClass: string;
  /** Clases extra del contenedor (p. ej. sombra o radio por paso). */
  className?: string;
  /** Clases del área de contenido (padding). */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-white overflow-hidden shadow-sm scroll-mt-4",
        borderAccentClass,
        className,
      )}
    >
      {title ? (
        <div className="border-b border-border bg-muted/35 px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
      ) : null}
      <div className={cn("px-5 py-4", contentClassName)}>{children}</div>
    </section>
  );
}

export function PickCliente({
  clientes,
  value,
  onChange,
  onClear,
  onNuevoCliente,
  loading = false,
  placeholder,
}: {
  clientes: ClientePresupuesto[];
  value: string | null;
  onChange: (c: ClientePresupuesto) => void;
  /** Se llama al vaciar o editar el texto lejos del cliente seleccionado. */
  onClear?: () => void;
  onNuevoCliente: (textoBuscado: string) => void;
  loading?: boolean;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const prevValueRef = useRef<string | null>(value);
  const editingRef = useRef(false);

  const selected = useMemo(
    () => (value ? clientes.find((c) => c.id === value) : undefined),
    [clientes, value],
  );

  const query = search.trim();
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return clientes.slice(0, 25);
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.contacto.toLowerCase().includes(q) ||
        c.tel.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [clientes, query]);

  // Solo resincronizar el input cuando cambia la selección desde afuera,
  // nunca mientras el usuario está escribiendo.
  useEffect(() => {
    if (editingRef.current) {
      prevValueRef.current = value;
      return;
    }
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    setSearch(selected?.nombre ?? "");
  }, [value, selected?.nombre]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
        editingRef.current = false;
        setSearch(selected?.nombre ?? "");
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [selected?.nombre]);

  const handleAbrirAlta = () => {
    onNuevoCliente(query);
    setShowSuggestions(false);
  };

  const panelOpen = showSuggestions && !loading;

  return (
    <div ref={rootRef} className="relative w-full">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? listboxId : undefined}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-label="Buscar cliente o profesional"
        placeholder={
          loading ? "Cargando clientes…" : placeholder ?? "Nombre o firma…"
        }
        disabled={loading}
        value={search}
        onChange={(e) => {
          const next = e.target.value;
          editingRef.current = true;
          setSearch(next);
          setShowSuggestions(true);
          // Si había un cliente elegido y el texto ya no coincide, soltar la selección.
          if (value && selected && next.trim() !== selected.nombre) {
            onClear?.();
          }
          if (!next.trim()) {
            onClear?.();
          }
        }}
        onFocus={() => {
          setShowSuggestions(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setShowSuggestions(false);
            editingRef.current = false;
            setSearch(selected?.nombre ?? "");
            e.preventDefault();
          }
        }}
        className="pl-8"
      />

      {panelOpen ? (
        <div
          id={listboxId}
          role="listbox"
          className={cn(menuPanelClass, "absolute left-0 right-0 top-[calc(100%+4px)] max-h-[min(18rem,50vh)] overflow-auto")}
        >
          {filtered.length > 0 ? (
            <ul className="p-0 m-0 list-none">
              {filtered.map((c) => (
                <li key={c.id} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === c.id}
                    className={cn(
                      menuItemClass,
                      "items-start",
                      value === c.id ? menuItemActiveClass : menuItemIdleClass,
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editingRef.current = false;
                      onChange(c);
                      setSearch(c.nombre);
                      setShowSuggestions(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-col gap-0">
                      <span className="truncate font-medium">{c.nombre}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[c.contacto !== c.nombre ? c.contacto : null, c.tel]
                          .filter(Boolean)
                          .join(" · ") || "Sin contacto"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3 px-3 py-3">
              <p className="text-sm text-muted-foreground">
                {clientes.length === 0
                  ? "Todavía no hay clientes guardados."
                  : `No hay ningún cliente que coincida${query ? ` con «${query}»` : ""}.`}
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAbrirAlta}
              >
                <Plus className="h-4 w-4 shrink-0" />
                Agregar nuevo cliente
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PickMaterial({
  materials,
  value,
  onChange,
  disabled,
  loading,
  triggerClassName,
  ariaLabel,
  placeholder = "Elegir material…",
}: {
  materials: { id: string; name: string; unit: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  triggerClassName?: string;
  /** Accesibilidad cuando no hay etiqueta visible */
  ariaLabel?: string;
  placeholder?: string;
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
          aria-label={ariaLabel}
          disabled={disabled || loading}
          className={cn(
            "h-9 w-full justify-between px-3 text-sm font-normal",
            triggerClassName,
          )}
        >
          <span className={cn("truncate", !selected && !loading && "text-muted-foreground")}>
            {loading
              ? "Cargando materiales…"
              : selected
                ? `${selected.name}${selected.unit ? ` (${selected.unit})` : ""}`
                : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar material…" />
          <CommandList>
            <CommandEmpty>
              {materials.length
                ? "Sin coincidencias."
                : "Sin materiales. Cargalos en Stock → Materiales."}
            </CommandEmpty>
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
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === m.id ? "opacity-100" : "opacity-0",
                    )}
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

function textoBusqueda(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function formatPrecioMaterial(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type SeleccionMaterialOt = {
  materialId: string;
  materialLibre: string;
  chapaSugeridaId: string | null;
  chapaSugeridaBulto: string;
  chapaSugeridaLabel: string;
};

export function etiquetaPlanchaBuscador(p: {
  familia: string | null;
  materialLabel: string;
  largoCm: number;
  anchoCm: number;
}): string {
  const fam = (p.familia ?? "").trim();
  const name = p.materialLabel.trim();
  const titulo =
    fam && fam.toLowerCase() !== name.toLowerCase() ? `${fam} · ${name}` : name;
  return `${titulo} · ${p.largoCm}×${p.anchoCm} cm`;
}

function etiquetaEspesorPlancha(p: PlanchaBuscadorRow): string | null {
  if (p.espesorCm != null && p.espesorCm > 0) {
    const n = Number.isInteger(p.espesorCm) ? String(p.espesorCm) : String(p.espesorCm);
    return `${n} cm`;
  }
  if (p.espesorMm != null && p.espesorMm > 0) return `${p.espesorMm} mm`;
  return null;
}

function seleccionDePlancha(p: PlanchaBuscadorRow): SeleccionMaterialOt {
  return {
    materialId: p.materialId ?? "",
    materialLibre: p.materialId ? "" : p.materialLabel,
    chapaSugeridaId: p.id,
    chapaSugeridaBulto: p.bulto,
    chapaSugeridaLabel: etiquetaPlanchaBuscador(p),
  };
}

function seleccionTextoLibre(texto: string): SeleccionMaterialOt {
  return {
    materialId: "",
    materialLibre: texto,
    chapaSugeridaId: null,
    chapaSugeridaBulto: "",
    chapaSugeridaLabel: "",
  };
}

/** Lista planchas Disponibles de Stock y permite un material escrito a mano. */
export function BuscadorMaterial({
  materials,
  planchas = [],
  value,
  chapaSugeridaId = null,
  textoLibre = "",
  onChange,
  moneda = "ars",
  loading,
  soloTextoLibre = false,
}: {
  materials: MaterialWizardRowLite[];
  planchas?: PlanchaBuscadorRow[];
  value: string;
  chapaSugeridaId?: string | null;
  textoLibre?: string;
  onChange: (next: SeleccionMaterialOt) => void;
  moneda?: "ars" | "usd";
  loading?: boolean;
  /** La piedra la trae el cliente: se anota el nombre, sin catálogo ni precio de plancha. */
  soloTextoLibre?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedPlancha = planchas.find((p) => p.id === chapaSugeridaId);
  const selectedMaterial = materials.find((m) => m.id === value);
  const etiqueta = selectedPlancha
    ? etiquetaPlanchaBuscador(selectedPlancha)
    : (selectedMaterial?.name ?? textoLibre);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(etiqueta);
  const [editado, setEditado] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 420 });
  const queryRef = useRef(query);
  const editadoRef = useRef(editado);
  queryRef.current = query;
  editadoRef.current = editado;

  useEffect(() => {
    if (!open) setQuery(etiqueta);
  }, [etiqueta, open]);

  const filtrados = useMemo(() => {
    const q = textoBusqueda(query);
    if (!q) return planchas;
    return planchas.filter((p) => {
      const blob = textoBusqueda(
        `${p.familia ?? ""} ${p.materialLabel} ${p.bulto} ${p.proveedor ?? ""} ${p.largoCm} ${p.anchoCm}`,
      );
      return blob.includes(q);
    });
  }, [planchas, query]);

  const qTrim = query.trim();
  const coincideExacto = planchas.some((p) => {
    const q = textoBusqueda(qTrim);
    return (
      textoBusqueda(etiquetaPlanchaBuscador(p)) === q ||
      textoBusqueda(p.materialLabel) === q
    );
  });
  const ofreceLibre = qTrim.length > 0 && !coincideExacto;
  const totalOpciones = filtrados.length + (ofreceLibre ? 1 : 0);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  function aplicarTexto(texto: string) {
    const q = texto.trim();
    const exactEtiqueta = planchas.find(
      (p) => textoBusqueda(etiquetaPlanchaBuscador(p)) === textoBusqueda(q),
    );
    if (exactEtiqueta) {
      onChange(seleccionDePlancha(exactEtiqueta));
      return;
    }
    const exactName = planchas.filter(
      (p) => textoBusqueda(p.materialLabel) === textoBusqueda(q),
    );
    if (exactName.length === 1 && exactName[0]) {
      onChange(seleccionDePlancha(exactName[0]));
      return;
    }
    onChange(seleccionTextoLibre(q));
  }

  function elegirPlancha(p: PlanchaBuscadorRow) {
    onChange(seleccionDePlancha(p));
    setEditado(false);
    setOpen(false);
  }

  function elegirLibre() {
    aplicarTexto(queryRef.current);
    setEditado(false);
    setOpen(false);
  }

  function colocarLista() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 420), window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPos({ top: rect.bottom + 4, left, width });
  }

  useEffect(() => {
    if (!open) return;
    colocarLista();
    const cerrarAfuera = (event: MouseEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target) || listRef.current?.contains(target)) return;
      if (editadoRef.current) aplicarTexto(queryRef.current);
      setEditado(false);
      setOpen(false);
    };
    const mover = () => colocarLista();
    document.addEventListener("mousedown", cerrarAfuera);
    window.addEventListener("resize", mover);
    window.addEventListener("scroll", mover, true);
    return () => {
      document.removeEventListener("mousedown", cerrarAfuera);
      window.removeEventListener("resize", mover);
      window.removeEventListener("scroll", mover, true);
    };
  }, [open, planchas]);

  function elegirIndice(index: number) {
    if (index < filtrados.length) {
      const item = filtrados[index];
      if (item) elegirPlancha(item);
      return;
    }
    if (ofreceLibre) elegirLibre();
  }

  const prefijo = moneda === "usd" ? "US$" : "$";

  if (soloTextoLibre) {
    return (
      <input
        type="text"
        aria-label="Piedra que trae el cliente"
        placeholder="Piedra que trae el cliente"
        className="h-8 w-72 rounded-md border border-white/20 bg-white px-2.5 text-xs text-zinc-900 shadow-none outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-white/70"
        value={textoLibre}
        onChange={(e) => onChange(seleccionTextoLibre(e.target.value))}
      />
    );
  }

  return (
    <div className="shrink-0">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Buscar plancha"
        disabled={loading}
        placeholder={loading ? "Cargando planchas…" : "Buscar plancha o texto libre..."}
        className="h-8 w-72 rounded-md border border-white/20 bg-white px-2.5 text-xs text-zinc-900 shadow-none outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
        value={open ? query : etiqueta}
        onMouseDown={() => {
          if (!open) {
            setQuery("");
            setEditado(false);
            setOpen(true);
          }
        }}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setEditado(true);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (totalOpciones === 0 ? 0 : (i + 1) % totalOpciones));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              totalOpciones === 0 ? 0 : (i - 1 + totalOpciones) % totalOpciones,
            );
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && totalOpciones > 0) elegirIndice(active);
            else if (editado) elegirLibre();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditado(false);
            setOpen(false);
          }
        }}
      />
      {open
        ? createPortal(
            <div
              className={menuPanelClass}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            >
        <ul ref={listRef} id={listId} role="listbox" className="max-h-80 overflow-y-auto">
          {filtrados.length === 0 && !ofreceLibre ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {planchas.length === 0
                ? "Sin planchas disponibles en Stock."
                : "Sin coincidencias."}
            </li>
          ) : null}
          {filtrados.map((p, index) => {
            const activo = index === active;
            const espesor = etiquetaEspesorPlancha(p);
            const titulo =
              p.familia &&
              p.familia.trim().toLowerCase() !== p.materialLabel.trim().toLowerCase()
                ? `${p.familia} · ${p.materialLabel}`
                : p.materialLabel;
            return (
              <li key={p.id} role="option" aria-selected={chapaSugeridaId === p.id}>
                <button
                  type="button"
                  className={cn(
                    menuItemClass,
                    "items-start gap-3 py-2",
                    activo ? menuItemActiveClass : menuItemIdleClass,
                  )}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    elegirPlancha(p);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{titulo}</span>
                      {espesor ? (
                        <span className="shrink-0 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
                          {espesor}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground tabular-nums">
                      {p.bulto} · {p.largoCm}×{p.anchoCm} cm
                    </span>
                  </span>
                  <span className="shrink-0 text-right leading-tight">
                    {p.precioM2 != null ? (
                      <>
                        <span className="block text-sm font-semibold tabular-nums">
                          {prefijo}
                          {formatPrecioMaterial(p.precioM2)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">/ m²</span>
                      </>
                    ) : (
                      <span className="block text-[11px] text-muted-foreground">s/precio</span>
                    )}
                    {p.proveedor ? (
                      <span className="mt-0.5 block max-w-[9rem] truncate text-[10px] text-muted-foreground">
                        {p.proveedor}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          {ofreceLibre ? (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                className={cn(
                  menuItemClass,
                  active === filtrados.length
                    ? menuItemActiveClass
                    : "text-muted-foreground hover:bg-muted",
                )}
                onMouseEnter={() => setActive(filtrados.length)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  elegirLibre();
                }}
              >
                Usar «{qTrim}» como texto libre
              </button>
            </li>
          ) : null}
        </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

type MaterialWizardRowLite = {
  id: string;
  name: string;
  unit: string;
  codigo?: string | null;
  familia?: string | null;
  espesor_mm?: number | null;
};

export type ChapaPickOption = {
  id: string;
  bulto: string;
  material_label: string;
  largo_cm: number;
  ancho_cm: number;
  lote_codigo?: string | null;
};

/** Señala una chapa Disponible sin reservarla (la reserva ocurre al señar). */
export function PickChapaSugerida({
  chapas,
  valueId,
  onChange,
  loading,
  disabled,
  materialNombre,
}: {
  chapas: ChapaPickOption[];
  valueId: string | null;
  onChange: (chapa: ChapaPickOption | null) => void;
  loading?: boolean;
  disabled?: boolean;
  materialNombre?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = chapas.find((c) => c.id === valueId);
  const m2 = (l: number, a: number) => ((l / 100) * (a / 100)).toFixed(2);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading || !materialNombre}
          className="h-9 w-full justify-between px-3 text-sm font-normal"
        >
          <span className="truncate">
            {loading
              ? "Cargando chapas…"
              : !materialNombre
                ? "Elegí material primero…"
                : selected
                  ? `${selected.bulto} · ${selected.largo_cm}×${selected.ancho_cm} cm (${m2(selected.largo_cm, selected.ancho_cm)} m²)`
                  : chapas.length === 0
                    ? "Sin chapas disponibles"
                    : "Señalar chapa"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar bulto o lote…" />
          <CommandList>
            <CommandEmpty>
              {chapas.length === 0
                ? "No hay chapas Disponibles de este material."
                : "Sin coincidencias."}
            </CommandEmpty>
            <CommandGroup>
              {valueId ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Quitar chapa señalada
                </CommandItem>
              ) : null}
              {chapas.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.bulto} ${c.lote_codigo ?? ""} ${c.material_label}`}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      valueId === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex flex-col gap-0">
                    <span className="font-medium">
                      {c.bulto} · {c.largo_cm}×{c.ancho_cm} cm
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {m2(c.largo_cm, c.ancho_cm)} m²
                      {c.lote_codigo ? ` · lote ${c.lote_codigo}` : ""}
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

export function PickArticulo({
  value,
  onChange,
  compact,
  articulos,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
  /** Lista dinámica de artículos (del hook useArticulos). */
  articulos: ArticuloConPrecio[];
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = articulos.find((a) => a.id === value);
  const etiqueta = selected?.descripcion ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 288 });

  const filtrados = useMemo(() => {
    const q = textoBusqueda(query);
    if (!q) return articulos;
    return articulos.filter((a) =>
      textoBusqueda(`${a.descripcion} ${a.codigo}`).includes(q),
    );
  }, [articulos, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  function colocarLista() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPos({ top: rect.bottom + 4, left, width });
  }

  useEffect(() => {
    if (!open) return;
    colocarLista();
    const cerrarAfuera = (event: MouseEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const mover = () => colocarLista();
    document.addEventListener("mousedown", cerrarAfuera);
    window.addEventListener("resize", mover);
    window.addEventListener("scroll", mover, true);
    return () => {
      document.removeEventListener("mousedown", cerrarAfuera);
      window.removeEventListener("resize", mover);
      window.removeEventListener("scroll", mover, true);
    };
  }, [open]);

  function elegir(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className={cn("min-w-0", compact ? "w-72" : "w-full min-w-72")}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Buscar sub-ítem"
        placeholder="Buscar sub-ítem…"
        className={cn(
          "w-full rounded-md border border-border/90 bg-background px-2 text-xs text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/15",
          compact ? "h-8" : "h-9",
        )}
        value={open ? query : etiqueta}
        onMouseDown={() => {
          if (!open) {
            setQuery("");
            setOpen(true);
          }
        }}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (filtrados.length === 0 ? 0 : (i + 1) % filtrados.length));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              filtrados.length === 0 ? 0 : (i - 1 + filtrados.length) % filtrados.length,
            );
          } else if (e.key === "Enter") {
            e.preventDefault();
            const item = filtrados[active];
            if (open && item) elegir(item.id);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      {open
        ? createPortal(
            <div
              className={menuPanelClass}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            >
              <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto">
                {filtrados.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {articulos.length === 0 ? "Cargando sub-ítems…" : "Sin coincidencias."}
                  </li>
                ) : (
                  filtrados.map((a, index) => {
                    const activo = index === active;
                    return (
                      <li key={a.id} role="option" aria-selected={value === a.id}>
                        <button
                          type="button"
                          className={cn(
                            menuItemClass,
                            activo ? menuItemActiveClass : menuItemIdleClass,
                          )}
                          onMouseEnter={() => setActive(index)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            elegir(a.id);
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              value === a.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">{a.descripcion}</span>
                            <span className="text-[10px] text-muted-foreground">
                              tipo · {labelTipoUnidad(a.unidad)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
