-- ARS de entrada: listas USD históricas quedan inactivas;
-- una sola Lista General activa en pesos.

UPDATE public.listas_precio
SET activa = false
WHERE lower(codigo) IN ('general', 'arquitectos')
  AND activa = true;

INSERT INTO public.listas_precio (codigo, label, moneda, descripcion, activa, sort_order)
SELECT
  'GENERAL-ARS',
  'Lista General',
  'ars',
  'Lista estándar en pesos argentinos.',
  true,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM public.listas_precio WHERE lower(codigo) = 'general-ars'
);

ALTER TABLE public.listas_precio
  ALTER COLUMN moneda SET DEFAULT 'ars';

ALTER TABLE public.articulos
  ALTER COLUMN moneda SET DEFAULT 'ars';

UPDATE public.articulos
SET moneda = 'ars'
WHERE moneda IS DISTINCT FROM 'ars';
