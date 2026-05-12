"use client";

import { useEffect, useState } from "react";
import { fetchMaterialConversionsByParent, type ConversionRowUi } from "@/lib/cantera-stock-api";
import { isSupabaseConfigured } from "@/lib/supabase";

type ConversionesMaestroHintsProps = {
  parentMaterialId: string | undefined;
};

export function ConversionesMaestroHints({ parentMaterialId }: ConversionesMaestroHintsProps) {
  const [rows, setRows] = useState<ConversionRowUi[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parentMaterialId || !isSupabaseConfigured) {
      setRows([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    void fetchMaterialConversionsByParent(parentMaterialId)
      .then((r) => {
        if (!cancel) setRows(r);
      })
      .catch(() => {
        if (!cancel) setRows([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [parentMaterialId]);

  if (!parentMaterialId) return null;
  if (!isSupabaseConfigured) return null;
  if (loading) {
    return (
      <p className="text-[11px] text-muted-foreground border border-dashed border-border rounded-md px-2 py-1.5">
        Cargando referencias de proceso…
      </p>
    );
  }
  if (!rows.length) return null;

  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-[11px] leading-snug space-y-1">
      <p className="font-semibold text-foreground">Conversiones (maestro)</p>
      <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
        {rows.map((r) => (
          <li key={r.id}>
            <span className="text-foreground font-medium">
              {r.child_name ?? r.child_material_id.slice(0, 8)}
            </span>
            : {r.kg_parent_per_m2_child.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg de
            materia prima / m² de producto
            {r.notes ? ` · ${r.notes}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
