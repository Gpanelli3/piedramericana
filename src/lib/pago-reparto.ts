import { roundMoney } from "@/lib/retencion-reglas";

export type MonedaPago = "ars" | "usd";

export type FormaPagoReparto = {
  metodo: string;
  moneda: MonedaPago;
  monto: number;
  cuentaId: string | null;
};

export type DeudaReparto = {
  presupuestoId: string;
  moneda: MonedaPago;
  saldo: number;
  asignado: number;
};

export type TramoPago = {
  presupuestoId: string;
  metodo: string;
  moneda: MonedaPago;
  monto: number;
  cuentaId: string | null;
};

export type ResultadoRepartoPago =
  | { ok: true; tramos: TramoPago[] }
  | { ok: false; error: string };

const CERO = 0.005;

function esPositivo(n: number): boolean {
  return Number.isFinite(n) && n > CERO;
}

export function totalPorMoneda(
  items: Array<{ moneda: MonedaPago; monto: number }>,
): { ars: number; usd: number } {
  let ars = 0;
  let usd = 0;
  for (const item of items) {
    const n = Number(item.monto);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (item.moneda === "usd") usd += n;
    else ars += n;
  }
  return { ars: roundMoney(ars), usd: roundMoney(usd) };
}

/** Lo que entra de las formas menos lo ya asignado a otras deudas, tope el saldo. */
export function montoCancelarTodo(opts: {
  saldo: number;
  moneda: MonedaPago;
  totalFormas: number;
  asignadoOtras: number;
}): number {
  const saldo = Math.max(0, roundMoney(opts.saldo));
  const restante = roundMoney(Math.max(0, opts.totalFormas - opts.asignadoOtras));
  return roundMoney(Math.min(saldo, restante));
}

function partirMismaMoneda(
  formas: FormaPagoReparto[],
  deudas: DeudaReparto[],
): ResultadoRepartoPago {
  const formasRest = formas
    .filter((f) => esPositivo(f.monto))
    .map((f) => ({ ...f, restante: roundMoney(f.monto) }));
  const deudasRest = deudas
    .filter((d) => esPositivo(d.asignado))
    .map((d) => ({ ...d, restante: roundMoney(d.asignado) }));

  const tramos: TramoPago[] = [];
  let fi = 0;
  let di = 0;
  while (fi < formasRest.length && di < deudasRest.length) {
    const forma = formasRest[fi];
    const deuda = deudasRest[di];
    const take = roundMoney(Math.min(forma.restante, deuda.restante));
    if (take > CERO) {
      tramos.push({
        presupuestoId: deuda.presupuestoId,
        metodo: forma.metodo,
        moneda: forma.moneda,
        monto: take,
        cuentaId: forma.cuentaId,
      });
      forma.restante = roundMoney(forma.restante - take);
      deuda.restante = roundMoney(deuda.restante - take);
    }
    if (forma.restante <= CERO) fi += 1;
    if (deuda.restante <= CERO) di += 1;
  }
  return { ok: true, tramos };
}

/**
 * Parte cada forma de pago contra las deudas de la misma moneda.
 * Si `destinoUnicoId` está, todas las formas van a esa venta (una sola deuda).
 */
export function validarYPartirPago(opts: {
  formas: FormaPagoReparto[];
  deudas: DeudaReparto[];
  destinoUnicoId?: string;
}): ResultadoRepartoPago {
  const formasOk: FormaPagoReparto[] = [];
  for (const f of opts.formas) {
    const monto = Number(f.monto);
    if (!Number.isFinite(monto) || monto < 0) {
      return { ok: false, error: "Hay un monto de forma de pago inválido." };
    }
    if (monto <= CERO) continue;
    if (!f.metodo.trim()) {
      return { ok: false, error: "Indicá cómo se paga en cada forma." };
    }
    formasOk.push({
      metodo: f.metodo.trim(),
      moneda: f.moneda,
      monto: roundMoney(monto),
      cuentaId: f.cuentaId,
    });
  }
  if (formasOk.length === 0) {
    return { ok: false, error: "Ingresá al menos un monto para registrar el pago." };
  }

  if (opts.destinoUnicoId) {
    return {
      ok: true,
      tramos: formasOk.map((f) => ({
        presupuestoId: opts.destinoUnicoId as string,
        metodo: f.metodo,
        moneda: f.moneda,
        monto: f.monto,
        cuentaId: f.cuentaId,
      })),
    };
  }

  for (const d of opts.deudas) {
    const asignado = Number(d.asignado);
    const saldo = Number(d.saldo);
    if (!Number.isFinite(asignado) || asignado < 0) {
      return { ok: false, error: "Hay un monto asignado a una deuda inválido." };
    }
    if (asignado > saldo + CERO) {
      return { ok: false, error: "No se puede asignar más que el saldo de una deuda." };
    }
  }

  const totalFormas = totalPorMoneda(formasOk);
  const totalAsignado = totalPorMoneda(
    opts.deudas.map((d) => ({ moneda: d.moneda, monto: d.asignado })),
  );
  if (totalFormas.usd !== totalAsignado.usd || totalFormas.ars !== totalAsignado.ars) {
    return {
      ok: false,
      error: "La suma de las formas de pago tiene que coincidir con lo asignado a las deudas, en la misma moneda.",
    };
  }

  const tramos: TramoPago[] = [];
  for (const moneda of ["usd", "ars"] as const) {
    const formasM = formasOk.filter((f) => f.moneda === moneda);
    const deudasM = opts.deudas.filter((d) => d.moneda === moneda);
    const r = partirMismaMoneda(formasM, deudasM);
    if (!r.ok) return r;
    tramos.push(...r.tramos);
  }
  return { ok: true, tramos };
}
