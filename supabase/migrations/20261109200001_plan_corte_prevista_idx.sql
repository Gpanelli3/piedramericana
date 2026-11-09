-- El valor enum 'Prevista' ya está committed; ahora se puede usar en un índice.

CREATE INDEX IF NOT EXISTS chapas_inventario_prevista_ot_idx
  ON public.chapas_inventario (ot_reserva_id)
  WHERE estado = 'Prevista';
