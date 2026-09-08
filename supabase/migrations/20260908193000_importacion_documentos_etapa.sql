ALTER TABLE public.importacion_documentos
  ADD COLUMN IF NOT EXISTS etapa public.importacion_estado;

CREATE INDEX IF NOT EXISTS idx_importacion_documentos_etapa
  ON public.importacion_documentos (importacion_id, etapa);
