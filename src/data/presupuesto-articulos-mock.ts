export type UnidadArticulo = "M2" | "ML" | "UNI";

export interface ArticuloMock {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: UnidadArticulo;
  calculaMaterial: boolean;
  /** Si está definido: m² por unidad de compra (cantidad × medida). */
  medidaEstandarM2?: number;
  /** Precio sugerido mock: $/m² si calcula material M2/ML; $/unidad si UNI o no calcula. */
  precioUnitario: number;
}

export const ARTICULOS_MOCK: ArticuloMock[] = [
  {
    id: "art-mesada-m2",
    codigo: "MES-ALZ",
    descripcion: "Mesada y alzada — calcula material (m²)",
    unidad: "M2",
    calculaMaterial: true,
    precioUnitario: 5000,
  },
  {
    id: "art-asador-m2-manual",
    codigo: "MES-ASA",
    descripcion: "Mesada de asador — m² manual (mismo cálculo material)",
    unidad: "M2",
    calculaMaterial: true,
    precioUnitario: 4800,
  },
  {
    id: "art-bisel-ml",
    codigo: "BIS-ML",
    descripcion: "Biselado — metro lineal (alto en cm para material)",
    unidad: "ML",
    calculaMaterial: true,
    precioUnitario: 12000,
  },
  {
    id: "art-frentin-ml",
    codigo: "FRI-ML",
    descripcion: "Frentín ingletado con altura (metro lineal)",
    unidad: "ML",
    calculaMaterial: true,
    precioUnitario: 10000,
  },
  {
    id: "art-bacha-mo",
    codigo: "BACH-MO",
    descripcion: "Bacha integrada mano de obra — no calcula material",
    unidad: "UNI",
    calculaMaterial: false,
    precioUnitario: 15000,
  },
  {
    id: "art-prueba-std",
    codigo: "PRU-STD",
    descripcion: "Artículo prueba — medida estándar 3 m² por unidad",
    unidad: "M2",
    calculaMaterial: true,
    medidaEstandarM2: 3,
    precioUnitario: 2000,
  },
];

export function getArticuloById(id: string): ArticuloMock | undefined {
  return ARTICULOS_MOCK.find((a) => a.id === id);
}

export const LISTAS_PRECIO_MOCK = [
  { id: "lista-4-1-240", label: "LISTA 4-1-240" },
  { id: "lista-mayorista", label: "LISTA MAYORISTA" },
] as const;
