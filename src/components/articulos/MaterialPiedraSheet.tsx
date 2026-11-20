"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchPreciosDeMaterial,
  upsertPrecioListaMaterial,
  type PrecioMaterialEnLista,
} from "@/lib/articulos-api";
import {
  fetchMaterialById,
  fetchStockResumenMaterial,
  updateMaterial,
  type StockResumenMaterial,
} from "@/lib/materials-api";
import { parseDecimalInput } from "@/lib/presupuesto-calculos";
import type { MaterialKindDb } from "@/types/database";
import type { MaterialWizardRow } from "@/types/material-catalog";

const KIND_LABEL: Record<MaterialKindDb, string> = {
  marmol: "Mármol",
  otra_piedra: "Otra piedra",
  agglomerado_otro: "Aglomerado / otro",
};

const ESTADO_ORDEN = ["Disponible", "Reservada", "Prevista", "Bloqueada", "Usada", "Baja"];

function fmtM2(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Seccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

type Props = {
  materialId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al guardar precios para que la tabla de la lista se actualice. */
  onPreciosChanged: () => void;
};

type DraftDatos = {
  codigo: string;
  familia: string;
  espesor: string;
  peso: string;
  kind: MaterialKindDb;
  uso: "piedra" | "producto";
};

function draftDesde(m: MaterialWizardRow): DraftDatos {
  return {
    codigo: m.codigo ?? "",
    familia: m.familia ?? "",
    espesor: m.espesor_mm != null ? String(m.espesor_mm) : "",
    peso: m.peso_por_m2_kg != null ? String(m.peso_por_m2_kg) : "",
    kind: m.material_kind,
    uso: m.uso === "producto" ? "producto" : "piedra",
  };
}

function numeroOpcional(raw: string): number | null | "invalido" {
  const t = raw.trim();
  if (t === "") return null;
  const n = parseDecimalInput(t);
  return Number.isFinite(n) && n >= 0 && /\d/.test(t) ? n : "invalido";
}

export function MaterialPiedraSheet({ materialId, open, onOpenChange, onPreciosChanged }: Props) {
  const navigate = useNavigate();
  const [material, setMaterial] = useState<MaterialWizardRow | null>(null);
  const [precios, setPrecios] = useState<PrecioMaterialEnLista[]>([]);
  const [draftPrecios, setDraftPrecios] = useState<Record<string, string>>({});
  const [stock, setStock] = useState<StockResumenMaterial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardandoPrecios, setGuardandoPrecios] = useState(false);

  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<DraftDatos | null>(null);
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  const cargarPrecios = useCallback(async (id: string) => {
    const res = await fetchPreciosDeMaterial(id);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    const rows = res.data ?? [];
    setPrecios(rows);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.lista.id] = r.precio != null ? String(r.precio) : "";
    setDraftPrecios(map);
  }, []);

  useEffect(() => {
    if (!open || !materialId) return;
    let vivo = true;
    setCargando(true);
    setEditando(false);
    void (async () => {
      const [m, , s] = await Promise.all([
        fetchMaterialById(materialId),
        cargarPrecios(materialId),
        fetchStockResumenMaterial(materialId),
      ]);
      if (!vivo) return;
      if (m.error) toast.error(m.error.message);
      if (s.error) toast.error(s.error.message);
      setMaterial(m.data);
      setStock(s.data);
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [open, materialId, cargarPrecios]);

  const hayCambiosPrecios = precios.some(
    (p) => (draftPrecios[p.lista.id] ?? "") !== (p.precio != null ? String(p.precio) : ""),
  );

  const guardarPrecios = async () => {
    if (!materialId) return;
    const cambios = precios.filter(
      (p) => (draftPrecios[p.lista.id] ?? "") !== (p.precio != null ? String(p.precio) : ""),
    );
    const aGuardar: { listaId: string; precio: number | null }[] = [];
    for (const p of cambios) {
      const crudo = (draftPrecios[p.lista.id] ?? "").trim();
      const n = numeroOpcional(crudo);
      if (n === "invalido") {
        toast.error(`El precio de «${p.lista.label}» no es válido.`);
        return;
      }
      aGuardar.push({ listaId: p.lista.id, precio: n });
    }
    setGuardandoPrecios(true);
    for (const item of aGuardar) {
      const { error } = await upsertPrecioListaMaterial({
        lista_precio_id: item.listaId,
        material_id: materialId,
        precio: item.precio,
      });
      if (error) {
        setGuardandoPrecios(false);
        toast.error(error.message);
        return;
      }
    }
    await cargarPrecios(materialId);
    setGuardandoPrecios(false);
    toast.success("Precios guardados.");
    onPreciosChanged();
  };

  const empezarEdicion = () => {
    if (!material) return;
    setDraft(draftDesde(material));
    setEditando(true);
  };

  const guardarDatos = async () => {
    if (!materialId || !draft) return;
    const espesor = numeroOpcional(draft.espesor);
    const peso = numeroOpcional(draft.peso);
    if (espesor === "invalido" || peso === "invalido") {
      toast.error("Revisá el espesor y el peso: tienen que ser números.");
      return;
    }
    setGuardandoDatos(true);
    const { data, error } = await updateMaterial(materialId, {
      codigo: draft.codigo,
      familia: draft.familia,
      espesor_mm: espesor,
      peso_por_m2_kg: peso,
      material_kind: draft.kind,
      uso: draft.uso,
    });
    setGuardandoDatos(false);
    if (error || !data) {
      toast.error(error?.message ?? "No se pudieron guardar los datos.");
      return;
    }
    setMaterial(data);
    setEditando(false);
    toast.success("Datos guardados.");
    onPreciosChanged();
  };

  const stockOrdenado = [...stock].sort(
    (a, b) => ESTADO_ORDEN.indexOf(a.estado) - ESTADO_ORDEN.indexOf(b.estado),
  );
  const disponibles = stock.find((s) => s.estado === "Disponible");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg">{material?.name ?? "Piedra"}</SheetTitle>
              <SheetDescription>
                {material?.codigo ? `Código ${material.codigo} · ` : ""}
                {disponibles
                  ? `${disponibles.cantidad} ${disponibles.cantidad === 1 ? "plancha disponible" : "planchas disponibles"} · ${fmtM2(disponibles.m2)} m²`
                  : "Sin planchas disponibles"}
              </SheetDescription>
            </div>
            {material ? (
              <Badge variant="outline" className="shrink-0">
                {material.uso === "producto" ? "Producto" : "Piedra"}
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <Seccion
            titulo="Precio final por m²"
            accion={
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={!hayCambiosPrecios || guardandoPrecios}
                onClick={() => void guardarPrecios()}
              >
                {guardandoPrecios ? "Guardando…" : "Guardar precios"}
              </Button>
            }
          >
            {cargando ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : precios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay listas de precios.</p>
            ) : (
              <div className="space-y-2">
                {precios.map((p) => {
                  const dirty =
                    (draftPrecios[p.lista.id] ?? "") !== (p.precio != null ? String(p.precio) : "");
                  return (
                    <div key={p.lista.id} className="grid grid-cols-[1fr_8rem] items-center gap-3">
                      <Label className="text-sm font-normal">
                        {p.lista.label}
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {p.lista.moneda.toUpperCase()}
                          {p.lista.activa === false ? " · inactiva" : ""}
                        </span>
                      </Label>
                      <Input
                        className={`h-9 text-right tabular-nums ${dirty ? "border-amber-400" : ""}`}
                        inputMode="decimal"
                        placeholder="Sin precio"
                        value={draftPrecios[p.lista.id] ?? ""}
                        onChange={(e) =>
                          setDraftPrecios((prev) => ({ ...prev, [p.lista.id]: e.target.value }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Seccion>

          <Separator />

          <Seccion
            titulo="Datos de la piedra"
            accion={
              !editando && material ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={empezarEdicion}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar datos
                </Button>
              ) : null
            }
          >
            {!material ? (
              <p className="text-sm text-muted-foreground">{cargando ? "Cargando…" : "No se encontró la piedra."}</p>
            ) : editando && draft ? (
              <div className="space-y-3">
                <Dato label="Nombre" value={material.name} />
                <p className="text-[11px] text-muted-foreground">
                  El nombre no se edita acá porque está copiado en planchas, remitos y retazos.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Código</Label>
                    <Input
                      className="h-9"
                      value={draft.codigo}
                      onChange={(e) => setDraft({ ...draft, codigo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Familia</Label>
                    <Input
                      className="h-9"
                      value={draft.familia}
                      onChange={(e) => setDraft({ ...draft, familia: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Espesor (mm)</Label>
                    <Input
                      className="h-9"
                      inputMode="decimal"
                      value={draft.espesor}
                      onChange={(e) => setDraft({ ...draft, espesor: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso (kg/m²)</Label>
                    <Input
                      className="h-9"
                      inputMode="decimal"
                      value={draft.peso}
                      onChange={(e) => setDraft({ ...draft, peso: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={draft.kind}
                      onValueChange={(v) => setDraft({ ...draft, kind: v as MaterialKindDb })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(KIND_LABEL) as MaterialKindDb[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {KIND_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Se usa como</Label>
                    <Select
                      value={draft.uso}
                      onValueChange={(v) => setDraft({ ...draft, uso: v as "piedra" | "producto" })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piedra">Piedra (se elige al presupuestar)</SelectItem>
                        <SelectItem value="producto">Producto de cantera</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" disabled={guardandoDatos} onClick={() => void guardarDatos()}>
                    {guardandoDatos ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Dato label="Nombre" value={material.name} />
                <Dato label="Código" value={material.codigo ?? "—"} />
                <Dato label="Familia" value={material.familia ?? "—"} />
                <Dato label="Tipo" value={KIND_LABEL[material.material_kind] ?? material.material_kind} />
                <Dato label="Espesor" value={material.espesor_mm != null ? `${material.espesor_mm} mm` : "—"} />
                <Dato
                  label="Peso"
                  value={material.peso_por_m2_kg != null ? `${material.peso_por_m2_kg} kg/m²` : "—"}
                />
                <Dato
                  label="Se usa como"
                  value={material.uso === "producto" ? "Producto de cantera" : "Piedra"}
                />
              </div>
            )}
          </Seccion>

          <Separator />

          <Seccion
            titulo="Stock de planchas"
            accion={
              material ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => navigate(`/stock/material/${encodeURIComponent(material.name)}`)}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Ver planchas
                </Button>
              ) : null
            }
          >
            {cargando ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : stockOrdenado.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin planchas cargadas.</p>
            ) : (
              <ul className="space-y-2">
                {stockOrdenado.map((s) => (
                  <li
                    key={s.estado}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{s.estado}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.cantidad} {s.cantidad === 1 ? "plancha" : "planchas"} · {fmtM2(s.m2)} m²
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
