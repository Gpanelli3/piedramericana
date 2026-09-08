-- Quitar EXECUTE público/anon de las RPC de stock unitario (queda authenticated).

REVOKE ALL ON FUNCTION public.reservar_ot_stock_unidades(uuid, uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumir_ot_stock_unidades(uuid, uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.liberar_ot_stock_unidades(uuid, uuid, numeric, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reservar_ot_stock_unidades(uuid, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_ot_stock_unidades(uuid, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_ot_stock_unidades(uuid, uuid, numeric, uuid) TO authenticated;
