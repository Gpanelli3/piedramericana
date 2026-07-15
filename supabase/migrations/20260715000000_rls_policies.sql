-- ============================================================
-- Migración: Políticas RLS para todas las tablas
-- Contexto: app interna (todos los usuarios autenticados son
--           empleados de confianza de Piedra Americana).
-- Patrón general:
--   SELECT  → cualquier usuario autenticado
--   INSERT / UPDATE / DELETE → cualquier usuario autenticado
-- La tabla `usuarios` es más restrictiva: cada uno edita el
-- propio, los admin editan cualquiera.
-- ============================================================

-- ─── usuarios ────────────────────────────────────────────────
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_auth"   ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own"    ON usuarios;
DROP POLICY IF EXISTS "usuarios_write_admin"   ON usuarios;

CREATE POLICY "usuarios_select_auth"
  ON usuarios FOR SELECT TO authenticated USING (true);

CREATE POLICY "usuarios_update_own"
  ON usuarios FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "usuarios_write_admin"
  ON usuarios FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── usuario_roles ────────────────────────────────────────────
ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_roles_select_auth" ON usuario_roles;
DROP POLICY IF EXISTS "usuario_roles_write_admin" ON usuario_roles;

CREATE POLICY "usuario_roles_select_auth"
  ON usuario_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "usuario_roles_write_admin"
  ON usuario_roles FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── articulos ────────────────────────────────────────────────
ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articulos_select_auth"  ON articulos;
DROP POLICY IF EXISTS "articulos_write_auth"   ON articulos;

CREATE POLICY "articulos_select_auth"
  ON articulos FOR SELECT TO authenticated USING (true);

CREATE POLICY "articulos_write_auth"
  ON articulos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── listas_precio ───────────────────────────────────────────
ALTER TABLE listas_precio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listas_precio_select_auth" ON listas_precio;
DROP POLICY IF EXISTS "listas_precio_write_auth"  ON listas_precio;

CREATE POLICY "listas_precio_select_auth"
  ON listas_precio FOR SELECT TO authenticated USING (true);

CREATE POLICY "listas_precio_write_auth"
  ON listas_precio FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── listas_precio_items ─────────────────────────────────────
ALTER TABLE listas_precio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listas_precio_items_select_auth" ON listas_precio_items;
DROP POLICY IF EXISTS "listas_precio_items_write_auth"  ON listas_precio_items;

CREATE POLICY "listas_precio_items_select_auth"
  ON listas_precio_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "listas_precio_items_write_auth"
  ON listas_precio_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── materials ───────────────────────────────────────────────
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materials_select_auth" ON materials;
DROP POLICY IF EXISTS "materials_write_auth"  ON materials;

CREATE POLICY "materials_select_auth"
  ON materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "materials_write_auth"
  ON materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── suppliers ───────────────────────────────────────────────
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_auth" ON suppliers;
DROP POLICY IF EXISTS "suppliers_write_auth"  ON suppliers;

CREATE POLICY "suppliers_select_auth"
  ON suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppliers_write_auth"
  ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── remitos ─────────────────────────────────────────────────
ALTER TABLE remitos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "remitos_select_auth" ON remitos;
DROP POLICY IF EXISTS "remitos_write_auth"  ON remitos;

CREATE POLICY "remitos_select_auth"
  ON remitos FOR SELECT TO authenticated USING (true);

CREATE POLICY "remitos_write_auth"
  ON remitos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── remito_lines ────────────────────────────────────────────
ALTER TABLE remito_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "remito_lines_select_auth" ON remito_lines;
DROP POLICY IF EXISTS "remito_lines_write_auth"  ON remito_lines;

CREATE POLICY "remito_lines_select_auth"
  ON remito_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "remito_lines_write_auth"
  ON remito_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── chapas_inventario ───────────────────────────────────────
ALTER TABLE chapas_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chapas_inventario_select_auth" ON chapas_inventario;
DROP POLICY IF EXISTS "chapas_inventario_write_auth"  ON chapas_inventario;

CREATE POLICY "chapas_inventario_select_auth"
  ON chapas_inventario FOR SELECT TO authenticated USING (true);

CREATE POLICY "chapas_inventario_write_auth"
  ON chapas_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── lotes_cantera ───────────────────────────────────────────
ALTER TABLE lotes_cantera ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_cantera_select_auth" ON lotes_cantera;
DROP POLICY IF EXISTS "lotes_cantera_write_auth"  ON lotes_cantera;

CREATE POLICY "lotes_cantera_select_auth"
  ON lotes_cantera FOR SELECT TO authenticated USING (true);

