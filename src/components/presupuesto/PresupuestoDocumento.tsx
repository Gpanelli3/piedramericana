"use client";

import { Fragment } from "react";
import {
  articuloConPrecioToMock,
  buildLineaCalcInput,
  computeLineaPresupuesto,
  equivalentesMonedaMixta,
  formatMetraje,
  labelUnidad,
  parseDecimalInput,
} from "@/lib/presupuesto-calculos";
import { cn } from "@/lib/utils";
import type { ArticuloConPrecio } from "@/types/articulos";
import type { MaterialWizardRow } from "@/types/material-catalog";
import type { OrdenTrabajoWizard } from "@/components/presupuesto/wizard/types";
import { etiquetaTipoColocacion } from "@/components/presupuesto/wizard/types";
import { mecAlgunoActivo } from "@/components/presupuesto/wizard/validacion";

export type PresupuestoDocumentoProps = {
  numero?: string;
  fecha?: string;
  clienteNombre: string;
  contacto?: string;
  tel?: string;
  email?: string;
  direccion?: string;
  observacion?: string;
  origenLabel?: string;
  listaPrecioLabel?: string;
  moneda: "ars" | "usd";
  /** Tipo de cambio del día. El MEC se imprime siempre en pesos. */
  dolarHoy?: number;
  ordenes: OrdenTrabajoWizard[];
  articulos: ArticuloConPrecio[];
  materials?: MaterialWizardRow[];
  descuentoPct: number;
  mMedicion: boolean;
  mEntrega: boolean;
  mColocacion: boolean;
  totalMec: number;
  obsMec?: string;
  versionLabel?: string;
  className?: string;
};

