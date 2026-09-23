-- Trabajos (artículos): precio fijo + moneda.
-- Listas de precio pasan a valer para materiales de stock.

ALTER TABLE public.articulos
  ADD COLUMN IF NOT EXISTS precio numeric,
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'usd';

ALTER TABLE public.articulos
  DROP CONSTRAINT IF EXISTS articulos_moneda_check;

ALTER TABLE public.articulos
  ADD CONSTRAINT articulos_moneda_check CHECK (moneda IN ('ars', 'usd'));

COMMENT ON COLUMN public.articulos.precio IS 'Precio fijo del tipo de trabajo (no depende de lista).';
COMMENT ON COLUMN public.articulos.moneda IS 'Moneda del precio fijo del trabajo.';

-- Backfill desde la primera lista activa (General).
UPDATE public.articulos a
SET
  precio = i.precio,
  moneda = l.moneda
FROM public.listas_precio_items i
JOIN public.listas_precio l ON l.id = i.lista_precio_id
WHERE i.articulo_id = a.id
  AND i.activo = true
  AND a.precio IS NULL
  AND l.id = (
    SELECT id FROM public.listas_precio
    WHERE activa = true
    ORDER BY sort_order, created_at
    LIMIT 1
  );

CREATE OR REPLACE FUNCTION public.get_articulos_con_precios(p_lista_precio_id uuid)
RETURNS TABLE (
  id uuid,
  codigo text,
  descripcion text,
  unidad unidad_articulo,
  calcula_material boolean,
  medida_estandar_m2 numeric,
  prefer_modo_manual boolean,
  sort_order integer,
  precio numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.codigo,
    a.descripcion,
    a.unidad,
    a.calcula_material,
    a.medida_estandar_m2,
    a.prefer_modo_manual,
    a.sort_order,
    a.precio
  FROM public.articulos a
  WHERE a.activo = true
  ORDER BY a.sort_order, a.descripcion;
$$;

CREATE TABLE IF NOT EXISTS public.listas_precio_materiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_precio_id uuid NOT NULL REFERENCES public.listas_precio(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  precio numeric NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lista_precio_id, material_id)
);

CREATE INDEX IF NOT EXISTS listas_precio_materiales_lista_idx
  ON public.listas_precio_materiales (lista_precio_id, activo);

ALTER TABLE public.listas_precio_materiales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listas_precio_materiales_select_auth" ON public.listas_precio_materiales;
DROP POLICY IF EXISTS "listas_precio_materiales_write_auth" ON public.listas_precio_materiales;

CREATE POLICY "listas_precio_materiales_select_auth"
  ON public.listas_precio_materiales FOR SELECT TO authenticated USING (true);

CREATE POLICY "listas_precio_materiales_write_auth"
  ON public.listas_precio_materiales FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listas_precio_materiales TO authenticated;
GRANT ALL ON public.listas_precio_materiales TO service_role;
