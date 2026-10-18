-- Vincula la bacha del cliente con el cliente del catálogo, para mostrarla en sus OT.

ALTER TABLE public.bachas_inventario
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bachas_inventario_cliente_id_idx
  ON public.bachas_inventario (cliente_id);

UPDATE public.bachas_inventario b
SET cliente_id = c.id
FROM public.clients c
WHERE b.origen = 'cliente'
  AND b.cliente_id IS NULL
  AND lower(btrim(b.cliente_nombre)) = lower(btrim(c.name))
  AND (
    SELECT count(*)
    FROM public.clients c2
    WHERE lower(btrim(c2.name)) = lower(btrim(b.cliente_nombre))
  ) = 1;
