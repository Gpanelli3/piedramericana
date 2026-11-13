"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, Box } from "lucide-react";
import type { ChapaRow, MaterialCatalogLookup } from "@/lib/stock-api";
import { aggregateChapasPorMaterial } from "@/lib/stock-api";

type SortKey =
  | "materialLabel"
  | "familia"
  | "codigo"
  | "planchasDisponibles"
  | "planchasReservadas"
  | "m2Disponibles"
  | "m2Reservados"
  | "m2Retazo"
  | "retazosCount"
  | "m2SobrantePrevisto"
  | "costoUsdTotal";

type Props = {
  chapas: ChapaRow[];
  materiales: MaterialCatalogLookup[];
};

function formatM2(n: number) {
  if (!n) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatUsd(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function dash(v: string | null | undefined) {
  const t = v?.trim();
  return t ? t : "—";
}

export function StockMaterialesAgregadosTab({
  chapas,
  materiales,
}: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("materialLabel");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const all = useMemo(
    () => aggregateChapasPorMaterial(chapas, materiales),
    [chapas, materiales],
  );

  const filas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = needle
      ? all.filter(
          (r) =>
            r.materialLabel.toLowerCase().includes(needle) ||
            (r.familia ?? "").toLowerCase().includes(needle) ||
            (r.codigo ?? "").toLowerCase().includes(needle),
        )
      : [...all];

    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "string" || typeof bv === "string") {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), "es", {
          sensitivity: "base",
        });
      } else {
        cmp = (Number(av ?? 0) || 0) - (Number(bv ?? 0) || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [all, q, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "materialLabel" || key === "familia" || key === "codigo" ? "asc" : "desc");
    }
  };

  const SortHead = ({
    label,
    column,
    align = "left",
  }: {
    label: string;
    column: SortKey;
    align?: "left" | "right";
  }) => (
    <TableHead
      className={`text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
        align === "right" ? "text-right" : ""
      } ${column === "materialLabel" ? "pl-4" : ""} ${column === "costoUsdTotal" ? "pr-4" : ""}`}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          align === "right" ? "justify-end w-full" : ""
        }`}
        onClick={() => toggleSort(column)}
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar material…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 pl-9"
            aria-label="Filtrar materiales"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHead label="Material" column="materialLabel" />
              <SortHead label="Familia" column="familia" />
              <SortHead label="Código" column="codigo" />
              <SortHead label="Enteras" column="planchasDisponibles" align="right" />
              <SortHead label="Retazos" column="retazosCount" align="right" />
              <SortHead label="m² disp." column="m2Disponibles" align="right" />
              <SortHead label="m² res." column="m2Reservados" align="right" />
              <SortHead label="Costo USD" column="costoUsdTotal" align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {q.trim() ? `No hay resultados para «${q}».` : "Sin materiales en stock."}
                </TableCell>
              </TableRow>
            ) : (
              filas.map((row) => (
                <TableRow
                  key={row.materialLabel}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate(`/stock/material/${encodeURIComponent(row.materialLabel)}`)}
                >
                  <TableCell className="pl-4 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-foreground">
                      <Box className="h-4 w-4 shrink-0 text-primary" />
                      {row.materialLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.familia ? (
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        {row.familia}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {dash(row.codigo)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-medium">
                    {row.planchasDisponibles}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {row.retazosCount > 0 ? row.retazosCount : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-semibold">
                    {formatM2(row.m2Disponibles)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {row.m2Reservados > 0 ? formatM2(row.m2Reservados) : "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right text-sm tabular-nums font-medium">
                    {formatUsd(row.costoUsdTotal)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
