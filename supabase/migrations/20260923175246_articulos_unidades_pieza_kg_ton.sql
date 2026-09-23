-- Unidades extra de venta: pieza, kilo y tonelada (misma regla que UNI).
ALTER TYPE public.unidad_articulo ADD VALUE IF NOT EXISTS 'PIEZA';
ALTER TYPE public.unidad_articulo ADD VALUE IF NOT EXISTS 'KG';
ALTER TYPE public.unidad_articulo ADD VALUE IF NOT EXISTS 'TON';