function formatMoney(n: number, moneda: "ars" | "usd"): string {
  const digits = moneda === "usd" ? 2 : 2;
  try {
    return n.toLocaleString("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return n.toFixed(digits);
  }
}

function formatQty(n: number): string {
  return formatMetraje(n);
}

function formatDim(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function monedaSuffix(moneda: "ars" | "usd"): string {
  return moneda === "usd" ? "u$s" : "$";
}

function medidasTexto(line: OrdenTrabajoWizard["items"][number], unidad: string): string {
  const alto = parseDecimalInput(line.altoM);
  const ancho = parseDecimalInput(line.anchoM);
  const cant = parseDecimalInput(line.cantidad);
  const parts: string[] = [];

  if (alto > 0 && ancho > 0) {
    parts.push(`${formatDim(alto)} × ${formatDim(ancho)} m`);
  } else if (alto > 0 && unidad === "ML") {
    parts.push(`alto ${formatDim(alto)} m`);
  } else if (alto > 0) {
    parts.push(`${formatDim(alto)} m`);
  }

  if (cant > 0 && (alto > 0 || ancho > 0)) {
    parts.push(`cant. ${formatQty(cant)}`);
  }

  const desp = parseDecimalInput(line.desperdicioPct);
  if (desp > 0) parts.push(`desp. ${formatDim(desp)}%`);

  return parts.length ? parts.join(" · ") : "";
}

function etiquetaMec(mMedicion: boolean, mEntrega: boolean, mColocacion: boolean): string {
  const partes: string[] = [];
  if (mMedicion) partes.push("Medición");
  if (mEntrega) partes.push("Entrega");
  if (mColocacion) partes.push("Colocación");
  if (partes.length === 0) return "Servicios MEC";
  return `SERVICIOS (${partes.join(" · ")})`;
}

type FilaDoc = {
  key: string;
  descripcion: string;
  detalle?: string;
  unidad: string;
  cant: number;
  precioUnit: number;
  total: number;
};

type GrupoDoc = {
  key: string;
  titulo: string;
  direccionObra?: string;
  referenciaObra?: string;
  planoNombre?: string;
  excluirMec: boolean;
  obsMec: string;
  bachaTexto?: string;
  filas: FilaDoc[];
  subtotal: number;
};

export function PresupuestoDocumento({
  numero,
  fecha,
  clienteNombre,
  contacto = "",
  tel = "",
  email = "",
  direccion = "",
  observacion = "",
  origenLabel = "",
  listaPrecioLabel = "",
  moneda,
  dolarHoy = 0,
  ordenes,
  articulos,
  materials = [],
  descuentoPct,
  mMedicion,
  mEntrega,
  mColocacion,
  totalMec,
  obsMec = "",
  versionLabel = "",
  className,
}: PresupuestoDocumentoProps) {
  const suf = monedaSuffix(moneda);
  const grupos: GrupoDoc[] = [];
  let subtotalItems = 0;

  for (const ot of ordenes) {
    const material = materials.find((m) => m.id === ot.materialId);
    const tituloBase = ot.titulo.trim() || "Sin título";
    const titulo = material?.name
      ? `${tituloBase} — ${material.name}`
      : tituloBase;

    const filas: FilaDoc[] = [];
    let subOt = 0;

    for (const line of ot.items) {
      const artBd = articulos.find((a) => a.id === line.articuloId);
      if (!artBd) continue;
      const art = articuloConPrecioToMock(artBd);
      const calc = buildLineaCalcInput(art, line);
      const { m2Linea, subtotal } = computeLineaPresupuesto(art, calc);
      const pu = parseDecimalInput(line.precioUnitario);
      const qty = parseDecimalInput(line.cantidad);

      const usaM2 = art.unidad === "M2" && art.calculaMaterial && m2Linea > 0;

      const cant = usaM2 ? m2Linea : qty > 0 ? qty : art.calculaMaterial ? m2Linea : 0;
      const unidad = usaM2 ? "m²" : labelUnidad(art.unidad);
      const detalle = medidasTexto(line, art.unidad);

      filas.push({
        key: line.key,
        descripcion: artBd.descripcion || artBd.codigo || "Ítem",
        detalle: detalle || undefined,
        unidad,
        cant,
        precioUnit: pu,
        total: subtotal,
      });
      subOt += subtotal;
      subtotalItems += subtotal;
    }

    if (filas.length > 0) {
      const direccion =
        ot.obraFormattedAddress.trim() || ot.direccionObra.trim() || undefined;
      const referencia = ot.referenciaObra.trim() || undefined;
      const planoNombre = ot.planoAdjunto?.name.trim() || undefined;
      const bachaTexto = ot.llevaBacha
        ? [
            etiquetaTipoColocacion(ot.tipoColocacion),
            ot.bachaOrigen === "cliente" ? "del cliente" : "nuestra",
          ].join(" · ")
        : undefined;
      grupos.push({
        key: ot.key,
        titulo,
        direccionObra: direccion,
        referenciaObra: referencia,
        planoNombre,
        excluirMec: Boolean(ot.excluirMec),
        obsMec: (ot.obsMec ?? "").trim(),
        bachaTexto,
        filas,
        subtotal: subOt,
      });
    }
  }

  const mecActivo = mecAlgunoActivo(mMedicion, mEntrega, mColocacion) && totalMec > 0;
  const dPct = Math.max(0, Math.min(descuentoPct, 100));
  const factor = 1 - dPct / 100;
  const netoItems = subtotalItems * factor;
  const mecArs = mecActivo ? totalMec : 0;
  const eq = equivalentesMonedaMixta({
    items: netoItems,
    monedaItems: moneda,
    mecArs,
    dolarHoy,
  });
  const totalGeneral = eq.totalEnMonedaItems;

  const fechaMostrada =
    fecha?.trim() ||
    new Date().toLocaleDateString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  return (
    <div
      className={cn(
        "bg-white text-neutral-900 text-[12px] leading-snug print:text-[11px]",
        className,
      )}
    >
      {/* Cabecera */}
      <header className="grid grid-cols-[1fr_auto_1fr] gap-3 border border-neutral-800 mb-3">
        <div className="flex items-center justify-center bg-neutral-900 px-3 py-4 text-white">
          <p className="text-center text-sm font-bold tracking-[0.12em] uppercase">
            Piedra
            <br />
            Americana
          </p>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[10rem] border-x border-neutral-800">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Presupuesto</p>
          <p className="text-base font-bold tabular-nums">
            {numero?.trim() || "Borrador"}
          </p>
          {versionLabel.trim() ? (
            <p className="mt-1 rounded-sm border border-neutral-400 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-700">
              {versionLabel.trim()}
            </p>
          ) : null}
          <p className="text-[11px] text-neutral-600 tabular-nums mt-0.5">{fechaMostrada}</p>
        </div>
        <div className="flex flex-col justify-center px-3 py-3 text-[11px] text-neutral-700 space-y-0.5">
          {listaPrecioLabel ? (
            <p>
              <span className="text-neutral-500">Lista:</span> {listaPrecioLabel}
            </p>
          ) : null}
          <p>
            <span className="text-neutral-500">Moneda:</span>{" "}
            {moneda === "usd" ? "Dólares (u$s)" : "Pesos ($)"}
          </p>
          {direccion.trim() ? <p className="truncate" title={direccion}>{direccion}</p> : null}
        </div>
      </header>

      {/* Cliente */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 border border-neutral-800 px-3 py-2.5 mb-3">
        <p>
          <span className="font-semibold">Cliente:</span> {clienteNombre.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Contacto:</span> {contacto.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {email.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold">Tel:</span> {tel.trim() || "—"}
        </p>
        <p className="sm:col-span-2">
          <span className="font-semibold">Observación:</span> {observacion.trim() || "—"}
        </p>
        {origenLabel.trim() ? (
          <p className="sm:col-span-2">
            <span className="font-semibold">Origen / vendedor:</span> {origenLabel}
          </p>
        ) : null}
      </section>

      {/* Tabla */}
      <div className="border border-neutral-800 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-800 text-left">
              <th className="px-2 py-1.5 font-semibold">Descripción</th>
              <th className="px-2 py-1.5 font-semibold w-14 text-center">Unid.</th>
              <th className="px-2 py-1.5 font-semibold w-16 text-right">Cant.</th>
              <th className="px-2 py-1.5 font-semibold w-[5.5rem] text-right">
                Precio Unit. {suf}
              </th>
              <th className="px-2 py-1.5 font-semibold w-[5.5rem] text-right">
                Precio Total {suf}
              </th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && !mecActivo ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-neutral-500">
                  Sin ítems cargados.
                </td>
              </tr>
            ) : null}

            {grupos.map((g) => (
              <Fragment key={g.key}>
                <tr className="bg-neutral-100 border-t border-neutral-800">
                  <td colSpan={5} className="px-2 py-1.5 font-semibold">
                    <p>{g.titulo}</p>
                    {g.direccionObra || g.referenciaObra || g.planoNombre || g.excluirMec || g.bachaTexto ? (
                      <div className="mt-0.5 space-y-0.5 text-[10px] font-normal text-neutral-600">
                        {g.direccionObra ? <p>Obra: {g.direccionObra}</p> : null}
                        {g.referenciaObra ? <p>Ref.: {g.referenciaObra}</p> : null}
                        {g.planoNombre ? <p>Plano: {g.planoNombre}</p> : null}
                        {g.bachaTexto ? <p>Bacha: {g.bachaTexto}</p> : null}
                        {g.excluirMec ? (
                          <p>
                            No incluye MEC
                            {g.obsMec ? ` — ${g.obsMec}` : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
                {g.filas.map((f) => (
                  <tr key={f.key} className="border-t border-neutral-300 align-top">
                    <td className="px-2 py-1.5">
                      <p>{f.descripcion}</p>
                      {f.detalle ? (
                        <p className="text-[10px] text-neutral-500 mt-0.5">{f.detalle}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{f.unidad}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatQty(f.cant)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatMoney(f.precioUnit, moneda)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatMoney(f.total, moneda)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-50 border-t border-neutral-400">
                  <td colSpan={4} className="px-2 py-1 text-right font-semibold">
                    SubTotal {suf}:
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums font-semibold">
                    {formatMoney(g.subtotal, moneda)}
                  </td>
                </tr>
              </Fragment>
            ))}

            {mecActivo ? (
              <Fragment key="mec">
                <tr className="bg-neutral-100 border-t border-neutral-800">
                  <td colSpan={5} className="px-2 py-1.5 font-semibold">
                    Servicios MEC
                  </td>
                </tr>
                <tr className="border-t border-neutral-300 align-top">
                  <td className="px-2 py-1.5">
                    <p>{etiquetaMec(mMedicion, mEntrega, mColocacion)}</p>
                    {obsMec.trim() ? (
                      <p className="text-[10px] text-neutral-500 mt-0.5">{obsMec.trim()}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-center">u.</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">1,00</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatMoney(totalMec, "ars")}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                    {formatMoney(totalMec, "ars")}
                  </td>
                </tr>
                <tr className="bg-neutral-50 border-t border-neutral-400">
                  <td colSpan={4} className="px-2 py-1 text-right font-semibold">
                    SubTotal $:
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums font-semibold">
                    {formatMoney(totalMec, "ars")}
                  </td>
                </tr>
              </Fragment>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="mt-3 flex flex-col items-end gap-1">
        <div className="w-full max-w-xs border border-neutral-800">
          <div className="flex justify-between gap-4 px-3 py-1.5 border-b border-neutral-300">
            <span className="font-semibold">Producto {suf}:</span>
            <span className="tabular-nums font-semibold">
              {formatMoney(dPct > 0 ? netoItems : subtotalItems, moneda)}
            </span>
          </div>
          {dPct > 0 ? (
            <div className="flex justify-between gap-4 px-3 py-1.5 border-b border-neutral-300 text-neutral-600">
              <span>Descuento {formatQty(dPct)}%</span>
              <span className="tabular-nums">
                {formatMoney(subtotalItems - netoItems, moneda)}
              </span>
            </div>
          ) : null}
          {mecActivo ? (
            <div className="flex justify-between gap-4 px-3 py-1.5 border-b border-neutral-300">
              <span className="font-semibold">Instalación / MEC $:</span>
              <span className="tabular-nums font-semibold">
                {formatMoney(totalMec, "ars")}
              </span>
            </div>
          ) : null}
          {moneda === "usd" && dolarHoy > 0 ? (
            <div className="flex justify-between gap-4 px-3 py-1.5 border-b border-neutral-300 text-neutral-600">
              <span>Dólar del día</span>
              <span className="tabular-nums">{formatMoney(dolarHoy, "usd")}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 px-3 py-1.5 bg-neutral-100">
            <span className="font-semibold">Total {suf}:</span>
            <span className="tabular-nums font-semibold">
              {formatMoney(totalGeneral, moneda)}
            </span>
          </div>
          {moneda === "usd" && dolarHoy > 0 ? (
            <div className="flex justify-between gap-4 px-3 py-1.5 text-neutral-600">
              <span>Equivalente $:</span>
              <span className="tabular-nums">
                {formatMoney(eq.totalArs, "ars")}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Notas */}
      <footer className="mt-5 border border-neutral-400 px-3 py-2 text-[10px] text-neutral-600 space-y-1 leading-relaxed">
        <p>A los precios indicados se les debe adicionar el IVA correspondiente.</p>
        <p>
          Presupuesto sujeto a medición final en obra
          {moneda === "usd" && dolarHoy > 0
            ? ` y a variación del tipo de cambio (dólar del día ${formatMoney(dolarHoy, "usd")})`
            : ""}
          .
        </p>
        <p>
          No incluye otros artículos de stock salvo que figuren como ítem en alguna OT.
        </p>
      </footer>

      {/* Firmas (impresión) */}
      <div className="mt-10 grid grid-cols-2 gap-8 sm:gap-16 print:mt-14">
        <div className="flex flex-col items-center pt-2">
          <div className="mb-2 h-14 w-full max-w-[14rem] border-b border-neutral-800" />
          <p className="text-xs font-semibold text-neutral-900">Piedra Americana</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">Firma y aclaración</p>
        </div>
        <div className="flex flex-col items-center pt-2">
          <div className="mb-2 h-14 w-full max-w-[14rem] border-b border-neutral-800" />
          <p className="text-xs font-semibold text-neutral-900">Cliente</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">Firma y aclaración</p>
        </div>
      </div>
    </div>
  );
}
