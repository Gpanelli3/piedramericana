"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ClientePresupuestoMock } from "@/data/presupuesto-clientes-mock";

interface PickClienteProps {
  clientes: ClientePresupuestoMock[];
  value: string | null;
  onChange: (c: ClientePresupuestoMock) => void;
  onNuevoCliente: (textoBuscado: string) => void;
}

export function PickCliente({
  clientes,
  value,
  onChange,
  onNuevoCliente,
}: PickClienteProps) {
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const query = search.trim();
  const filtered = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.contacto.toLowerCase().includes(q),
    );
  }, [clientes, query]);

  useEffect(() => {
    const sel = value ? clientes.find((c) => c.id === value) : undefined;
    setSearch(sel?.nombre ?? "");
  }, [value, clientes]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
        const sel = value ? clientes.find((c) => c.id === value) : undefined;
        setSearch(sel?.nombre ?? "");
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [value, clientes]);

  const handleAbrirAlta = () => {
    onNuevoCliente(query);
    setShowSuggestions(false);
  };

  const panelOpen = showSuggestions && query.length > 0;

  return (
    <div ref={rootRef} className="relative w-full">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? listboxId : undefined}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-label="Buscar cliente o profesional"
        placeholder="Nombre o firma…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (search.trim().length > 0) setShowSuggestions(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setShowSuggestions(false);
            const sel = value
              ? clientes.find((c) => c.id === value)
              : undefined;
            setSearch(sel?.nombre ?? "");
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
                No hay ningún cliente que coincida
                {query ? ` con «${query}»` : ""}.
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                Podés dar de alta uno nuevo con el botón de abajo o el{" "}
                <span className="font-medium text-foreground">+</span> al
                costado.
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
