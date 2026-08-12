-- M13 / Stock: familia, código y costo USD en maestro de materiales

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS familia text,
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS costo_usd numeric;

COMMENT ON COLUMN public.materials.familia IS 'Familia comercial libre (ej. Neolith, Granitos Clasicos)';
COMMENT ON COLUMN public.materials.codigo IS 'Código interno / SKU del material';
COMMENT ON COLUMN public.materials.costo_usd IS 'Costo unitario USD por m²';
