"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createArticulo,
  fetchArticulos,
  fetchListasPrecio,
  fetchPreciosDeArticulo,
  syncPreciosArticulo,
  updateArticulo,
  type ArticuloUpsertInput,
} from "@/lib/articulos-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ArticuloConPrecio, ListaPrecioRow } from "@/types/articulos";
import type { UnidadArticuloDb } from "@/types/database";

const UNIDADES: { value: UnidadArticuloDb; label: string }[] = [
  { value: "M2", label: "m²" },
  { value: "ML", label: "metro lineal" },
  { value: "UNI", label: "unidad" },
];

/** UI simplificada; se mapea a calcula_material / prefer_modo_manual / medida_estandar_m2. */
type TipoCalculo = "sin_material" | "dimensiones" | "m2_manual" | "medida_fija";

const TIPOS_CALCULO: {
  value: TipoCalculo;
  label: string;
  hint: string;
  unidades: UnidadArticuloDb[] | "todas";
}[] = [
  {
    value: "sin_material",
    label: "No calcula material",
    hint: "Bacha, grifería, etc. Solo cantidad × precio; no suma m².",
    unidades: "todas",
  },
  {
    value: "dimensiones",
    label: "Por dimensiones",
    hint: "Pide alto × ancho (m²) o alto (ml) en el presupuesto.",
    unidades: ["M2", "ML"],
  },
  {
    value: "m2_manual",
    label: "Por m² totales",
    hint: "En el presupuesto se cargan m² a mano, sin alto/ancho.",
    unidades: ["M2"],
  },
  {
    value: "medida_fija",
    label: "Medida fija por unidad",
    hint: "Cada unidad aporta un m² fijo (ej. 0,25).",
    unidades: "todas",
  },
];

function emptyDraft(): ArticuloUpsertInput {
  return {
    codigo: "",
    descripcion: "",
    unidad: "M2",
    calcula_material: true,
    medida_estandar_m2: null,
    prefer_modo_manual: false,
    sort_order: 0,
  };
}

function labelUnidad(u: UnidadArticuloDb): string {
  return UNIDADES.find((x) => x.value === u)?.label ?? u;
}

function draftToTipo(d: Pick<ArticuloUpsertInput, "calcula_material" | "medida_estandar_m2" | "prefer_modo_manual" | "unidad">): TipoCalculo {
  if (!d.calcula_material) return "sin_material";
  if (d.medida_estandar_m2 != null && d.medida_estandar_m2 > 0) return "medida_fija";
  if (d.prefer_modo_manual && d.unidad === "M2") return "m2_manual";
  return "dimensiones";
}

function labelTipoCalculo(art: ArticuloConPrecio): string {
  const tipo = draftToTipo(art);
  return TIPOS_CALCULO.find((t) => t.value === tipo)?.label ?? tipo;
}

function applyTipo(
  d: ArticuloUpsertInput,
  tipo: TipoCalculo,
): ArticuloUpsertInput {
  switch (tipo) {
    case "sin_material":
      return {
        ...d,
        calcula_material: false,
        medida_estandar_m2: null,
        prefer_modo_manual: false,
      };
    case "dimensiones":
      return {
        ...d,
        calcula_material: true,
        medida_estandar_m2: null,
        prefer_modo_manual: false,
        unidad: d.unidad === "UNI" ? "M2" : d.unidad,
      };
    case "m2_manual":
      return {
        ...d,
        calcula_material: true,
        medida_estandar_m2: null,
        prefer_modo_manual: true,
        unidad: "M2",
      };
    case "medida_fija":
      return {
        ...d,
        calcula_material: true,
        prefer_modo_manual: false,
        medida_estandar_m2: d.medida_estandar_m2,
      };
  }
}

function tiposDisponibles(unidad: UnidadArticuloDb) {
  return TIPOS_CALCULO.filter(
    (t) => t.unidades === "todas" || t.unidades.includes(unidad),
  );
}

