"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRODUCTOS_CANTERA, RUBROS_CANTERA, type ProductoCantera } from "@/lib/cantera-productos";

const UNIDAD_LABEL: Record<string, string> = { "u.": "u.", m2: "m²", ml: "ml", kg: "kg" };

type Props = {
  value: string;
  onChange: (producto: ProductoCantera) => void;
};

/** Elige un producto del listado de la empresa (no se inventan nombres). */
export function ProductoCanteraPicker({ value, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);

  const porRubro = useMemo(
    () =>
      RUBROS_CANTERA.map((rubro) => ({
        rubro,
        items: PRODUCTOS_CANTERA.filter((p) => p.rubro === rubro),
      })).filter((g) => g.items.length > 0),
    [],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || "Elegir producto…"}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton>
          <DialogHeader className="px-4 pt-4 pr-12 pb-2">
            <DialogTitle>Elegir producto</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput autoFocus placeholder="Buscar por nombre o código… (ej. adoquin amarillo)" />
            <CommandList className="max-h-96">
              <CommandEmpty>Ningún producto coincide.</CommandEmpty>
              {porRubro.map((g) => (
                <CommandGroup key={g.rubro} heading={g.rubro}>
                  {g.items.map((p) => (
                    <CommandItem
                      key={p.codigo}
                      value={`${p.nombre} ${p.codigo} ${p.rubro}`}
                      onSelect={() => {
                        onChange(p);
                        setAbierto(false);
                      }}
                    >
                      <Check
                        className={cn("size-4", value === p.nombre ? "opacity-100" : "opacity-0")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {UNIDAD_LABEL[p.unidad] ?? p.unidad}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
