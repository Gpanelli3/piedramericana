"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type EstadoPaso = "activo" | "hecho" | "pendiente";

type PasoWizardProps = {
  numero: number;
  titulo: string;
  /** Lo cargado en el paso; se muestra cuando está cerrado. */
  resumen?: string;
  estado: EstadoPaso;
  onAbrir: () => void;
  /** Si se pasa, aparece la flecha para avanzar al siguiente paso. */
  onSiguiente?: () => void;
  /** Tiene datos obligatorios sin completar (después de intentar confirmar). */
  conFaltantes?: boolean;
  /** El cuerpo ocupa todo el ancho (tablas anchas). */
  cuerpoAncho?: boolean;
  children: ReactNode;
};

export function PasoWizard({
  numero,
  titulo,
  resumen,
  estado,
  onAbrir,
  onSiguiente,
  cuerpoAncho = false,
  conFaltantes = false,
  children,
}: PasoWizardProps) {
  const ref = useRef<HTMLElement>(null);
  const activo = estado === "activo";
  const primerRender = useRef(true);

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    if (activo) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activo]);

  return (
    <section
      ref={ref}
      className={cn(
        "scroll-mt-4 rounded-2xl border border-border bg-card transition-shadow duration-300",
        activo ? "shadow-md" : "shadow-sm",
      )}
    >
      <button
        type="button"
        onClick={activo ? undefined : onAbrir}
        aria-expanded={activo}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5",
          activo ? "cursor-default" : "cursor-pointer rounded-2xl hover:bg-muted/40",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
            conFaltantes
              ? "bg-red-100 text-red-700"
              : [
                  activo && "bg-accent text-accent-foreground",
                  estado === "hecho" && "bg-emerald-100 text-emerald-800",
                  estado === "pendiente" && "bg-muted text-muted-foreground",
                ],
          )}
          aria-hidden
        >
          {estado === "hecho" && !conFaltantes ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            numero
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm font-semibold",
              estado === "pendiente" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {titulo}
          </span>
          {!activo && resumen ? (
            <span className="block truncate text-xs text-muted-foreground">{resumen}</span>
          ) : null}
        </span>
      </button>

      {activo ? (
        <div
          className={cn(
            "animate-in fade-in-0 slide-in-from-top-1 pb-4 duration-300 sm:pb-5",
            cuerpoAncho ? "px-4 sm:px-5" : "px-4 sm:pl-[3.75rem] sm:pr-5",
          )}
        >
          {children}
          {onSiguiente ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSiguiente}
                aria-label="Siguiente"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none"
              >
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
