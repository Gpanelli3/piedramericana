"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { PickChapaSugerida, type ChapaPickOption } from "./fields";
import { listChapasDisponibles } from "@/lib/stock-ot-api";
import { isSupabaseConfigured } from "@/lib/supabase";

type Props = {
  materialNombre: string | undefined;
  valueId: string | null;
  onChange: (chapa: {
    id: string | null;
    bulto: string;
    label: string;
  }) => void;
};

export function PickChapaParaOt({ materialNombre, valueId, onChange }: Props) {
  const [chapas, setChapas] = useState<ChapaPickOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!materialNombre?.trim() || !isSupabaseConfigured) {
      setChapas([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    void listChapasDisponibles({ materialNeedle: materialNombre.trim() }).then((res) => {
      if (cancel) return;
      setLoading(false);
      if (res.error) {
        setChapas([]);
        return;
      }
      const needle = materialNombre.trim().toLowerCase();
      const rows = (res.data ?? [])
        .filter((c) => (c.material_label ?? "").toLowerCase().includes(needle))
        .map((c) => ({
          id: c.id,
          bulto: c.bulto,
          material_label: c.material_label,
          largo_cm: Number(c.largo_cm),
          ancho_cm: Number(c.ancho_cm),
          lote_codigo: c.lote_codigo,
        }));
      setChapas(rows);
      if (valueId && !rows.some((r) => r.id === valueId)) {
        onChange({ id: null, bulto: "", label: "" });
      }
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo re-fetch al cambiar material
  }, [materialNombre]);

  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs font-medium">Chapa señalada (opcional)</Label>
      <PickChapaSugerida
        chapas={chapas}
        valueId={valueId}
        loading={loading}
        materialNombre={materialNombre}
        onChange={(c) => {
          if (!c) {
            onChange({ id: null, bulto: "", label: "" });
            return;
          }
          onChange({
            id: c.id,
            bulto: c.bulto,
            label: c.material_label,
          });
        }}
      />
    </div>
  );
}
