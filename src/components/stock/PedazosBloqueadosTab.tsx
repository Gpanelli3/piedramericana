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
import { Plus, Scissors, Trash2 } from "lucide-react";
import {
  listChapasBloqueadas,
  listChapasDisponibles,
  materialSinChapasDisponibles,
  recortarPedazoBloqueado,
  type ChapaInventarioRow,
  type PedazoBloqueadoRow,
} from "@/lib/stock-ot-api";
import { bajaPedazoBloqueadoYReponer } from "@/lib/produccion-api";
import {
  etiquetaRoturaMomento,
  etiquetaRoturaTipo,
  formatCm,
  motivoRoturaVisible,
  validarRetazosEnPedazo,
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
  const [retazos, setRetazos] = useState<Array<{ largo: string; ancho: string }>>([
    { largo: "", ancho: "" },
  ]);
  const [reponer, setReponer] = useState<PedazoBloqueadoRow | null>(null);
  const [reemplazoId, setReemplazoId] = useState("");
  const [candidatas, setCandidatas] = useState<ChapaInventarioRow[]>([]);

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
    const medidas = retazos
      .filter((r) => r.largo.trim() || r.ancho.trim())
      .map((r) => ({
        largoCm: Number(String(r.largo).replace(",", ".")),
        anchoCm: Number(String(r.ancho).replace(",", ".")),
      }));
    const invalido = validarRetazosEnPedazo(
      medidas,
      Number(recortar.largo_cm),
      Number(recortar.ancho_cm),
    );
    if (invalido) {
      toast.error(invalido);
      return;
    }
    setBusyId(recortar.id);
    const res = await recortarPedazoBloqueado({
      chapaId: recortar.id,
      retazos: medidas,
      created_by: user?.id ?? null,
    });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    const bultos = res.retazoBultos ?? [];
    toast.success(
      bultos.length === 1
        ? `Retazo ${bultos[0]} disponible.`
        : `${bultos.length} retazos disponibles.`,
    );
    setRecortar(null);
    await reload();
    await reloadChapas();
  };

  const abrirReponer = async (row: PedazoBloqueadoRow) => {
    setReponer(row);
    setReemplazoId("");
    const needle = row.material_label?.trim();
    const res = await listChapasDisponibles(needle ? { materialNeedle: needle } : undefined);
    let pool = res.data;
    if (pool.length === 0 && needle) {
      const all = await listChapasDisponibles();
      pool = all.data;
    }
    if (res.error) toast.error(res.error.message);
    setCandidatas(pool.filter((c) => c.id !== row.id));
  };

  const onReponer = async () => {
    if (!reponer) return;
    if (!reemplazoId) {
      toast.error("Elegí la placa que reemplaza a la rota.");
      return;
    }
    setBusyId(reponer.id);
    const res = await bajaPedazoBloqueadoYReponer({
      chapaId: reponer.id,
      chapaNuevaId: reemplazoId,
      created_by: user?.id ?? null,
    });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("La placa nueva reemplazó a la rota. La orden sigue.");
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
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No hay pedazos bloqueados.
        </p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[24%]">Material</TableHead>
                <TableHead className="w-[16%]">Medidas</TableHead>
                <TableHead className="w-[14%]">Trabajo</TableHead>
                <TableHead className="w-[20%]">Rotura</TableHead>
                <TableHead className="w-[26%] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cliente = r.cliente_rotura?.trim() || "";
                const trabajo = r.ot_titulo?.trim() || "";
                const motivo = motivoRoturaVisible(r.motivo_estado);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="overflow-hidden whitespace-normal">
                      <p className="text-sm font-medium text-foreground">{r.material_label}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={r.bulto}>
                        {r.bulto}
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">
                      {formatCm(Number(r.largo_cm), Number(r.ancho_cm))}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {cliente ? <p>{cliente}</p> : null}
                      {trabajo ? (
                        <p className={cliente ? "text-xs text-muted-foreground" : undefined}>{trabajo}</p>
                      ) : null}
                      {!cliente && !trabajo ? <span className="text-muted-foreground">—</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {r.rotura_tipo === "pieza"
                            ? "Pieza"
                            : r.rotura_tipo === "chapa"
                              ? "Chapa"
                              : etiquetaRoturaTipo(r.rotura_tipo)}
                        </Badge>
                        {r.rotura_momento ? (
                          <Badge variant="outline" className="text-[10px]">
                            {etiquetaRoturaMomento(r.rotura_momento)}
                          </Badge>
                        ) : null}
                      </div>
                      {motivo ? (
                        <p className="mt-1 text-xs text-muted-foreground" title={motivo}>
                          {motivo}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-normal text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          disabled={busyId === r.id}
                          onClick={() => {
                            setRecortar(r);
                            setRetazos([{ largo: "", ancho: "" }]);
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
                          onClick={() => void abrirReponer(r)}
                        >
                          Baja y reponer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(recortar)} onOpenChange={(o) => !o && setRecortar(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Recortar pedazo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {retazos.map((r, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Largo cm</Label>
                  <Input
                    className="h-8 text-xs"
                    value={r.largo}
                    onChange={(e) =>
                      setRetazos((prev) =>
                        prev.map((row, j) => (j === i ? { ...row, largo: e.target.value } : row)),
                      )
                    }
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Ancho cm</Label>
                  <Input
                    className="h-8 text-xs"
                    value={r.ancho}
                    onChange={(e) =>
                      setRetazos((prev) =>
                        prev.map((row, j) => (j === i ? { ...row, ancho: e.target.value } : row)),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={retazos.length === 1}
                  onClick={() => setRetazos((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Quitar retazo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => setRetazos((prev) => [...prev, { largo: "", ancho: "" }])}
            >
              <Plus className="h-3 w-3" />
              Otro retazo
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecortar(null)}>
              Cancelar
            </Button>
            <Button disabled={Boolean(busyId)} onClick={() => void onRecortar()}>
              Dar de alta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reponer)} onOpenChange={(o) => !o && setReponer(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reemplazar mármol roto</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {candidatas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay placas disponibles para reemplazar.</p>
            ) : (
              candidatas.map((c) => {
                const checked = reemplazoId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                      checked ? "border-primary bg-muted/40" : "border-border"
                    }`}
                    onClick={() => setReemplazoId(c.id)}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono font-medium">{c.bulto}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.material_label} · {Number(c.largo_cm)}×{Number(c.ancho_cm)} cm
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReponer(null)}>
              Cancelar
            </Button>
            <Button disabled={Boolean(busyId) || !reemplazoId} onClick={() => void onReponer()}>
              Reemplazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