export function ArticulosCatalogo() {
  const [articulos, setArticulos] = useState<ArticuloConPrecio[]>([]);
  const [listas, setListas] = useState<ListaPrecioRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [draft, setDraft] = useState<ArticuloUpsertInput>(emptyDraft);
  /** Precio por lista_precio_id (string del input). */
  const [preciosDraft, setPreciosDraft] = useState<Record<string, string>>({});

  const tipoActual = useMemo(() => draftToTipo(draft), [draft]);
  const tiposOk = useMemo(() => tiposDisponibles(draft.unidad), [draft.unidad]);
  const tipoSelect = useMemo(() => {
    if (tiposOk.some((t) => t.value === tipoActual)) return tipoActual;
    return tiposOk[0]?.value ?? "sin_material";
  }, [tipoActual, tiposOk]);

  const recargar = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setArticulos([]);
      setListas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const [artsRes, listasRes] = await Promise.all([
      fetchArticulos(),
      fetchListasPrecio(),
    ]);
    if (artsRes.error) {
      toast.error(artsRes.error.message);
      setArticulos([]);
    } else {
      setArticulos(artsRes.data ?? []);
    }
    if (listasRes.error) {
      toast.error(listasRes.error.message);
      setListas([]);
    } else {
      setListas(listasRes.data ?? []);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const initPreciosVacios = useCallback((listasActivas: ListaPrecioRow[]) => {
    const map: Record<string, string> = {};
    for (const l of listasActivas) map[l.id] = "";
    return map;
  }, []);

  const abrirNuevo = () => {
    setEditandoId(null);
    setDraft(emptyDraft());
    setPreciosDraft(initPreciosVacios(listas));
    setDialogAbierto(true);
  };

  const abrirEditar = async (art: ArticuloConPrecio) => {
    setEditandoId(art.id);
    let next: ArticuloUpsertInput = {
      codigo: art.codigo,
      descripcion: art.descripcion,
      unidad: art.unidad,
      calcula_material: art.calcula_material,
      medida_estandar_m2: art.medida_estandar_m2,
      prefer_modo_manual: art.prefer_modo_manual,
      sort_order: art.sort_order,
    };
    const tipo = draftToTipo(next);
    if (!tiposDisponibles(next.unidad).some((t) => t.value === tipo)) {
      next = applyTipo(
        next,
        next.unidad === "UNI" ? "sin_material" : "dimensiones",
      );
    }
    setDraft(next);
    const base = initPreciosVacios(listas);
    const { data, error } = await fetchPreciosDeArticulo(art.id);
    if (error) {
      toast.error(error.message);
      setPreciosDraft(base);
    } else {
      for (const p of data ?? []) {
        base[p.lista_precio_id] = String(p.precio);
      }
      setPreciosDraft(base);
    }
    setDialogAbierto(true);
  };

  const cerrarDialog = () => {
    setDialogAbierto(false);
    setEditandoId(null);
    setDraft(emptyDraft());
    setPreciosDraft({});
  };

  const setUnidad = (unidad: UnidadArticuloDb) => {
    setDraft((prev) => {
      let next = { ...prev, unidad };
      const tipo = draftToTipo(next);
      const ok = tiposDisponibles(unidad).some((t) => t.value === tipo);
      if (!ok) {
        // Unidad incompatible con el tipo actual → default sensato
        next = applyTipo(
          next,
          unidad === "UNI" ? "sin_material" : "dimensiones",
        );
      }
      if (tipo === "m2_manual" && unidad !== "M2") {
        next = applyTipo(next, "dimensiones");
      }
      return next;
    });
  };

  const setTipo = (tipo: TipoCalculo) => {
    setDraft((prev) => applyTipo(prev, tipo));
  };

  const handleGuardar = async () => {
    if (!draft.codigo.trim() || !draft.descripcion.trim()) {
      toast.error("Completá código y descripción.");
      return;
    }
    if (tipoSelect === "medida_fija") {
      const m = draft.medida_estandar_m2;
      if (m == null || !(m > 0) || !Number.isFinite(m)) {
        toast.error("Indicá la medida fija en m² (mayor a 0).");
        return;
      }
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase no está configurado.");
      return;
    }

    const payload: ArticuloUpsertInput = applyTipo(draft, tipoSelect);
    if (tipoSelect !== "medida_fija") {
      payload.medida_estandar_m2 = null;
    }

    setGuardando(true);
    try {
      let articuloId = editandoId;
      if (editandoId) {
        const { error } = await updateArticulo(editandoId, payload);
        if (error) {
          toast.error(error.message);
          return;
        }
      } else {
        const { data, error } = await createArticulo(payload);
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo crear el artículo.");
          return;
        }
        articuloId = data.id;
      }

      if (articuloId && Object.keys(preciosDraft).length > 0) {
        const { error: errPrecios } = await syncPreciosArticulo(
          articuloId,
          preciosDraft,
        );
        if (errPrecios) {
          toast.error(errPrecios.message);
          return;
        }
      }

      toast.success(editandoId ? "Artículo actualizado." : "Artículo creado.");
      cerrarDialog();
      await recargar();
    } finally {
      setGuardando(false);
    }
  };

  const hintTipo = TIPOS_CALCULO.find((t) => t.value === tipoSelect)?.hint;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <h2 className="sr-only">Catálogo de artículos</h2>
        <Button type="button" size="sm" className="gap-1.5" onClick={abrirNuevo}>
          <Plus className="h-4 w-4" />
          Nuevo artículo
        </Button>
      </div>

      {cargando ? (
        <div className="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Cargando artículos…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Cálculo</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {articulos.map((art) => (
                <TableRow key={art.id}>
                  <TableCell className="font-mono text-xs">{art.codigo}</TableCell>
                  <TableCell>{art.descripcion}</TableCell>
                  <TableCell>{labelUnidad(art.unidad)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {labelTipoCalculo(art)}
                    {art.calcula_material &&
                    art.medida_estandar_m2 != null &&
                    art.medida_estandar_m2 > 0
                      ? ` (${art.medida_estandar_m2} m²)`
                      : ""}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Editar"
                      onClick={() => abrirEditar(art)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogAbierto} onOpenChange={(o) => !o && cerrarDialog()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
            <DialogDescription>
              Definí el cálculo y los precios por lista (los usa el presupuesto).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Código</Label>
                <Input
                  className="h-9 text-sm"
                  value={draft.codigo}
                  onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidad</Label>
                <Select
                  value={draft.unidad}
                  onValueChange={(v) => setUnidad(v as UnidadArticuloDb)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input
                className="h-9 text-sm"
                value={draft.descripcion}
                onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de cálculo</Label>
              <Select value={tipoSelect} onValueChange={(v) => setTipo(v as TipoCalculo)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposOk.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hintTipo ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{hintTipo}</p>
              ) : null}
            </div>
            {tipoSelect === "medida_fija" ? (
              <div className="space-y-1">
                <Label className="text-xs">m² por cada unidad</Label>
                <Input
                  className="h-9 text-sm tabular-nums"
                  inputMode="decimal"
                  placeholder="Ej. 0,25"
                  value={
                    draft.medida_estandar_m2 != null ? String(draft.medida_estandar_m2) : ""
                  }
                  onChange={(e) => {
                    const t = e.target.value.trim().replace(",", ".");
                    setDraft((d) => ({
                      ...d,
                      calcula_material: true,
                      prefer_modo_manual: false,
                      medida_estandar_m2: t === "" ? null : Number.parseFloat(t),
                    }));
                  }}
                />
              </div>
            ) : null}

            <div className="space-y-2 rounded-md border border-border/70 px-3 py-3">
              <div>
                <Label className="text-xs">Precios por lista</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Vacío = sin precio en esa lista. Se usa al armar el presupuesto.
                </p>
              </div>
              {listas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay listas activas. Creá una en la pestaña Listas de precio.
                </p>
              ) : (
                <div className="grid gap-2">
                  {listas.map((l) => (
                    <div key={l.id} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                      <Label className="text-xs font-normal text-muted-foreground">
                        {l.label}{" "}
                        <span className="tabular-nums">({l.moneda.toUpperCase()})</span>
                      </Label>
                      <Input
                        className="h-8 text-sm tabular-nums"
                        inputMode="decimal"
                        placeholder="—"
                        value={preciosDraft[l.id] ?? ""}
                        onChange={(e) =>
                          setPreciosDraft((prev) => ({
                            ...prev,
                            [l.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleGuardar()} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
