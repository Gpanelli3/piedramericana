-- La seña deja la venta en medición. Esas obras tienen que aparecer en Medición.
UPDATE public.presupuesto_mediciones pm
SET
  estado = 'listo_para_medir',
  solicitado_en = COALESCE(pm.solicitado_en, now()),
  updated_at = now()
WHERE pm.estado = 'sin_solicitar'
  AND EXISTS (
    SELECT 1
    FROM public.ventas v
    JOIN public.ventas_pagos vp ON vp.venta_id = v.id
    WHERE v.presupuesto_id = pm.presupuesto_id
      AND v.estado IN ('en_medicion', 'senado')
  );