CREATE POLICY "lotes_cantera_write_auth"
  ON lotes_cantera FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── lotes_marmol ────────────────────────────────────────────
ALTER TABLE lotes_marmol ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_marmol_select_auth" ON lotes_marmol;
DROP POLICY IF EXISTS "lotes_marmol_write_auth"  ON lotes_marmol;

CREATE POLICY "lotes_marmol_select_auth"
  ON lotes_marmol FOR SELECT TO authenticated USING (true);

CREATE POLICY "lotes_marmol_write_auth"
  ON lotes_marmol FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── placas_lote ─────────────────────────────────────────────
ALTER TABLE placas_lote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "placas_lote_select_auth" ON placas_lote;
DROP POLICY IF EXISTS "placas_lote_write_auth"  ON placas_lote;

CREATE POLICY "placas_lote_select_auth"
  ON placas_lote FOR SELECT TO authenticated USING (true);

CREATE POLICY "placas_lote_write_auth"
  ON placas_lote FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── conversiones_materiales ─────────────────────────────────
ALTER TABLE conversiones_materiales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversiones_materiales_select_auth" ON conversiones_materiales;
DROP POLICY IF EXISTS "conversiones_materiales_write_auth"  ON conversiones_materiales;

CREATE POLICY "conversiones_materiales_select_auth"
  ON conversiones_materiales FOR SELECT TO authenticated USING (true);

CREATE POLICY "conversiones_materiales_write_auth"
  ON conversiones_materiales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── stock_scraps ────────────────────────────────────────────
ALTER TABLE stock_scraps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_scraps_select_auth" ON stock_scraps;
DROP POLICY IF EXISTS "stock_scraps_write_auth"  ON stock_scraps;

CREATE POLICY "stock_scraps_select_auth"
  ON stock_scraps FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_scraps_write_auth"
  ON stock_scraps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── presupuestos ────────────────────────────────────────────
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presupuestos_select_auth" ON presupuestos;
DROP POLICY IF EXISTS "presupuestos_write_auth"  ON presupuestos;

CREATE POLICY "presupuestos_select_auth"
  ON presupuestos FOR SELECT TO authenticated USING (true);

CREATE POLICY "presupuestos_write_auth"
  ON presupuestos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── seguimiento_presupuestos ────────────────────────────────
ALTER TABLE seguimiento_presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seguimiento_presupuestos_select_auth" ON seguimiento_presupuestos;
DROP POLICY IF EXISTS "seguimiento_presupuestos_write_auth"  ON seguimiento_presupuestos;

CREATE POLICY "seguimiento_presupuestos_select_auth"
  ON seguimiento_presupuestos FOR SELECT TO authenticated USING (true);

CREATE POLICY "seguimiento_presupuestos_write_auth"
  ON seguimiento_presupuestos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── ventas ──────────────────────────────────────────────────
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ventas_select_auth" ON ventas;
DROP POLICY IF EXISTS "ventas_write_auth"  ON ventas;

CREATE POLICY "ventas_select_auth"
  ON ventas FOR SELECT TO authenticated USING (true);

CREATE POLICY "ventas_write_auth"
  ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── ventas_pagos ────────────────────────────────────────────
ALTER TABLE ventas_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ventas_pagos_select_auth" ON ventas_pagos;
DROP POLICY IF EXISTS "ventas_pagos_write_auth"  ON ventas_pagos;

CREATE POLICY "ventas_pagos_select_auth"
  ON ventas_pagos FOR SELECT TO authenticated USING (true);

CREATE POLICY "ventas_pagos_write_auth"
  ON ventas_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── ordenes_trabajo ─────────────────────────────────────────
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordenes_trabajo_select_auth" ON ordenes_trabajo;
DROP POLICY IF EXISTS "ordenes_trabajo_write_auth"  ON ordenes_trabajo;

CREATE POLICY "ordenes_trabajo_select_auth"
  ON ordenes_trabajo FOR SELECT TO authenticated USING (true);

CREATE POLICY "ordenes_trabajo_write_auth"
  ON ordenes_trabajo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── empleados ───────────────────────────────────────────────
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empleados_select_auth" ON empleados;
DROP POLICY IF EXISTS "empleados_write_auth"  ON empleados;

CREATE POLICY "empleados_select_auth"
  ON empleados FOR SELECT TO authenticated USING (true);

CREATE POLICY "empleados_write_auth"
  ON empleados FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── adelantos_empleado ──────────────────────────────────────
ALTER TABLE adelantos_empleado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adelantos_empleado_select_auth" ON adelantos_empleado;
DROP POLICY IF EXISTS "adelantos_empleado_write_auth"  ON adelantos_empleado;

