"use client";

import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listRetazosDisponibles } from "@/lib/stock-ot-api";
import {
  formatCm,
  sugerirRetazosParaPiezas,
  type MatchRetazoPieza,
  type PiezaMedida,
} from "@/lib/rotura-reglas";

type Props = {
  materialId?: string | null;
  materialLabel?: string | null;
  piezas: PiezaMedida[];
};

export function AvisoRetazoPiezas({ materialId, materialLabel, piezas }: Props) {
  const [matches, setMatches] = useState<MatchRetazoPieza[]>([]);
  const piezaKey = piezas
    .filter((p) => p.largoCm > 0 && p.anchoCm > 0)
    .map((p) => `${p.label}:${p.largoCm}x${p.anchoCm}`)
    .join("|");

  useEffect(() => {
    const validas = piezas.filter((p) => p.largoCm > 0 && p.anchoCm > 0);
    if (!isSupabaseConfigured || validas.length === 0 || (!materialId && !materialLabel)) {
      setMatches([]);
      return;
    }
    let cancel = false;
    void listRetazosDisponibles({ materialId, materialLabel }).then((res) => {
      if (cancel) return;
      if (res.error) {
        setMatches([]);
        return;
      }
      setMatches(
        sugerirRetazosParaPiezas(
          validas,
          res.data.map((c) => ({
            id: c.id,
            bulto: c.bulto,
            largoCm: Number(c.largo_cm),
            anchoCm: Number(c.ancho_cm),
            materialLabel: c.material_label,
          })),
        ),
      );
    });
    return () => {
      cancel = true;
    };
    // piezaKey cubre cambios de medidas/etiquetas sin re-fetch por identidad de array.
  }, [materialId, materialLabel, piezaKey]);

  if (matches.length === 0) return null;

  return (
    <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
      <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">Hay un retazo que puede servir</p>
        {matches.map((m) => (
          <p key={`${m.retazo.id}-${m.pieza.label}`} className="text-[11px] leading-snug">
            <span className="font-mono">{m.retazo.bulto}</span>{" "}
            {formatCm(m.retazo.largoCm, m.retazo.anchoCm)} para {m.pieza.label}{" "}
            {formatCm(m.pieza.largoCm, m.pieza.anchoCm)}
          </p>
        ))}
      </div>
    </div>
  );
}
