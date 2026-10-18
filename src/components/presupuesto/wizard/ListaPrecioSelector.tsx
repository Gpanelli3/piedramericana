"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListaPrecioRow } from "@/types/articulos";

type ListaPrecioSelectorProps = {
  listasPrecios: ListaPrecioRow[];
  listaPrecioId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

export function ListaPrecioSelector({
  listasPrecios,
  listaPrecioId,
  onChange,
  disabled = false,
}: ListaPrecioSelectorProps) {
  return (
    <div className="space-y-1">
      <Label>Lista de precio</Label>
      <Select
        value={listaPrecioId}
        onValueChange={onChange}
        disabled={disabled || listasPrecios.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Seleccionar lista de precio" />
        </SelectTrigger>
        <SelectContent>
          {listasPrecios.map((lista) => (
            <SelectItem key={lista.id} value={lista.id}>
              {lista.label} · {lista.moneda.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