CREATE POLICY "adelantos_empleado_select_auth"
  ON adelantos_empleado FOR SELECT TO authenticated USING (true);

CREATE POLICY "adelantos_empleado_write_auth"
  ON adelantos_empleado FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── comisiones ──────────────────────────────────────────────
ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comisiones_select_auth" ON comisiones;
DROP POLICY IF EXISTS "comisiones_write_auth"  ON comisiones;

CREATE POLICY "comisiones_select_auth"
  ON comisiones FOR SELECT TO authenticated USING (true);

CREATE POLICY "comisiones_write_auth"
  ON comisiones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── liquidaciones ───────────────────────────────────────────
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liquidaciones_select_auth" ON liquidaciones;
DROP POLICY IF EXISTS "liquidaciones_write_auth"  ON liquidaciones;

CREATE POLICY "liquidaciones_select_auth"
  ON liquidaciones FOR SELECT TO authenticated USING (true);

CREATE POLICY "liquidaciones_write_auth"
  ON liquidaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── liquidacion_conceptos ───────────────────────────────────
ALTER TABLE liquidacion_conceptos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liquidacion_conceptos_select_auth" ON liquidacion_conceptos;
DROP POLICY IF EXISTS "liquidacion_conceptos_write_auth"  ON liquidacion_conceptos;

CREATE POLICY "liquidacion_conceptos_select_auth"
  ON liquidacion_conceptos FOR SELECT TO authenticated USING (true);

CREATE POLICY "liquidacion_conceptos_write_auth"
  ON liquidacion_conceptos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── movimientos_caja ────────────────────────────────────────
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movimientos_caja_select_auth" ON movimientos_caja;
DROP POLICY IF EXISTS "movimientos_caja_write_auth"  ON movimientos_caja;

CREATE POLICY "movimientos_caja_select_auth"
  ON movimientos_caja FOR SELECT TO authenticated USING (true);

CREATE POLICY "movimientos_caja_write_auth"
  ON movimientos_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── importaciones ───────────────────────────────────────────
ALTER TABLE importaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "importaciones_select_auth" ON importaciones;
DROP POLICY IF EXISTS "importaciones_write_auth"  ON importaciones;

CREATE POLICY "importaciones_select_auth"
  ON importaciones FOR SELECT TO authenticated USING (true);

CREATE POLICY "importaciones_write_auth"
  ON importaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── importacion_gastos ──────────────────────────────────────
ALTER TABLE importacion_gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "importacion_gastos_select_auth" ON importacion_gastos;
DROP POLICY IF EXISTS "importacion_gastos_write_auth"  ON importacion_gastos;

CREATE POLICY "importacion_gastos_select_auth"
  ON importacion_gastos FOR SELECT TO authenticated USING (true);

CREATE POLICY "importacion_gastos_write_auth"
  ON importacion_gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── importacion_documentos ──────────────────────────────────
ALTER TABLE importacion_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "importacion_documentos_select_auth" ON importacion_documentos;
DROP POLICY IF EXISTS "importacion_documentos_write_auth"  ON importacion_documentos;

CREATE POLICY "importacion_documentos_select_auth"
  ON importacion_documentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "importacion_documentos_write_auth"
  ON importacion_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── reclamos ────────────────────────────────────────────────
ALTER TABLE reclamos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reclamos_select_auth" ON reclamos;
DROP POLICY IF EXISTS "reclamos_write_auth"  ON reclamos;

CREATE POLICY "reclamos_select_auth"
  ON reclamos FOR SELECT TO authenticated USING (true);

CREATE POLICY "reclamos_write_auth"
  ON reclamos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── reclamo_seguimiento ─────────────────────────────────────
ALTER TABLE reclamo_seguimiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reclamo_seguimiento_select_auth" ON reclamo_seguimiento;
DROP POLICY IF EXISTS "reclamo_seguimiento_write_auth"  ON reclamo_seguimiento;

CREATE POLICY "reclamo_seguimiento_select_auth"
  ON reclamo_seguimiento FOR SELECT TO authenticated USING (true);

CREATE POLICY "reclamo_seguimiento_write_auth"
  ON reclamo_seguimiento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── referentes ──────────────────────────────────────────────
ALTER TABLE referentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referentes_select_auth" ON referentes;
DROP POLICY IF EXISTS "referentes_write_auth"  ON referentes;

CREATE POLICY "referentes_select_auth"
  ON referentes FOR SELECT TO authenticated USING (true);

CREATE POLICY "referentes_write_auth"
  ON referentes FOR ALL TO authenticated USING (true) WITH CHECK (true);
