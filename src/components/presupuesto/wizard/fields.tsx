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
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MODELOS_BACHA } from "./types";

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
        c.contacto.toLowerCase().includes(q),
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
        className={cn(
          "h-9 w-full border-cyan-600 bg-background pl-8 pr-2.5 text-sm shadow-sm md:text-sm",
          "text-foreground placeholder:text-muted-foreground",
          "focus-visible:border-cyan-600 focus-visible:ring-[3px] focus-visible:ring-cyan-500/40",
        )}
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
                      value === c.id &&
                        "bg-cyan-600 text-primary-foreground hover:bg-cyan-700 hover:text-primary-foreground",
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
                      <span className="truncate text-[10px] opacity-80">
                        {c.contacto}
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
                className="w-full gap-1.5 bg-sky-600 text-white hover:bg-sky-700"
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

export function PickTecnico({
  tecnicos,
  value,
  onChange,
  ariaLabel,
}: {
  tecnicos: { id: string; full_name: string | null }[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = tecnicos.find((t) => t.id === value);
  if (tecnicos.length === 0) {
    return (
      <Input
        readOnly
        disabled
        className="h-9 text-sm"
        placeholder="Sin técnicos (tabla usuarios)"
        aria-label={ariaLabel}
      />
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="h-9 w-full justify-between px-3 text-sm font-normal"
        >
          <span className="truncate">
            {selected
              ? selected.full_name?.trim() || selected.id.slice(0, 8)
              : "Elegir técnico…"}
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
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === t.id ? "opacity-100" : "opacity-0",
                    )}
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

export function PickBacha({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = MODELOS_BACHA.find((b) => b.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="h-9 w-full justify-between px-3 text-sm font-normal"
        >
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
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === b.value ? "opacity-100" : "opacity-0",
                    )}
                  />
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
            "w-full justify-between text-xs font-normal shadow-sm border-border/90 bg-background hover:bg-muted/30",
            compact ? "h-8 min-w-[8rem] px-2" : "h-9 min-w-[12rem] px-2.5",
          )}
        >
          <span
            className={cn(
              "truncate text-left",
              !selected && "text-muted-foreground",
            )}
          >
            {selected?.descripcion ?? "Seleccionar"}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar artículo…" />
          <CommandList>
            <CommandEmpty>
              {articulos.length === 0
                ? "Cargando artículos…"
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
                    <span>{a.descripcion}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {a.codigo} · {labelUnidad(a.unidad as "M2" | "ML" | "UNI")}
                      {!a.calcula_material
                        ? " · sin m²"
                        : a.medida_estandar_m2
                          ? ` · std ${a.medida_estandar_m2} m²`
                          : ""}
                      {a.precio != null
                        ? ` · $${a.precio}`
                        : ""}
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
