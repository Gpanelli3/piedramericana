"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Scissors } from "lucide-react";
import {
  listChapasBloqueadas,
  materialSinChapasDisponibles,
  recortarPedazoBloqueado,
  type PedazoBloqueadoRow,
} from "@/lib/stock-ot-api";
import { bajaPedazoBloqueadoYReponer } from "@/lib/produccion-api";
import {
  etiquetaRoturaMomento,
  etiquetaRoturaTipo,
  formatCm,
  piezaCabeEnRetazo,
} from "@/lib/rotura-reglas";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useStock } from "@/contexts/StockContext";

export function PedazosBloqueadosTab() {
  const { user } = useAuth();
  const { reloadChapas } = useStock();
  const [rows, setRows] = useState<PedazoBloqueadoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recortar, setRecortar] = useState<PedazoBloqueadoRow | null>(null);
  const [largo, setLargo] = useState("");
  const [ancho, setAncho] = useState("");
  const [reponer, setReponer] = useState<PedazoBloqueadoRow | null>(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      return;
    }
    setLoading(true);
    const res = await listChapasBloqueadas();
    setLoading(false);
    if (res.error) {
      toast.error(res.error.message);
      setRows([]);
      return;
    }
    setRows(res.data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onRecortar = async () => {
    if (!recortar) return;
    const largoCm = Number(String(largo).replace(",", "."));
    const anchoCm = Number(String(ancho).replace(",", "."));
    if (!(largoCm > 0) || !(anchoCm > 0)) {
      toast.error("Indicá largo y ancho del recorte (cm).");
      return;
    }
    if (
      !piezaCabeEnRetazo(largoCm, anchoCm, Number(recortar.largo_cm), Number(recortar.ancho_cm))
    ) {
      toast.error("Ese recorte no entra en las medidas del pedazo bloqueado.");
      return;
    }
    setBusyId(recortar.id);
    const res = await recortarPedazoBloqueado({
      chapaId: recortar.id,
      largoCm,
      anchoCm,
      created_by: user?.id ?? null,
    });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`Retazo ${res.retazoBulto} disponible.`);
    setRecortar(null);
    await reload();
    await reloadChapas();
  };

  const onReponer = async () => {
    if (!reponer) return;
    setBusyId(reponer.id);
    const res = await bajaPedazoBloqueadoYReponer({
      chapaId: reponer.id,
      created_by: user?.id ?? null,
    });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(
      res.otReposicionId
        ? "Pedazo dado de baja. Se creó la OT de reposición (sin cargo al cliente)."
        : "Pedazo dado de baja.",
    );
    const matId = res.materialId;
    const matLabel = res.materialLabel;
    setReponer(null);
    await reload();
    await reloadChapas();
    const agotado = await materialSinChapasDisponibles({
      materialId: matId,
      materialLabel: matLabel,
    });
    if (agotado.agotado) {
      toast.warning(`Se acabó ${agotado.label}: no queda stock disponible.`);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pedazos rotos, fuera de lo vendible, ligados al cliente y al trabajo. Recortá un retazo usable
        o dale de baja y reponé sin cobrar.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No hay pedazos bloqueados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedazo</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Medidas</TableHead>
                <TableHead>Cliente / trabajo</TableHead>
                <TableHead>Rotura</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.bulto}</TableCell>
                  <TableCell className="text-sm">{r.material_label}</TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {formatCm(Number(r.largo_cm), Number(r.ancho_cm))}
                  </TableCell>
                  <TableCell className="text-xs">
                    <p>{r.cliente_rotura?.trim() || "—"}</p>
                    <p className="text-muted-foreground">{r.ot_titulo ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {etiquetaRoturaTipo(r.rotura_tipo)}
                      </Badge>
                      {r.rotura_momento ? (
                        <Badge variant="outline" className="text-[10px]">
                          {etiquetaRoturaMomento(r.rotura_momento)}
                        </Badge>
                      ) : null}
                    </div>
                    {r.motivo_estado ? (
                      <p className="mt-1 max-w-[16rem] truncate text-muted-foreground" title={r.motivo_estado}>
                        {r.motivo_estado}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={busyId === r.id}
                        onClick={() => {
                          setRecortar(r);
                          setLargo(String(Number(r.largo_cm)));
                          setAncho(String(Number(r.ancho_cm)));
                        }}
                      >
                        <Scissors className="h-3 w-3" />
                        Recortar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={busyId === r.id}
                        onClick={() => setReponer(r)}
                      >
                        Baja y reponer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(recortar)} onOpenChange={(o) => !o && setRecortar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recortar pedazo</DialogTitle>
            <DialogDescription>
              Entra un retazo Disponible con esas medidas. El bloqueado sale de la lista.
              {recortar
                ? ` Pedazo ${recortar.bulto} · ${formatCm(Number(recortar.largo_cm), Number(recortar.ancho_cm))}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Largo cm</Label>
              <Input className="h-8 text-xs" value={largo} onChange={(e) => setLargo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ancho cm</Label>
              <Input className="h-8 text-xs" value={ancho} onChange={(e) => setAncho(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecortar(null)}>
              Cancelar
            </Button>
            <Button disabled={Boolean(busyId)} onClick={() => void onRecortar()}>
              Dar de alta retazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reponer)} onOpenChange={(o) => !o && setReponer(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dar de baja y reponer</DialogTitle>
            <DialogDescription>
              El pedazo pasa a Baja y se crea una OT de reposición ligada al trabajo, sin sumar precio
              al cliente.
              {reponer ? ` ${reponer.bulto}${reponer.ot_titulo ? ` · ${reponer.ot_titulo}` : ""}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReponer(null)}>
              Cancelar
            </Button>
            <Button disabled={Boolean(busyId)} onClick={() => void onReponer()}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
