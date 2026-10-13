-- Exportaciones: expediente de venta al exterior (aparte de importaciones).

DO $$ BEGIN
  CREATE TYPE public.exportacion_estado AS ENUM (
    'pedido',
    'facturada',
    'embarcada',
    'cobrada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.exportaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  descripcion text NOT NULL,
  pais_destino text,
  nro_pedido text,
  fecha_pedido date,
  nro_factura text,
  fecha_factura date,
  monto_factura numeric,
  moneda text NOT NULL DEFAULT 'usd',
  medio_transporte text,
  nro_bl text,
  fecha_embarque date,
  estado public.exportacion_estado NOT NULL DEFAULT 'pedido',
  banco_nombre text,
  banco_cuenta text,
  cuenta_id uuid REFERENCES public.cuentas_financieras(id) ON DELETE SET NULL,
  fecha_cobro date,
  movimiento_id uuid REFERENCES public.movimientos_caja(id) ON DELETE SET NULL,
  notas text,
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exportaciones_moneda_check CHECK (moneda = ANY (ARRAY['ars', 'usd'])),
  CONSTRAINT exportaciones_medio_transporte_check CHECK (
    medio_transporte IS NULL OR medio_transporte IN ('maritimo', 'aereo', 'terrestre')
  ),
  CONSTRAINT exportaciones_monto_check CHECK (monto_factura IS NULL OR monto_factura >= 0)
);

CREATE TABLE IF NOT EXISTS public.exportacion_gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exportacion_id uuid NOT NULL REFERENCES public.exportaciones(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'usd',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exportacion_gastos_concepto_check CHECK (
    concepto = ANY (ARRAY[
      'valor_mercaderia',
      'flete_internacional',
      'seguro',
      'gasto_despachante',
      'otro'
    ])
  ),
  CONSTRAINT exportacion_gastos_moneda_check CHECK (moneda = ANY (ARRAY['ars', 'usd'])),
  CONSTRAINT exportacion_gastos_monto_check CHECK (monto > 0)
);

CREATE TABLE IF NOT EXISTS public.exportacion_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exportacion_id uuid NOT NULL REFERENCES public.exportaciones(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  nombre_archivo text NOT NULL,
  url text NOT NULL,
  notas text,
  etapa public.exportacion_estado,
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exportacion_documentos_tipo_check CHECK (
    tipo = ANY (ARRAY[
      'factura',
      'packing_list',
      'bill_of_lading',
      'otro'
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_exportaciones_estado ON public.exportaciones (estado);
CREATE INDEX IF NOT EXISTS idx_exportaciones_client ON public.exportaciones (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exportacion_gastos_exp ON public.exportacion_gastos (exportacion_id);
CREATE INDEX IF NOT EXISTS idx_exportacion_documentos_exp ON public.exportacion_documentos (exportacion_id);
CREATE INDEX IF NOT EXISTS idx_exportacion_documentos_etapa
  ON public.exportacion_documentos (exportacion_id, etapa);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exportaciones_movimiento_id
  ON public.exportaciones (movimiento_id)
  WHERE movimiento_id IS NOT NULL;

-- Un cobro de exportación no se duplica en el libro.
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_caja_exportacion_unica
  ON public.movimientos_caja (referencia_id)
  WHERE referencia_tipo = 'exportacion' AND referencia_id IS NOT NULL;

ALTER TABLE public.exportaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exportacion_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exportacion_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exportaciones_select_auth" ON public.exportaciones;
DROP POLICY IF EXISTS "exportaciones_write_auth" ON public.exportaciones;
CREATE POLICY "exportaciones_select_auth"
  ON public.exportaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "exportaciones_write_auth"
  ON public.exportaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "exportacion_gastos_select_auth" ON public.exportacion_gastos;
DROP POLICY IF EXISTS "exportacion_gastos_write_auth" ON public.exportacion_gastos;
CREATE POLICY "exportacion_gastos_select_auth"
  ON public.exportacion_gastos FOR SELECT TO authenticated USING (true);
CREATE POLICY "exportacion_gastos_write_auth"
  ON public.exportacion_gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "exportacion_documentos_select_auth" ON public.exportacion_documentos;
DROP POLICY IF EXISTS "exportacion_documentos_write_auth" ON public.exportacion_documentos;
CREATE POLICY "exportacion_documentos_select_auth"
  ON public.exportacion_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "exportacion_documentos_write_auth"
  ON public.exportacion_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exportacion-documentos',
  'exportacion-documentos',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "exportacion_documentos_select_authenticated" ON storage.objects;
CREATE POLICY "exportacion_documentos_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exportacion-documentos');

DROP POLICY IF EXISTS "exportacion_documentos_insert_authenticated" ON storage.objects;
CREATE POLICY "exportacion_documentos_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exportacion-documentos');

DROP POLICY IF EXISTS "exportacion_documentos_update_authenticated" ON storage.objects;
CREATE POLICY "exportacion_documentos_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'exportacion-documentos')
  WITH CHECK (bucket_id = 'exportacion-documentos');

DROP POLICY IF EXISTS "exportacion_documentos_delete_authenticated" ON storage.objects;
CREATE POLICY "exportacion_documentos_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'exportacion-documentos');
