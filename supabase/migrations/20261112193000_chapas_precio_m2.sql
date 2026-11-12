-- Precio de venta por m² de cada plancha. El presupuesto lo usa en las líneas Pieza.

ALTER TABLE public.chapas_inventario
  ADD COLUMN IF NOT EXISTS precio_m2 numeric;

COMMENT ON COLUMN public.chapas_inventario.precio_m2 IS
  'Precio de venta por m² de esta plancha. Lo usa el presupuesto en las líneas Pieza.';

CREATE OR REPLACE FUNCTION public.chapas_inventario_precio_m2_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.precio_m2 IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.chapa_origen_id IS NOT NULL THEN
    SELECT c.precio_m2 INTO NEW.precio_m2
    FROM public.chapas_inventario c
    WHERE c.id = NEW.chapa_origen_id;
  ELSIF NEW.remito_line_id IS NOT NULL THEN
    SELECT rl.precio_unitario INTO NEW.precio_m2
    FROM public.remito_lines rl
    WHERE rl.id = NEW.remito_line_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chapas_inventario_precio_m2_default ON public.chapas_inventario;
CREATE TRIGGER chapas_inventario_precio_m2_default
  BEFORE INSERT ON public.chapas_inventario
  FOR EACH ROW
  EXECUTE FUNCTION public.chapas_inventario_precio_m2_default();
