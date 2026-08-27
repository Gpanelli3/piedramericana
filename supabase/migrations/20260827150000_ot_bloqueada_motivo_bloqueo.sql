-- M06: bloqueo explícito de OT (venta retenida / reglas de negocio)
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS bloqueada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueo text;

COMMENT ON COLUMN public.ordenes_trabajo.bloqueada IS 'OT retenida por regla de negocio (plata, bacha, manual, etc.)';
COMMENT ON COLUMN public.ordenes_trabajo.motivo_bloqueo IS 'Motivo libre del bloqueo; se limpia al desbloquear.';
