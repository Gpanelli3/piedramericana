/** Día calendario `YYYY-MM-DD` de un ISO (`created_at` o fecha suelta). */
export function diaDeIso(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso.trim());
  return m ? m[1] : iso.slice(0, 10);
}

export function rangoFechasInvertido(desde: string, hasta: string): boolean {
  return Boolean(desde && hasta && desde > hasta);
}

/** Inclusivo sobre el día. Un extremo vacío no recorta. Rango invertido: ninguna fecha entra. */
export function fechaEnRango(iso: string, desde: string, hasta: string): boolean {
  if (rangoFechasInvertido(desde, hasta)) return false;
  const dia = diaDeIso(iso);
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}

/** `YYYY-MM-DD` → `dd/mm/aaaa` sin pasar por UTC. */
export function formatoDiaCalendario(iso: string): string {
  const dia = diaDeIso(iso);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return dia;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
