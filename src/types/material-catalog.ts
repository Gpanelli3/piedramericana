import type { MaterialKindDb } from "@/types/database";

/** Fila del catálogo de materiales (presupuesto, stock maestro rápido). */
export type MaterialWizardRow = {
  id: string;
  name: string;
  unit: string;
  material_kind: MaterialKindDb;
  peso_por_m2_kg: number | null;
  bulk_stock_kg?: number;
};
