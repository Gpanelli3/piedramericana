"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { geocodeObra, mapsUrlForCoords } from "@/lib/geocode-obra";
import {
  getPlanoSignedUrl,
  removePlano,
  uploadPlano,
} from "@/lib/presupuesto-planos-storage";
import type { OrdenTrabajoWizard } from "./types";
import { CheckCircle2, FileUp, Loader2, MapPin, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type OtUbicacionYPlanoProps = {
  ot: OrdenTrabajoWizard;
  patchOrden: (key: string, patch: Partial<OrdenTrabajoWizard>) => void;
  variant?: "ot" | "cabecera";
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function OtUbicacionYPlano({
  ot,
  patchOrden,
  variant = "ot",
}: OtUbicacionYPlanoProps) {
  const cabecera = variant === "cabecera";
  const [geocoding, setGeocoding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasCoords =
    ot.obraLat != null &&
    ot.obraLng != null &&
    Number.isFinite(ot.obraLat) &&
    Number.isFinite(ot.obraLng);

  const onDireccionChange = (value: string) => {
    patchOrden(ot.key, {
      direccionObra: value,
      obraLat: null,
      obraLng: null,
      obraFormattedAddress: "",
    });
  };

  const onBuscar = async () => {
    setGeocoding(true);
    try {
      const { data, error } = await geocodeObra(ot.direccionObra);
      if (error || !data) {
        toast.error(error?.message ?? "No se pudo ubicar la dirección.");
        return;
      }
      patchOrden(ot.key, {
        obraLat: data.lat,
        obraLng: data.lng,
        obraFormattedAddress: data.displayName,
        direccionObra: ot.direccionObra.trim() || data.displayName,
      });
    } finally {
      setGeocoding(false);
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      if (ot.planoAdjunto?.storagePath) {
        await removePlano(ot.planoAdjunto.storagePath);
      }
      const { data, error } = await uploadPlano({ otKey: ot.key, file });
      if (error || !data) {
        toast.error(error?.message ?? "No se pudo subir el archivo.");
        return;
      }
      patchOrden(ot.key, { planoAdjunto: data });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onRemovePlano = async () => {
    const path = ot.planoAdjunto?.storagePath;
    patchOrden(ot.key, { planoAdjunto: null });
    if (path) {
      const { error } = await removePlano(path);
      if (error) {
        toast.error(`No se pudo borrar el archivo del storage: ${error.message}`);
      }
    }
  };

  const onOpenPlano = async () => {
    if (!ot.planoAdjunto?.storagePath) return;
    const { url, error } = await getPlanoSignedUrl(ot.planoAdjunto.storagePath);
    if (error || !url) {
      toast.error(error?.message ?? "No se pudo abrir el archivo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={cn(
        "space-y-4",
        !cabecera &&
          "rounded-md border border-border/55 bg-background/90 p-3 shadow-sm sm:p-4 dark:bg-background/80",
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${ot.key}-direccion-obra`} className="text-xs font-medium">
          Dirección de obra{" "}
          {cabecera ? <span className="text-destructive">*</span> : null}
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Input
            id={`${ot.key}-direccion-obra`}
            className="h-9 flex-1 text-sm"
            value={ot.direccionObra}
            onChange={(e) => onDireccionChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onBuscar();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            disabled={geocoding || !ot.direccionObra.trim()}
            onClick={() => void onBuscar()}
          >
            {geocoding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
            Buscar
          </Button>
        </div>
        {hasCoords ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Dirección encontrada</span>
            <span className="tabular-nums text-muted-foreground">
              lat {ot.obraLat!.toFixed(4)} lng {ot.obraLng!.toFixed(4)}
            </span>
            <a
              href={mapsUrlForCoords(ot.obraLat!, ot.obraLng!)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
            >
              Ver mapa
            </a>
            {ot.obraFormattedAddress ? (
              <span className="w-full text-[11px] text-muted-foreground">
                {ot.obraFormattedAddress}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${ot.key}-referencia-obra`} className="text-xs font-medium">
          Referencia
        </Label>
        <Input
          id={`${ot.key}-referencia-obra`}
          className="h-9 text-sm"
          value={ot.referenciaObra}
          onChange={(e) => patchOrden(ot.key, { referenciaObra: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">¿Con qué cotizaste?</Label>
        {ot.planoAdjunto ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => void onOpenPlano()}
              title="Abrir archivo"
            >
              {ot.planoAdjunto.name}
            </button>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatBytes(ot.planoAdjunto.size)}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => void onRemovePlano()}
              aria-label="Quitar archivo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : cabecera ? (
          <label
            className={cn(
              "relative inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-amber-800 hover:underline",
              uploading && "pointer-events-none opacity-70",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading}
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            {uploading ? "Subiendo…" : "Agregar archivo"}
          </label>
        ) : (
          <label
            className={cn(
              "relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center transition-colors hover:bg-muted/25",
              uploading && "pointer-events-none opacity-70",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading}
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <FileUp className="h-5 w-5 text-muted-foreground" aria-hidden />
            )}
            <span className="text-sm text-muted-foreground">
              {uploading ? "Subiendo…" : "Agregar archivo"}
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
