-- Publica tablas del dashboard Reportes en supabase_realtime (idempotente).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'presupuestos',
    'ventas',
    'ventas_pagos',
    'ordenes_trabajo',
    'chapas_inventario',
    'stock_movimientos'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END LOOP;
END $$;
