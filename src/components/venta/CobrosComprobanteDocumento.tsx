import { cn } from "@/lib/utils";
import { etiquetaMetodo } from "@/lib/finanzas-api";

export type CobrosComprobantePago = {
  id: string;
  fecha: string;
  monto: number;
  moneda: "ars" | "usd";
  metodo: string;
  nota?: string | null;
  retencionMonto?: number;
  retencionPorcentaje?: number | null;
};

export type CobrosComprobanteDocumentoProps = {
  numeroPresupuesto: string;
  clienteNombre: string;
  contacto?: string;
  tel?: string;
  email?: string;
  etapaLabel?: string;
  moneda: "ars" | "usd";
  total: number;
  cobrado: number;
  saldo: number;
  pagos: CobrosComprobantePago[];
  fechaEmision?: string;
  className?: string;
};

function formatMonto(n: number, moneda: "ars" | "usd") {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: moneda === "usd" ? 2 : 0,
  };
  if (moneda === "usd") {
    return `USD ${n.toLocaleString("es-AR", opts)}`;
  }
  return `$ ${n.toLocaleString("es-AR", opts)}`;
}

function formatoFecha(s: string): string {
  try {
    const d =
      /\d{4}-\d{2}-\d{2}/.exec(s)?.[0]
        ? new Date(s.includes("T") ? s : `${s}T12:00:00`)
        : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function estadoCobroLabel(cobrado: number, saldo: number): string {
  if (cobrado <= 0.009) return "Sin seña";
  if (saldo <= 0.009) return "Pagado";
  return "Con anticipo";
}

/** Comprobante de cuenta corriente / cobros para entregar al cliente (impresión / PDF). */
export function CobrosComprobanteDocumento({
  numeroPresupuesto,
  clienteNombre,
  contacto = "",
  tel = "",
  email = "",
  etapaLabel = "",
  moneda,
  total,
  cobrado,
  saldo,
  pagos,
  fechaEmision,
  className,
}: CobrosComprobanteDocumentoProps) {
  const fechaMostrada =
    fechaEmision?.trim() ||
    new Date().toLocaleDateString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const pagosOrdenados = [...pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const hayRetencion = pagosOrdenados.some((p) => (p.retencionMonto ?? 0) > 0.009);
  const totalRetencion = pagosOrdenados.reduce((acc, p) => {
    if (p.moneda !== moneda) return acc;
    return acc + (p.retencionMonto ?? 0);
  }, 0);
  const totalNeto = cobrado - totalRetencion;

  return (
    <div
      className={cn(
        "bg-white text-neutral-900 text-[12px] leading-snug print:text-[11px]",
        className,
      )}
    >
      <header className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-3 border border-neutral-800">
        <div className="flex items-center justify-center bg-neutral-900 px-3 py-4 text-white">
          <p className="text-center text-sm font-bold uppercase tracking-[0.12em]">
            Piedra
            <br />
            Americana
          </p>
        </div>
        <div className="flex min-w-[10rem] flex-col items-center justify-center border-x border-neutral-800 px-6 py-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            Comprobante de cobros
          </p>
          <p className="text-base font-bold tabular-nums">
            {numeroPresupuesto.trim() || "—"}
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-neutral-600">{fechaMostrada}</p>
        </div>
        <div className="flex flex-col justify-center space-y-0.5 px-3 py-3 text-[11px] text-neutral-700">
          <p>
            <span className="text-neutral-500">Moneda:</span>{" "}
            {moneda === "usd" ? "Dólares (USD)" : "Pesos (ARS)"}
          </p>
          <p>
            <span className="text-neutral-500">Estado:</span>{" "}
            {estadoCobroLabel(cobrado, saldo)}
          </p>
          {etapaLabel.trim() ? (
            <p>
              <span className="text-neutral-500">Etapa:</span> {etapaLabel}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 border border-neutral-800 px-3 py-2.5 sm:grid-cols-2">
        <p>
          <span className="font-semibold">Cliente:</span> {clienteNombre.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Contacto:</span> {contacto.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Tel:</span> {tel.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {email.trim() || "—"}
        </p>
      </section>

      <section className="mb-3 grid grid-cols-3 gap-0 border border-neutral-800 text-center">
        <div className="border-r border-neutral-800 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Total</p>
          <p className="mt-1 text-sm font-bold tabular-nums">{formatMonto(total, moneda)}</p>
        </div>
        <div className="border-r border-neutral-800 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Cobrado</p>
          <p className="mt-1 text-sm font-bold tabular-nums">{formatMonto(cobrado, moneda)}</p>
        </div>
        <div className="bg-neutral-900 px-3 py-3 text-white">
          <p className="text-[10px] uppercase tracking-wide text-white/70">
            {saldo <= 0.009 ? "Saldo" : "Saldo pendiente"}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">
            {saldo <= 0.009 ? "Pagado" : formatMonto(saldo, moneda)}
          </p>
        </div>
      </section>

      <section className="mb-3">
        <div className="border border-b-0 border-neutral-800 bg-neutral-100 px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-700">
            Detalle de pagos ({pagosOrdenados.length})
          </p>
        </div>
        {pagosOrdenados.length === 0 ? (
          <p className="border border-neutral-800 px-3 py-4 text-neutral-600">
            Sin pagos registrados a la fecha.
          </p>
        ) : (
          <table className="w-full border-collapse border border-neutral-800 text-left">
            <thead>
              <tr className="bg-neutral-50">
                <th className="border-b border-neutral-800 px-3 py-2 font-semibold">Fecha</th>
                <th className="border-b border-neutral-800 px-3 py-2 font-semibold">Método</th>
                <th className="border-b border-neutral-800 px-3 py-2 font-semibold">Nota</th>
                {hayRetencion ? (
                  <>
                    <th className="border-b border-neutral-800 px-3 py-2 text-right font-semibold">
                      Bruto
                    </th>
                    <th className="border-b border-neutral-800 px-3 py-2 text-right font-semibold">
                      Retención
                    </th>
                    <th className="border-b border-neutral-800 px-3 py-2 text-right font-semibold">
                      Neto
                    </th>
                  </>
                ) : (
                  <th className="border-b border-neutral-800 px-3 py-2 text-right font-semibold">
                    Monto
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pagosOrdenados.map((p) => {
                const ret = p.retencionMonto ?? 0;
                const neto = p.monto - ret;
                const retLabel =
                  ret > 0.009 && p.retencionPorcentaje != null
                    ? `${formatMonto(ret, p.moneda)} (${p.retencionPorcentaje}%)`
                    : ret > 0.009
                      ? formatMonto(ret, p.moneda)
                      : "—";
                return (
                  <tr key={p.id} className="align-top">
                    <td className="border-b border-neutral-200 px-3 py-2 tabular-nums">
                      {formatoFecha(p.fecha)}
                    </td>
                    <td className="border-b border-neutral-200 px-3 py-2">
                      {etiquetaMetodo(p.metodo)}
                    </td>
                    <td className="border-b border-neutral-200 px-3 py-2 text-neutral-600">
                      {p.nota?.trim() || "—"}
                    </td>
                    {hayRetencion ? (
                      <>
                        <td className="border-b border-neutral-200 px-3 py-2 text-right font-medium tabular-nums">
                          {formatMonto(p.monto, p.moneda)}
                        </td>
                        <td className="border-b border-neutral-200 px-3 py-2 text-right tabular-nums">
                          {retLabel}
                        </td>
                        <td className="border-b border-neutral-200 px-3 py-2 text-right font-medium tabular-nums">
                          {formatMonto(neto, p.moneda)}
                        </td>
                      </>
                    ) : (
                      <td className="border-b border-neutral-200 px-3 py-2 text-right font-medium tabular-nums">
                        {formatMonto(p.monto, p.moneda)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {hayRetencion ? (
                <>
                  <tr className="bg-neutral-50">
                    <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                      Total bruto ({moneda.toUpperCase()})
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {formatMonto(cobrado, moneda)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMonto(totalRetencion, moneda)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {formatMonto(totalNeto, moneda)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr className="bg-neutral-50">
                  <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                    Total cobrado ({moneda.toUpperCase()})
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {formatMonto(cobrado, moneda)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </section>

      <footer className="mt-8 grid grid-cols-2 gap-8 sm:gap-16 print:mt-12">
        <div className="border-t border-neutral-400 pt-2">
          <p className="text-xs font-semibold text-neutral-900">Piedra Americana</p>
          <p className="text-[10px] text-neutral-500">Comprobante informativo de cuenta corriente</p>
        </div>
        <div className="border-t border-neutral-400 pt-2 text-right">
          <p className="text-[10px] text-neutral-500">Firma / conformidad cliente</p>
        </div>
      </footer>
    </div>
  );
}

export type CobrosComprobanteUnicoProps = {
  tipo: "pago" | "cargo";
  numeroPresupuesto: string;
  clienteNombre: string;
  contacto?: string;
  tel?: string;
  email?: string;
  fecha: string;
  moneda: "ars" | "usd";
  monto: number;
  metodo?: string | null;
  nota?: string | null;
  retencionMonto?: number;
  retencionPorcentaje?: number | null;
  totalObra: number;
  cobradoObra: number;
  saldoObra: number;
  className?: string;
};

/** Recibo de un solo movimiento (pago o cargo) para entregar al cliente. */
export function CobrosComprobanteUnico({
  tipo,
  numeroPresupuesto,
  clienteNombre,
  contacto = "",
  tel = "",
  email = "",
  fecha,
  moneda,
  monto,
  metodo,
  nota,
  retencionMonto = 0,
  retencionPorcentaje,
  totalObra,
  cobradoObra,
  saldoObra,
  className,
}: CobrosComprobanteUnicoProps) {
  const esPago = tipo === "pago";
  const ret = retencionMonto > 0.009 ? retencionMonto : 0;
  const neto = monto - ret;
  const fechaDoc = formatoFecha(fecha);

  return (
    <div
      className={cn(
        "bg-white text-neutral-900 text-[12px] leading-snug print:text-[11px]",
        className,
      )}
    >
      <header className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-3 border border-neutral-800">
        <div className="flex items-center justify-center bg-neutral-900 px-3 py-4 text-white">
          <p className="text-center text-sm font-bold uppercase tracking-[0.12em]">
            Piedra
            <br />
            Americana
          </p>
        </div>
        <div className="flex min-w-[10rem] flex-col items-center justify-center border-x border-neutral-800 px-6 py-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            {esPago ? "Recibo de pago" : "Cargo a cuenta"}
          </p>
          <p className="text-base font-bold tabular-nums">
            {numeroPresupuesto.trim() || "—"}
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-neutral-600">{fechaDoc}</p>
        </div>
        <div className="flex flex-col justify-center space-y-0.5 px-3 py-3 text-[11px] text-neutral-700">
          <p>
            <span className="text-neutral-500">Moneda:</span>{" "}
            {moneda === "usd" ? "Dólares (USD)" : "Pesos (ARS)"}
          </p>
          {esPago ? (
            <p>
              <span className="text-neutral-500">Método:</span> {etiquetaMetodo(metodo)}
            </p>
          ) : (
            <p>
              <span className="text-neutral-500">Concepto:</span> Cargo {numeroPresupuesto}
            </p>
          )}
        </div>
      </header>

      <section className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 border border-neutral-800 px-3 py-2.5 sm:grid-cols-2">
        <p>
          <span className="font-semibold">Cliente:</span> {clienteNombre.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Contacto:</span> {contacto.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Tel:</span> {tel.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {email.trim() || "—"}
        </p>
      </section>

      <section className="mb-3 border border-neutral-800 bg-neutral-900 px-4 py-5 text-center text-white">
        <p className="text-[10px] uppercase tracking-wide text-white/70">
          {esPago ? "Importe recibido" : "Importe cargado"}
        </p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">
          {formatMonto(esPago ? neto : monto, moneda)}
        </p>
        {esPago && ret > 0.009 ? (
          <p className="mt-2 text-[11px] text-white/80">
            Bruto {formatMonto(monto, moneda)}
            {" · "}
            Retención {formatMonto(ret, moneda)}
            {retencionPorcentaje != null ? ` (${retencionPorcentaje}%)` : ""}
          </p>
        ) : null}
        {esPago && nota?.trim() ? (
          <p className="mt-2 text-[11px] text-white/80">{nota.trim()}</p>
        ) : null}
      </section>

      <section className="mb-3 grid grid-cols-3 gap-0 border border-neutral-800 text-center">
        <div className="border-r border-neutral-800 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Total obra</p>
          <p className="mt-1 text-sm font-bold tabular-nums">{formatMonto(totalObra, moneda)}</p>
        </div>
        <div className="border-r border-neutral-800 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Cobrado</p>
          <p className="mt-1 text-sm font-bold tabular-nums">{formatMonto(cobradoObra, moneda)}</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            {saldoObra <= 0.009 ? "Saldo" : "Saldo pendiente"}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">
            {saldoObra <= 0.009 ? "Pagado" : formatMonto(saldoObra, moneda)}
          </p>
        </div>
      </section>

      <footer className="mt-8 grid grid-cols-2 gap-8 sm:gap-16 print:mt-12">
        <div className="border-t border-neutral-400 pt-2">
          <p className="text-xs font-semibold text-neutral-900">Piedra Americana</p>
          <p className="text-[10px] text-neutral-500">
            {esPago ? "Recibo de un pago" : "Comprobante de cargo"}
          </p>
        </div>
        <div className="border-t border-neutral-400 pt-2 text-right">
          <p className="text-[10px] text-neutral-500">Firma / conformidad cliente</p>
        </div>
      </footer>
    </div>
  );
}
