import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type ChapaRow = {
  bulto: string;
  material: string;
  largoCm: number;
  anchoCm: number;
  estado: "Disponible" | "Reservada";
};

/** Inventario inicial compartido entre Stock y Producción (roturas). */
export const STOCK_CHAPAS_INICIAL: ChapaRow[] = [
  {
    bulto: "#8890",
    material: "Granito Negro Brasil Extra 20mm",
    largoCm: 320,
    anchoCm: 180,
    estado: "Disponible",
  },
  {
    bulto: "#8891",
    material: "Silestone Blanco Stellar",
    largoCm: 305,
    anchoCm: 140,
    estado: "Disponible",
  },
  {
    bulto: "#8876",
    material: "Cuarcita Blue Roma",
    largoCm: 290,
    anchoCm: 165,
    estado: "Reservada",
  },
  {
    bulto: "#8850",
    material: "Dekton TRILIUM 12mm",
    largoCm: 320,
    anchoCm: 145,
    estado: "Disponible",
  },
  {
    bulto: "#8851",
    material: "Dekton TRILIUM 12mm",
    largoCm: 300,
    anchoCm: 150,
    estado: "Reservada",
  },
  {
    bulto: "#8845",
    material: "Granito Black Cosmic Leather 20mm",
    largoCm: 310,
    anchoCm: 175,
    estado: "Disponible",
  },
];

/** Claves del selector de rotura en producción → fragmento a buscar en `ChapaRow.material`. */
const ROTURA_KEY_TO_NEEDLE: Record<string, string> = {
  "granito-negro": "Granito Negro Brasil",
  "silestone-blanco": "Silestone",
  "cuarcita-black": "Cuarcita",
  "dekton-trilium": "Dekton",
  "granito-boreal": "Boreal",
};

type StockContextValue = {
  chapas: ChapaRow[];
  setChapas: Dispatch<SetStateAction<ChapaRow[]>>;
  /** Quita la primera chapa disponible cuyo material contenga la aguja del catálogo de roturas. */
  tryDeducirChapaPorRotura: (materialSelectKey: string) => { removed: boolean; bulto?: string };
};

const StockContext = createContext<StockContextValue | null>(null);

export function StockProvider({ children }: { children: ReactNode }) {
  const [chapas, setChapas] = useState<ChapaRow[]>(STOCK_CHAPAS_INICIAL);

  const tryDeducirChapaPorRotura = useCallback((materialSelectKey: string) => {
    const needle = ROTURA_KEY_TO_NEEDLE[materialSelectKey];
    let removed = false;
    let bulto: string | undefined;
    setChapas((prev) => {
      if (!needle) return prev;
      const idx = prev.findIndex(
        (c) => c.estado === "Disponible" && c.material.includes(needle)
      );
      if (idx === -1) return prev;
      removed = true;
      bulto = prev[idx]!.bulto;
      return prev.filter((_, i) => i !== idx);
    });
    return { removed, bulto };
  }, []);

  const value = useMemo(
    () => ({
      chapas,
      setChapas,
      tryDeducirChapaPorRotura,
    }),
    [chapas, tryDeducirChapaPorRotura]
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock(): StockContextValue {
  const ctx = useContext(StockContext);
  if (!ctx) {
    throw new Error("useStock debe usarse dentro de StockProvider");
  }
  return ctx;
}
