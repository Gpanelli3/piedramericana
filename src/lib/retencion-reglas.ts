export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Transferencia y cheque retienen; efectivo, tarjeta y Mercado Pago no. */
export function metodoAplicaRetencion(metodo: string): boolean {
  const m = metodo.toLowerCase().trim();
  return m === "transferencia" || m === "cheque";
}

export type CalcularRetencionInput = {
  bruto: number;
  esAgente: boolean;
  metodo: string;
  porcentajeCliente: number | null;
  porcentajeOverride?: number | null;
  retencionMontoOverride?: number | null;
};

export type CalcularRetencionResultado = {
  aplica: boolean;
  porcentaje: number;
  retencionMonto: number;
  neto: number;
  error: string | null;
};

export function calcularRetencion(input: CalcularRetencionInput): CalcularRetencionResultado {
  const bruto = Number(input.bruto);
  if (!Number.isFinite(bruto) || bruto <= 0) {
    return {
      aplica: false,
      porcentaje: 0,
      retencionMonto: 0,
      neto: 0,
      error: "El monto del cobro no es válido.",
    };
  }

  const aplica = Boolean(input.esAgente) && metodoAplicaRetencion(input.metodo);
  if (!aplica) {
    return { aplica: false, porcentaje: 0, retencionMonto: 0, neto: roundMoney(bruto), error: null };
  }

  if (input.retencionMontoOverride != null) {
    const raw = Number(input.retencionMontoOverride);
    if (!Number.isFinite(raw)) {
      return {
        aplica: true,
        porcentaje: 0,
        retencionMonto: 0,
        neto: roundMoney(bruto),
        error: "La retención no es un número válido.",
      };
    }
    if (raw < 0) {
      return {
        aplica: true,
        porcentaje: 0,
        retencionMonto: 0,
        neto: roundMoney(bruto),
        error: "La retención no puede ser negativa.",
      };
    }
    if (raw > bruto) {
      return {
        aplica: true,
        porcentaje: 100,
        retencionMonto: roundMoney(bruto),
        neto: 0,
        error: "La retención no puede superar el cobro.",
      };
    }
    const retencionMonto = roundMoney(raw);
    const porcentaje = roundMoney((retencionMonto / bruto) * 100);
    return {
      aplica: true,
      porcentaje,
      retencionMonto,
      neto: roundMoney(bruto - retencionMonto),
      error: null,
    };
  }

  const pctRaw =
    input.porcentajeOverride != null ? Number(input.porcentajeOverride) : Number(input.porcentajeCliente ?? 0);
  if (!Number.isFinite(pctRaw)) {
    return {
      aplica: true,
      porcentaje: 0,
      retencionMonto: 0,
      neto: roundMoney(bruto),
      error: "El porcentaje de retención no es válido.",
    };
  }
  if (pctRaw < 0 || pctRaw > 100) {
    return {
      aplica: true,
      porcentaje: pctRaw,
      retencionMonto: 0,
      neto: roundMoney(bruto),
      error: "El porcentaje de retención va de 0 a 100.",
    };
  }

  const porcentaje = roundMoney(pctRaw);
  const retencionMonto = roundMoney((bruto * porcentaje) / 100);
  const capped = Math.min(retencionMonto, roundMoney(bruto));
  return {
    aplica: true,
    porcentaje,
    retencionMonto: capped,
    neto: roundMoney(bruto - capped),
    error: null,
  };
}
