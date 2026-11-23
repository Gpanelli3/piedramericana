"use client";

import { useState } from "react";
import { Handshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { RenegociarImporteDialog } from "@/components/medicion/RenegociarImporteDialog";
import { confirmarConformidadCliente, type MedicionColaItem } from "@/lib/medicion-api";
import { formatMoneyAr } from "@/lib/presupuesto-detalle";
import { enviarAProduccionSiCorresponde } from "@/lib/produccion-api";

/** True si al medir cambió el importe y el vendedor tiene que confirmarlo con el cliente. */
export function esperaConformidad(item: MedicionColaItem): boolean {
  return (
    item.medicion.estado === "medido" &&
    item.medicion.conformidad_pendiente &&
    item.presupuestoStatus === "aprobado"
  );
}

/**
 * Aviso dentro del detalle del presupuesto: el vendedor confirma con el cliente el nuevo importe
 * (o carga el que acuerden).
 */
export function ConformidadBanner({
  item,
  onCambio,
}: {
  item: MedicionColaItem;
  onCambio: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [renegociar, setRenegociar] = useState(false);

  const despues = async (okConforme: boolean) => {
    const envio = await enviarAProduccionSiCorresponde(item.presupuestoId);
    if (envio.error) toast.error(envio.error.message);
    else if (envio.enviado)
      toast.success(okConforme ? "Cliente conforme. Pasó a producción." : "Pasó a producción.");
    else if (okConforme) toast.success("Conformidad registrada.");
    onCambio();
  };

  const onClienteConforme = async () => {
    setBusy(true);
    const res = await confirmarConformidadCliente({
      presupuestoId: item.presupuestoId,
      usuarioId: user?.id ?? null,
    });
    if (res.error) {
      setBusy(false);
      toast.error(res.error.message);
      return;
    }
    await despues(true);
    setBusy(false);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
      <div className="flex items-start gap-2">
        <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">Confirmar el nuevo importe con el cliente</p>
          <p className="text-xs text-amber-900/80">
            Al medir cambió el importe. Si el cliente está de acuerdo, la OT pasa a producción.
          </p>
        </div>
      </div>
      <p className="text-sm tabular-nums text-muted-foreground">
        {item.medicion.conformidad_total_anterior != null
          ? formatMoneyAr(item.medicion.conformidad_total_anterior, item.moneda)
          : "—"}
        {" → "}
        <span className="text-base font-semibold text-foreground">
          {item.medicion.conformidad_total_nuevo != null
            ? formatMoneyAr(item.medicion.conformidad_total_nuevo, item.moneda)
            : "—"}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => setRenegociar(true)}>
          No conforme
        </Button>
        <Button type="button" disabled={busy} onClick={() => void onClienteConforme()}>
          {busy ? "…" : "Cliente conforme"}
        </Button>
      </div>

      <RenegociarImporteDialog
        item={renegociar ? item : null}
        open={renegociar}
        onOpenChange={setRenegociar}
        usuarioId={user?.id ?? null}
        onDone={() => void despues(false)}
      />
    </div>
  );
}
