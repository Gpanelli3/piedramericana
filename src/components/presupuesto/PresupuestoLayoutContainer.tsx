"use client";

import { ReactNode } from "react";
import { PresupuestoStepper } from "./PresupuestoStepper";
import { PresupuestoBottomBar } from "./PresupuestoBottomBar";

interface Step {
  label: string;
  description?: string;
}

interface ResumenData {
  materialLabel?: string;
  materialThumbnail?: string;
  desglose: {
    piedra: number;
    manoObra: number;
    flete: number;
  };
  totales: {
    usd: number;
    ars: number;
  };
}

interface PresupuestoLayoutContainerProps {
  currentStep: number;
  steps: Step[];
  children: ReactNode;
  onNextStep: () => void;
  onPrevStep: () => void;
  isLastStep: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onGeneratePDF?: () => void;
  resumenData: ResumenData;
}

export function PresupuestoLayoutContainer({
  currentStep,
  steps,
  children,
  onNextStep,
  onPrevStep,
  isLastStep,
  isSaving,
  onSave,
  onGeneratePDF,
  resumenData,
}: PresupuestoLayoutContainerProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Header Fijo: Stepper */}
      <PresupuestoStepper currentStep={currentStep} steps={steps} />

      {/* Contenido Central: Scroll Interno */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-none space-y-6 p-4 sm:p-6">
          {/* Transición suave entre pasos */}
          <div
            key={currentStep}
            className="transition-opacity duration-200 opacity-100"
          >
            {children}
          </div>
        </div>
      </div>

      {/* Bottom Bar Fijo */}
      <PresupuestoBottomBar
        resumenData={resumenData}
        onPrevStep={onPrevStep}
        onNextStep={onNextStep}
        isFirstStep={currentStep === 0}
        isLastStep={isLastStep}
        isSaving={isSaving}
        onSave={onSave}
        onGeneratePDF={onGeneratePDF}
      />
    </div>
  );
}
