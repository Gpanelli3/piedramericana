import type { ReactNode } from "react";
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
import { Plus, Check, ChevronsUpDown, Search } from "lucide-react";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { ClientePresupuesto } from "@/lib/clients-api";
import { labelUnidad } from "@/lib/presupuesto-calculos";
import type { UnidadArticuloDb } from "@/types/database";
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
}: {
  clientes: ClientePresupuesto[];
  value: string | null;
  onChange: (c: ClientePresupuesto) => void;
  /** Se llama al vaciar o editar el texto lejos del cliente seleccionado. */
  onClear?: () => void;
  onNuevoCliente: (textoBuscado: string) => void;
  loading?: boolean;
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
        placeholder={loading ? "Cargando clientes…" : "Nombre o firma…"}
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
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-[min(18rem,50vh)] overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
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
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      value === c.id && "bg-accent text-accent-foreground",
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
                      <span
                        className={cn(
                          "truncate text-xs",
                          value === c.id ? "opacity-80" : "text-muted-foreground",
                        )}
                      >
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
              <p className="text-xs text-muted-foreground leading-snug">
                Podés dar de alta uno nuevo con el botón de abajo o el{" "}
                <span className="font-medium text-foreground">+</span> al costado.
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
}: {
  materials: { id: string; name: string; unit: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  triggerClassName?: string;
  /** Accesibilidad cuando no hay etiqueta visible */
  ariaLabel?: string;
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
          <span className="truncate">
            {loading
              ? "Cargando materiales…"
              : selected
                ? `${selected.name}${selected.unit ? ` (${selected.unit})` : ""}`
                : "Elegir material…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,26rem)] p-0" align="start">
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
                    : "Señalar chapa (opcional)…"}
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
  const [open, setOpen] = useState(false);
  const selected = articulos.find((a) => a.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between text-xs font-normal shadow-sm border-border/90 bg-background text-foreground hover:bg-muted/30 hover:text-foreground",
            compact ? "h-8 min-w-[8rem] px-2" : "h-9 min-w-[12rem] px-2.5",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {selected ? (
              <>
                <span className="truncate text-left">{selected.descripcion}</span>
                <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                  {labelTipoUnidad(selected.unidad)}
                </span>
              </>
            ) : (
              <span className="truncate text-left text-muted-foreground">Sub-ítem…</span>
            )}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar sub-ítem…" />
          <CommandList>
            <CommandEmpty>
              {articulos.length === 0
                ? "Cargando sub-ítems…"
                : "Sin coincidencias."}
            </CommandEmpty>
            <CommandGroup>
              {articulos.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.descripcion} ${a.codigo}`}
                  onSelect={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === a.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex flex-col gap-0">
                    <span className="font-medium">{a.descripcion}</span>
                    <span className="text-[10px] text-muted-foreground">
                      tipo · {labelTipoUnidad(a.unidad)}
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
