"use client";

import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description?: string;
}

interface PresupuestoStepperProps {
  currentStep: number;
  steps: Step[];
}

export function PresupuestoStepper({
  currentStep,
  steps,
}: PresupuestoStepperProps) {
  return (
    <div className="w-full border-b border-border bg-background px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div
              key={index}
              className="flex flex-1 items-center gap-2 sm:gap-3"
            >
              {/* Círculo indicador */}
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 font-semibold text-sm transition-colors",
                  isActive
                    ? "border-blue-900 bg-blue-900 text-white"
                    : isCompleted
                      ? "border-blue-900 bg-blue-900/10 text-blue-900"
                      : "border-slate-300 bg-slate-100 text-slate-600",
                )}
              >
                {isCompleted ? "✓" : index + 1}
              </div>

              {/* Label (oculto en mobile, visible en sm+) */}
              <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide truncate transition-colors",
                    isActive
                      ? "text-blue-900"
                      : isCompleted
                        ? "text-blue-900/70"
                        : "text-slate-600",
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {step.description}
                  </p>
                )}
              </div>

              {/* Conector (línea entre pasos) */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "hidden sm:flex flex-1 h-0.5 transition-colors",
                    isCompleted ? "bg-blue-900/20" : "bg-slate-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
