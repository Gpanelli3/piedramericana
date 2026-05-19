-- Flujo real de ventas:
-- senado -> en_medicion -> en_produccion -> finalizado -> entregado
-- Se elimina el estado legacy `aprobado_sin_sena`.

DO $$
DECLARE
  legacy_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO legacy_count
  FROM public.ventas
  WHERE estado::text = 'aprobado_sin_sena';

  IF legacy_count > 0 THEN
    RAISE EXCEPTION
      'No se puede recrear public.venta_estado: existen % ventas con estado legacy aprobado_sin_sena.',
      legacy_count;
  END IF;
END
$$;

ALTER TABLE public.ventas
  ALTER COLUMN estado DROP DEFAULT;

ALTER TYPE public.venta_estado RENAME TO venta_estado_old;

CREATE TYPE public.venta_estado AS ENUM (
  'senado',
  'en_medicion',
  'en_produccion',
  'finalizado',
  'entregado'
);

ALTER TABLE public.ventas
  ALTER COLUMN estado TYPE public.venta_estado
  USING (
    CASE
      WHEN estado::text = 'aprobado_sin_sena' THEN 'senado'
      ELSE estado::text
    END
  )::public.venta_estado;

DROP TYPE public.venta_estado_old;
