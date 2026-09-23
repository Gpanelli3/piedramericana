-- Cliente: agente de retención + % (se usa después al cobrar)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS es_agente_retencion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retencion_porcentaje numeric;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_retencion_porcentaje_rango;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_retencion_porcentaje_rango
  CHECK (
    retencion_porcentaje IS NULL
    OR (retencion_porcentaje >= 0 AND retencion_porcentaje <= 100)
  );

COMMENT ON COLUMN public.clients.es_agente_retencion IS 'Si el cliente retiene un % al pagar (transferencia/cheque).';
COMMENT ON COLUMN public.clients.retencion_porcentaje IS 'Porcentaje de retención (ej. 5 o 10). Solo aplica si es agente.';
