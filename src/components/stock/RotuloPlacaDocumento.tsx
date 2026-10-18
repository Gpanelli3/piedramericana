import type { RotuloPlacaDatos } from "@/lib/rotulo-placa-api";
import { cn } from "@/lib/utils";

type Props = {
  datos: RotuloPlacaDatos;
  className?: string;
};

export function RotuloPlacaDocumento({ datos, className }: Props) {
  return (
    <article
      className={cn(
        "flex h-[48mm] w-[90mm] flex-col justify-between border-2 border-neutral-900 bg-white p-2 text-neutral-900",
        className,
      )}
    >
      <p className="text-[9px] font-semibold tracking-[0.16em]">PIEDRA AMERICANA</p>
      <p className="font-mono text-xl font-bold leading-none">{datos.bulto}</p>
      <p className="text-[12px] font-medium leading-tight">{datos.material}</p>
      <div className="grid grid-cols-2 gap-x-2 text-[11px] leading-tight">
        <p>
          <span className="font-semibold">Medidas:</span> {datos.medidas}
        </p>
        <p>
          <span className="font-semibold">Lote:</span> {datos.lote}
        </p>
        <p>
          <span className="font-semibold">Remito:</span> {datos.remito}
        </p>
        <p>
          <span className="font-semibold">Origen:</span> {datos.origen}
        </p>
      </div>
      <p className="text-[10px] text-neutral-600">{datos.fecha}</p>
    </article>
  );
}
