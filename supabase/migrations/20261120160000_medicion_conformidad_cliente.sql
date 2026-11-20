-- Conformidad del cliente tras medir.
-- Si al confirmar las medidas cambia el precio, la OT no pasa sola a producción:
-- queda esperando que el vendedor confirme que el cliente está de acuerdo con el nuevo importe.

alter table public.presupuesto_mediciones
  add column if not exists conformidad_pendiente boolean not null default false,
  add column if not exists conformidad_total_anterior numeric(14, 2),
  add column if not exists conformidad_total_nuevo numeric(14, 2),
  add column if not exists conformidad_en timestamptz,
  add column if not exists conformidad_por uuid references public.usuarios(id) on delete set null;
