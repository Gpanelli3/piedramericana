"use client";

import { cn } from "@/lib/utils";

const PASOS_LABEL = [
  { kicker: "CLIENTE", subtitle: "Datos de cliente" },
  { kicker: "ORDEN DE TRABAJO", subtitle: "Trabajos a realizar" },
  { kicker: "CONFIRMACIÓN", subtitle: "Revisar y guardar" },
] as const;

type PresupuestoStepperProps = {
  /** 0-indexed paso actual */
  step: number;
  className?: string;
};

export function PresupuestoStepper({ step, className }: PresupuestoStepperProps) {
  const safeStep = Math.min(Math.max(step, 0), PASOS_LABEL.length - 1);

  return (
    <>
      <p className={cn("text-center text-[11px] font-medium text-muted-foreground md:hidden mb-3", className)}>
        Paso {safeStep + 1} de {PASOS_LABEL.length} — {PASOS_LABEL[safeStep]!.subtitle}
      </p>
      <nav
        className={cn(
          "rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] px-3 py-4 sm:py-5",
          className,
        )}
        aria-label="Progreso del presupuesto"
      >
        <ol className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:gap-3">
          {PASOS_LABEL.map((p, idx) => {
            const estado = idx < safeStep ? "done" : idx === safeStep ? "current" : "todo";
            return (
              <li
                key={p.kicker}
                className="flex min-w-0 flex-1 gap-3 sm:flex-col sm:items-center sm:text-center"
              >
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:gap-1.5">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums transition-colors sm:h-10 sm:w-10 sm:text-sm",
                      estado === "current" &&
                        "border-accent bg-accent text-accent-foreground ring-4 ring-accent/20",
                      estado === "done" && "border-success-strong bg-success-strong text-white",
                      estado === "todo" && "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
                    )}
                    aria-current={estado === "current" ? "step" : undefined}
                  >
                    {idx + 1}
                  </span>
                  {idx < PASOS_LABEL.length - 1 ? (
                    <div
                      className="hidden h-px flex-1 bg-border sm:block sm:h-px sm:w-full sm:flex-none sm:self-stretch"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className="min-w-0 pb-1 sm:pb-0">
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide sm:text-[11px]",
                      estado === "current" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {p.kicker}
                  </p>
                  <p className="text-[11px] leading-tight text-foreground sm:text-xs">{p.subtitle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
