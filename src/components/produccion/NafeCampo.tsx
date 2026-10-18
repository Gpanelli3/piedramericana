"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { asegurarNafeOpcion, listNafeOpciones } from "@/lib/nafe-api";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPersistOpcion?: boolean;
  compact?: boolean;
};

export function NafeCampo({ id, value, onChange, onPersistOpcion = true, compact }: Props) {
  const [opciones, setOpciones] = useState<string[]>([]);
  const listId = id ? `${id}-list` : "nafe-opciones";

  useEffect(() => {
    let cancelled = false;
    void listNafeOpciones().then((res) => {
      if (cancelled || res.error) return;
      setOpciones(res.data.map((o) => o.etiqueta));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistir = (raw: string) => {
    const t = raw.trim();
    if (!t || !onPersistOpcion) return;
    if (!opciones.some((o) => o.toLowerCase() === t.toLowerCase())) {
      setOpciones((prev) => [...prev, t].sort((a, b) => a.localeCompare(b, "es")));
    }
    void asegurarNafeOpcion(t);
  };

  return (
    <div className="space-y-1">
      {compact ? null : (
        <Label htmlFor={id} className="text-xs font-medium">
          NAFE
        </Label>
      )}
      <Input
        id={id}
        list={listId}
        className={compact ? "h-8 text-xs" : "h-9"}
        placeholder="Lo que usan en el taller"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => persistir(value)}
      />
      <datalist id={listId}>
        {opciones.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
