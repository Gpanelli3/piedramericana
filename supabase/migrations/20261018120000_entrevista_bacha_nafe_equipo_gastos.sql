-- Entrevista: NAFE en OT, incentivos, prestadores, gastos fijos y conceptos de caja.
-- También limpia el bloqueo «Bacha pendiente» en corte (el freno queda al salir a producción).

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS nafe text;

CREATE TABLE IF NOT EXISTS public.nafe_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etiqueta text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nafe_opciones_etiqueta_chk CHECK (length(trim(etiqueta)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS nafe_opciones_etiqueta_lower_idx
  ON public.nafe_opciones (lower(trim(etiqueta)));

CREATE TABLE IF NOT EXISTS public.incentivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.empleados (id) ON DELETE RESTRICT,
  fecha date NOT NULL DEFAULT (CURRENT_DATE),
  tipo text NOT NULL DEFAULT 'premio',
  descripcion text,
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'ars',
  metodo text NOT NULL DEFAULT 'efectivo',
  movimiento_id uuid REFERENCES public.movimientos_caja (id) ON DELETE SET NULL,
  notas text,
  created_by uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incentivos_tipo_chk CHECK (tipo IN ('comision', 'premio', 'bono')),
  CONSTRAINT incentivos_moneda_chk CHECK (moneda IN ('ars', 'usd')),
  CONSTRAINT incentivos_metodo_chk CHECK (metodo IN ('efectivo', 'transferencia', 'cheque')),
  CONSTRAINT incentivos_monto_chk CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS incentivos_empleado_idx ON public.incentivos (empleado_id);
CREATE INDEX IF NOT EXISTS incentivos_fecha_idx ON public.incentivos (fecha DESC);

CREATE TABLE IF NOT EXISTS public.prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rubro text NOT NULL DEFAULT 'otro',
  cuit text,
  telefono text,
  email text,
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prestadores_nombre_chk CHECK (length(trim(nombre)) > 0),
  CONSTRAINT prestadores_rubro_chk CHECK (rubro IN ('contador', 'redes', 'otro'))
);

CREATE INDEX IF NOT EXISTS prestadores_activo_idx ON public.prestadores (activo);

CREATE TABLE IF NOT EXISTS public.pagos_prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.prestadores (id) ON DELETE RESTRICT,
  fecha date NOT NULL DEFAULT (CURRENT_DATE),
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'ars',
  metodo text NOT NULL DEFAULT 'transferencia',
  descripcion text,
  movimiento_id uuid REFERENCES public.movimientos_caja (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_prestadores_moneda_chk CHECK (moneda IN ('ars', 'usd')),
  CONSTRAINT pagos_prestadores_metodo_chk CHECK (metodo IN ('efectivo', 'transferencia', 'cheque')),
  CONSTRAINT pagos_prestadores_monto_chk CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS pagos_prestadores_prestador_idx ON public.pagos_prestadores (prestador_id);
CREATE INDEX IF NOT EXISTS pagos_prestadores_fecha_idx ON public.pagos_prestadores (fecha DESC);

CREATE TABLE IF NOT EXISTS public.gastos_fijos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto text NOT NULL,
  descripcion text NOT NULL,
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'ars',
  metodo text NOT NULL DEFAULT 'transferencia',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gastos_fijos_concepto_chk CHECK (concepto IN ('alquiler', 'luz', 'gas', 'impuestos')),
  CONSTRAINT gastos_fijos_moneda_chk CHECK (moneda IN ('ars', 'usd')),
  CONSTRAINT gastos_fijos_metodo_chk CHECK (metodo IN ('efectivo', 'transferencia', 'cheque', 'tarjeta')),
  CONSTRAINT gastos_fijos_monto_chk CHECK (monto > 0),
  CONSTRAINT gastos_fijos_descripcion_chk CHECK (length(trim(descripcion)) > 0)
);

CREATE INDEX IF NOT EXISTS gastos_fijos_activo_idx ON public.gastos_fijos (activo);

ALTER TABLE public.movimientos_caja
  DROP CONSTRAINT IF EXISTS movimientos_caja_concepto_check;

ALTER TABLE public.movimientos_caja
  ADD CONSTRAINT movimientos_caja_concepto_check
  CHECK (concepto IN (
    'trabajo',
    'insumos',
    'gastos',
    'sueldos',
    'otro',
    'transferencia',
    'alquiler',
    'luz',
    'gas',
    'impuestos',
    'prestadores'
  ));

UPDATE public.ordenes_trabajo
SET
  bloqueada = false,
  motivo_bloqueo = NULL,
  actualizado_en = now()
WHERE bloqueada = true
  AND motivo_bloqueo = 'Bacha pendiente'
  AND etapa = 'corte';

ALTER TABLE public.nafe_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_fijos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nafe_opciones_select_auth" ON public.nafe_opciones;
DROP POLICY IF EXISTS "nafe_opciones_write_auth" ON public.nafe_opciones;
CREATE POLICY "nafe_opciones_select_auth" ON public.nafe_opciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "nafe_opciones_write_auth" ON public.nafe_opciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "incentivos_select_auth" ON public.incentivos;
DROP POLICY IF EXISTS "incentivos_write_auth" ON public.incentivos;
CREATE POLICY "incentivos_select_auth" ON public.incentivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "incentivos_write_auth" ON public.incentivos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "prestadores_select_auth" ON public.prestadores;
DROP POLICY IF EXISTS "prestadores_write_auth" ON public.prestadores;
CREATE POLICY "prestadores_select_auth" ON public.prestadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "prestadores_write_auth" ON public.prestadores FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pagos_prestadores_select_auth" ON public.pagos_prestadores;
DROP POLICY IF EXISTS "pagos_prestadores_write_auth" ON public.pagos_prestadores;
CREATE POLICY "pagos_prestadores_select_auth" ON public.pagos_prestadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "pagos_prestadores_write_auth" ON public.pagos_prestadores FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gastos_fijos_select_auth" ON public.gastos_fijos;
DROP POLICY IF EXISTS "gastos_fijos_write_auth" ON public.gastos_fijos;
CREATE POLICY "gastos_fijos_select_auth" ON public.gastos_fijos FOR SELECT TO authenticated USING (true);
CREATE POLICY "gastos_fijos_write_auth" ON public.gastos_fijos FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nafe_opciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incentivos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestadores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_prestadores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos_fijos TO authenticated;
GRANT ALL ON public.nafe_opciones TO service_role;
GRANT ALL ON public.incentivos TO service_role;
GRANT ALL ON public.prestadores TO service_role;
GRANT ALL ON public.pagos_prestadores TO service_role;
GRANT ALL ON public.gastos_fijos TO service_role;
