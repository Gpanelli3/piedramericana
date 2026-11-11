export type RetornoOtDialogState = {
  otDialogReturn: string;
  reabrirOtId: string;
};

/** Dónde volver para reabrir la ficha de la OT que está en pantalla. */
export function stateIrADetalleOt(otId: string): RetornoOtDialogState {
  return {
    otDialogReturn: `${window.location.pathname}${window.location.search}`,
    reabrirOtId: otId,
  };
}

export function leerRetornoOt(state: unknown): Partial<RetornoOtDialogState> | null {
  if (!state || typeof state !== "object") return null;
  const s = state as Record<string, unknown>;
  const otDialogReturn = typeof s.otDialogReturn === "string" ? s.otDialogReturn : undefined;
  const reabrirOtId = typeof s.reabrirOtId === "string" ? s.reabrirOtId : undefined;
  if (!otDialogReturn && !reabrirOtId) return null;
  return { otDialogReturn, reabrirOtId };
}
