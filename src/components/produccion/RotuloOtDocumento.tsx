import type { RotuloOtDatos } from "@/lib/rotulo-ot-api";
import { cn } from "@/lib/utils";

type Props = {
  datos: RotuloOtDatos;
  className?: string;
};

function Linea({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <p className="flex min-w-0 items-baseline gap-2 border-b border-neutral-400 pb-0.5 text-[15px] leading-snug">
      <span className="shrink-0 font-semibold text-neutral-900">{label}:</span>
      <span
        className={cn(
          "min-w-0 text-neutral-900",
          wrap ? "whitespace-normal break-words" : "truncate",
        )}
      >
        {value}
      </span>
    </p>
  );
}

export function RotuloOtDocumento({ datos, className }: Props) {
  const bacha = datos.bachaDetalle
    ? `${datos.bachaTitulo} · ${datos.bachaDetalle}`
    : datos.bachaTitulo;

  return (
    <article
      className={cn(
        "flex min-h-[277mm] w-full flex-col border-2 border-neutral-900 bg-white text-neutral-900 print:h-[277mm]",
        className,
      )}
    >
      <header className="shrink-0 px-3 pt-2 pb-2">
        <div className="border border-neutral-900 px-2 py-1 text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em]">PIEDRA AMERICANA</p>
          <h1 className="text-xl font-semibold leading-tight">{datos.titulo}</h1>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
          <Linea label="Cliente" value={datos.cliente} />
          <Linea label="Presupuesto" value={datos.presupuestoNumero} />
          <Linea label="Material" value={datos.material} />
          <Linea label="Entrega" value={datos.fechaEntrega} />
          <Linea label="Dirección" value={datos.direccion} />
          <Linea label="Ambiente" value={datos.ambiente} />
          <Linea label="Teléfono" value={datos.telefono} />
          <Linea label="Zócalo" value={datos.zocalo} />
          <Linea label="Bacha" value={bacha} wrap />
          <Linea label="Colocación bacha" value={datos.comoVa} />
        </div>
        <div className="mt-1.5">
          <Linea label="Notas" value={datos.notas} wrap />
        </div>
      </header>

      <div
        className="relative min-h-[120mm] min-w-0 flex-1 border-y border-neutral-900"
        aria-label="Espacio para dibujar el trabajo"
        style={{
          backgroundImage:
            "linear-gradient(to right, #9eb6c9 1px, transparent 1px), linear-gradient(to bottom, #9eb6c9 1px, transparent 1px)",
          backgroundSize: "6mm 6mm",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      />

      <footer className="shrink-0 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Piezas</p>
        {datos.piezas.length === 0 ? (
          <p className="py-1 text-[15px] text-neutral-800">—</p>
        ) : (
          <table className="mt-0.5 w-full border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-neutral-900 text-left text-[11px] font-medium text-neutral-600">
                <th className="py-1 pr-2 font-medium">Pieza</th>
                <th className="py-1 pr-2 font-medium">Medidas</th>
                <th className="py-1 text-right font-medium">m²</th>
              </tr>
            </thead>
            <tbody>
              {datos.piezas.map((p, i) => (
                <tr key={`${p.articulo}-${i}`} className="border-b border-neutral-300">
                  <td className="py-1 pr-2 font-medium">{p.articulo}</td>
                  <td className="py-1 pr-2">{p.medidas}</td>
                  <td className="py-1 text-right tabular-nums">{p.m2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </footer>
    </article>
  );
}
