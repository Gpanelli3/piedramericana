import { useSyncExternalStore } from "react";

/**
 * Indica si hay un recorrido en curso. El menú lateral lo usa para quedarse
 * desplegado mientras se marcan sus módulos.
 */
let activa = false;
const oyentes = new Set<() => void>();

export function setGuiaActiva(v: boolean) {
  if (activa === v) return;
  activa = v;
  oyentes.forEach((fn) => fn());
}

export function useGuiaActiva(): boolean {
  return useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    () => activa,
    () => false,
  );
}
