export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type JobStatus = "pending" | "in_progress" | "done" | "cancelled";
export type InvoiceStatus = "draft" | "issued" | "paid" | "void";
export type ProfileRole = "admin" | "staff" | "sales";
export type InventorySlabEstado = "Disponible" | "Reservada" | "Usada" | "Baja" | "Bloqueada" | "Prevista";
export type RoturaTipoDb = "chapa" | "pieza";
export type RoturaMomentoDb = "corte" | "instalacion" | "viaje" | "otro";
export type OrigenPlaca = "nacional" | "importado" | "cantera" | "otro";
export type MaterialKindDb = "marmol" | "otra_piedra" | "agglomerado_otro";
/** `piedra` = chapa que se elige al presupuestar; `producto` = producto de cantera que se vende como artículo. */
export type MaterialUsoDb = "piedra" | "producto";
export type BachaOrigen = "propia" | "cliente";
export type BachaInventarioEstado = "disponible" | "asignada" | "usada" | "baja";
export type PresupuestoEstado = "pendiente" | "aprobado" | "rechazado";
export type MedicionEstado =
  | "sin_solicitar"
  | "listo_para_medir"
  | "medido"
  | "no_requiere";
export type VentaEstado =
  | "senado"
  | "en_medicion"
  | "en_produccion"
  | "finalizado"
  | "entregado";
export type EtapaOtKanban = "medicion" | "corte" | "produccion" | "despacho";
export type OtTipo = "normal" | "reposicion";
export type TipoEntregaOt = "retira" | "logistica" | "colocacion";
export type PlanificacionEventoTipo = "entrega" | "medicion" | "tarea";
export type PlanificacionEventoEstado = "pendiente" | "hecho" | "cancelado";
export type UnidadArticuloDb = "M2" | "ML" | "UNI" | "PIEZA" | "KG" | "TON";
export type RolOperativo =
  | "vendedor"
  | "medidor"
  | "cortador"
  | "produccion"
  | "instalador"
  | "reparador"
  | "administracion"
  | "admin";
export type ImportacionEstado =
  | "orden_compra"
  | "embarque"
  | "en_transito"
  | "en_aduana"
  | "nacionalizada"
  | "en_deposito";
export type ImportacionMedioTransporte = "maritimo" | "aereo" | "terrestre";
export type ImportacionGastoConcepto =
  | "valor_mercaderia"
  | "flete_internacional"
  | "seguro"
  | "derechos_importacion"
  | "iva_importacion"
  | "ingresos_brutos"
  | "percepcion_ganancias"
  | "gasto_despachante"
  | "flete_local"
  | "otro";
export type ImportacionDocumentoTipo =
  | "factura_provisoria"
  | "factura_definitiva"
  | "despacho"
  | "bill_of_lading"
  | "packing_list"
  | "otro";
export type ExportacionEstado = "pedido" | "facturada" | "embarcada" | "cobrada";
export type ExportacionGastoConcepto =
  | "valor_mercaderia"
  | "flete_internacional"
  | "seguro"
  | "gasto_despachante"
  | "otro";
export type ExportacionDocumentoTipo = "factura" | "packing_list" | "bill_of_lading" | "otro";
export type LiquidacionEstado = "borrador" | "cerrada";
export type LiquidacionConceptoTipo =
  | "sueldo_base"
  | "comision"
  | "hora_extra"
  | "instalacion"
  | "flete"
  | "adelanto"
  | "descuento"
  | "carga_social"
  | "otro";
export type AdelantoMetodo = "efectivo" | "transferencia";
export type EmpleadoDocumentoTipo =
  | "certificado_medico"
  | "contrato"
  | "dni"
  | "cuil"
  | "otro";
export type ConceptoMovimientoDb =
  | "trabajo"
  | "insumos"
  | "gastos"
  | "sueldos"
  | "otro"
  | "transferencia"
  | "alquiler"
  | "luz"
  | "gas"
  | "impuestos"
  | "prestadores";
export type IncentivoTipo = "comision" | "premio" | "bono";
export type PrestadorRubro = "contador" | "redes" | "otro";
export type GastoFijoConcepto = "alquiler" | "luz" | "gas" | "impuestos";

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          full_name: string | null;
          role: ProfileRole;
          created_at: string;
          guias_vistas: string[];
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
          guias_vistas?: string[];
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
          guias_vistas?: string[];
        };
        Relationships: [];
      };
      empleados: {
        Row: {
          id: string;
          usuario_id: string | null;
          nombre: string;
          apellido: string;
          dni: string | null;
          cuil: string | null;
          telefono: string | null;
          email: string | null;
          fecha_ingreso: string | null;
          puesto: string | null;
          sueldo_base: number;
          activo: boolean;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id?: string | null;
          nombre: string;
          apellido: string;
          dni?: string | null;
          cuil?: string | null;
          telefono?: string | null;
          email?: string | null;
          fecha_ingreso?: string | null;
          puesto?: string | null;
          sueldo_base?: number;
          activo?: boolean;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string | null;
          nombre?: string;
          apellido?: string;
          dni?: string | null;
          cuil?: string | null;
          telefono?: string | null;
          email?: string | null;
          fecha_ingreso?: string | null;
          puesto?: string | null;
          sueldo_base?: number;
          activo?: boolean;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "empleados_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      nafe_opciones: {
        Row: {
          id: string;
          etiqueta: string;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          etiqueta: string;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          etiqueta?: string;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      incentivos: {
        Row: {
          id: string;
          empleado_id: string;
          fecha: string;
          tipo: IncentivoTipo;
          descripcion: string | null;
          monto: number;
          moneda: "ars" | "usd";
          metodo: "efectivo" | "transferencia" | "cheque";
          movimiento_id: string | null;
          notas: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          fecha?: string;
          tipo?: IncentivoTipo;
          descripcion?: string | null;
          monto: number;
          moneda?: "ars" | "usd";
          metodo?: "efectivo" | "transferencia" | "cheque";
          movimiento_id?: string | null;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          fecha?: string;
          tipo?: IncentivoTipo;
          descripcion?: string | null;
          monto?: number;
          moneda?: "ars" | "usd";
          metodo?: "efectivo" | "transferencia" | "cheque";
          movimiento_id?: string | null;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incentivos_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incentivos_movimiento_id_fkey";
            columns: ["movimiento_id"];
            isOneToOne: false;
            referencedRelation: "movimientos_caja";
            referencedColumns: ["id"];
          },
        ];
      };
      prestadores: {
        Row: {
          id: string;
          nombre: string;
          rubro: PrestadorRubro;
          cuit: string | null;
          telefono: string | null;
          email: string | null;
          activo: boolean;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          rubro?: PrestadorRubro;
          cuit?: string | null;
          telefono?: string | null;
          email?: string | null;
          activo?: boolean;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          rubro?: PrestadorRubro;
          cuit?: string | null;
          telefono?: string | null;
          email?: string | null;
          activo?: boolean;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pagos_prestadores: {
        Row: {
          id: string;
          prestador_id: string;
          fecha: string;
          monto: number;
          moneda: "ars" | "usd";
          metodo: "efectivo" | "transferencia" | "cheque";
          descripcion: string | null;
          movimiento_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prestador_id: string;
          fecha?: string;
          monto: number;
          moneda?: "ars" | "usd";
          metodo?: "efectivo" | "transferencia" | "cheque";
          descripcion?: string | null;
          movimiento_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          prestador_id?: string;
          fecha?: string;
          monto?: number;
          moneda?: "ars" | "usd";
          metodo?: "efectivo" | "transferencia" | "cheque";
          descripcion?: string | null;
          movimiento_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_prestadores_prestador_id_fkey";
            columns: ["prestador_id"];
            isOneToOne: false;
            referencedRelation: "prestadores";
            referencedColumns: ["id"];
          },
        ];
      };
      gastos_fijos: {
        Row: {
          id: string;
          concepto: GastoFijoConcepto;
          descripcion: string;
          monto: number;
          moneda: "ars" | "usd";
          metodo: "efectivo" | "transferencia" | "cheque" | "tarjeta";
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          concepto: GastoFijoConcepto;
          descripcion: string;
          monto: number;
          moneda?: "ars" | "usd";
          metodo?: "efectivo" | "transferencia" | "cheque" | "tarjeta";
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          concepto?: GastoFijoConcepto;
          descripcion?: string;
          monto?: number;
          moneda?: "ars" | "usd";
          metodo?: "efectivo" | "transferencia" | "cheque" | "tarjeta";
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      adelantos_empleado: {
        Row: {
          id: string;
          empleado_id: string;
          liquidacion_id: string | null;
          monto: number;
          fecha: string;
          metodo: AdelantoMetodo;
          notas: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          liquidacion_id?: string | null;
          monto: number;
          fecha?: string;
          metodo?: AdelantoMetodo;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          liquidacion_id?: string | null;
          monto?: number;
          fecha?: string;
          metodo?: AdelantoMetodo;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "adelantos_empleado_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adelantos_empleado_liquidacion_id_fkey";
            columns: ["liquidacion_id"];
            isOneToOne: false;
            referencedRelation: "liquidaciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adelantos_empleado_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      planificacion_eventos: {
        Row: {
          id: string;
          tipo: PlanificacionEventoTipo;
          ot_id: string | null;
          medicion_id: string | null;
          venta_id: string | null;
          fecha: string;
          hora_desde: string | null;
          hora_hasta: string | null;
          titulo: string | null;
          direccion: string | null;
          notas: string | null;
          estado: PlanificacionEventoEstado;
          hecho_en: string | null;
          hecho_por: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tipo: PlanificacionEventoTipo;
          ot_id?: string | null;
          medicion_id?: string | null;
          venta_id?: string | null;
          fecha: string;
          hora_desde?: string | null;
          hora_hasta?: string | null;
          titulo?: string | null;
          direccion?: string | null;
          notas?: string | null;
          estado?: PlanificacionEventoEstado;
          hecho_en?: string | null;
          hecho_por?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tipo?: PlanificacionEventoTipo;
          ot_id?: string | null;
          medicion_id?: string | null;
          venta_id?: string | null;
          fecha?: string;
          hora_desde?: string | null;
          hora_hasta?: string | null;
          titulo?: string | null;
          direccion?: string | null;
          notas?: string | null;
          estado?: PlanificacionEventoEstado;
          hecho_en?: string | null;
          hecho_por?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planificacion_eventos_ot_id_fkey";
            columns: ["ot_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_trabajo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planificacion_eventos_medicion_id_fkey";
            columns: ["medicion_id"];
            isOneToOne: false;
            referencedRelation: "presupuesto_mediciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planificacion_eventos_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      planificacion_evento_empleados: {
        Row: {
          evento_id: string;
          empleado_id: string;
        };
        Insert: {
          evento_id: string;
          empleado_id: string;
        };
        Update: {
          evento_id?: string;
          empleado_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planificacion_evento_empleados_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "planificacion_eventos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planificacion_evento_empleados_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
        ];
      };
      vacaciones_empleado: {
        Row: {
          id: string;
          empleado_id: string;
          desde: string;
          hasta: string;
          dias: number;
          notas: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          desde: string;
          hasta: string;
          dias: number;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          desde?: string;
          hasta?: string;
          dias?: number;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacaciones_empleado_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
        ];
      };
      empleado_documentos: {
        Row: {
          id: string;
          empleado_id: string;
          tipo: EmpleadoDocumentoTipo;
          nombre: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          tipo?: EmpleadoDocumentoTipo;
          nombre: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          tipo?: EmpleadoDocumentoTipo;
          nombre?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "empleado_documentos_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
        ];
      };
      liquidaciones: {
        Row: {
          id: string;
          empleado_id: string;
          periodo_mes: number;
          periodo_anio: number;
          estado: LiquidacionEstado;
          total_bruto: number;
          total_descuentos: number;
          total_neto: number;
          pago_efectivo_15: number;
          pago_banco_30: number;
          pago_efectivo_30: number;
          fecha_cierre: string | null;
          notas: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          periodo_mes: number;
          periodo_anio: number;
          estado?: LiquidacionEstado;
          total_bruto?: number;
          total_descuentos?: number;
          total_neto?: number;
          pago_efectivo_15?: number;
          pago_banco_30?: number;
          pago_efectivo_30?: number;
          fecha_cierre?: string | null;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          periodo_mes?: number;
          periodo_anio?: number;
          estado?: LiquidacionEstado;
          total_bruto?: number;
          total_descuentos?: number;
          total_neto?: number;
          pago_efectivo_15?: number;
          pago_banco_30?: number;
          pago_efectivo_30?: number;
          fecha_cierre?: string | null;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "liquidaciones_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "liquidaciones_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      liquidacion_conceptos: {
        Row: {
          id: string;
          liquidacion_id: string;
          tipo: LiquidacionConceptoTipo;
          descripcion: string;
          monto: number;
          referencia_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          liquidacion_id: string;
          tipo: LiquidacionConceptoTipo;
          descripcion: string;
          monto: number;
          referencia_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          liquidacion_id?: string;
          tipo?: LiquidacionConceptoTipo;
          descripcion?: string;
          monto?: number;
          referencia_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "liquidacion_conceptos_liquidacion_id_fkey";
            columns: ["liquidacion_id"];
            isOneToOne: false;
            referencedRelation: "liquidaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      liquidacion_pagos: {
        Row: {
          id: string;
          liquidacion_id: string;
          fecha: string;
          monto: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          liquidacion_id: string;
          fecha: string;
          monto: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          liquidacion_id?: string;
          fecha?: string;
          monto?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "liquidacion_pagos_liquidacion_id_fkey";
            columns: ["liquidacion_id"];
            isOneToOne: false;
            referencedRelation: "liquidaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          es_agente_retencion: boolean;
          retencion_porcentaje: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          es_agente_retencion?: boolean;
          retencion_porcentaje?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          es_agente_retencion?: boolean;
          retencion_porcentaje?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          name: string;
          unit: string;
          stock_qty: number;
          reorder_level: number | null;
          notes: string | null;
          created_at: string;
          material_kind: MaterialKindDb;
          peso_por_m2_kg: number | null;
          espesor_mm: number | null;
          bulk_stock_kg: number;
          familia: string | null;
          codigo: string | null;
          costo_usd: number | null;
          uso: MaterialUsoDb;
        };
        Insert: {
          id?: string;
          name: string;
          unit?: string;
          stock_qty?: number;
          reorder_level?: number | null;
          notes?: string | null;
          created_at?: string;
          material_kind?: MaterialKindDb;
          peso_por_m2_kg?: number | null;
          espesor_mm?: number | null;
          bulk_stock_kg?: number;
          familia?: string | null;
          codigo?: string | null;
          costo_usd?: number | null;
          uso?: MaterialUsoDb;
        };
        Update: {
          id?: string;
          name?: string;
          unit?: string;
          stock_qty?: number;
          reorder_level?: number | null;
          notes?: string | null;
          created_at?: string;
          material_kind?: MaterialKindDb;
          peso_por_m2_kg?: number | null;
          espesor_mm?: number | null;
          bulk_stock_kg?: number;
          familia?: string | null;
          codigo?: string | null;
          costo_usd?: number | null;
          uso?: MaterialUsoDb;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          client_id: string;
          status: QuoteStatus;
          title: string | null;
          valid_until: string | null;
          notes: string | null;
          total_cents: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          status?: QuoteStatus;
          title?: string | null;
          valid_until?: string | null;
          notes?: string | null;
          total_cents?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          status?: QuoteStatus;
          title?: string | null;
          valid_until?: string | null;
          notes?: string | null;
          total_cents?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      ordenes_trabajo: {
        Row: {
          id: string;
          id_cotizacion: string | null;
          id_cliente: string | null;
          titulo: string;
          estado: JobStatus;
          fecha_programada: string | null;
          notas: string | null;
          creado_en: string;
          actualizado_en: string;
          venta_id: string | null;
          etapa: EtapaOtKanban | string;
          pausada: boolean;
          medidas_confirmadas: boolean;
          fecha_medidas_confirmadas: string | null;
          requiere_reserva_stock: boolean;
          bloqueada: boolean;
          motivo_bloqueo: string | null;
          orden_key: string | null;
          tipo: OtTipo;
          ot_origen_id: string | null;
          bacha_requerida: boolean;
          bacha_origen: BachaOrigen | null;
          bacha_tipo: string | null;
          bacha_colocacion: string | null;
          bacha_id: string | null;
          nafe: string | null;
          plan_corte: Json | null;
          tipo_entrega: TipoEntregaOt;
          entregada_en: string | null;
        };
        Insert: {
          id?: string;
          id_cotizacion?: string | null;
          id_cliente?: string | null;
          titulo: string;
          estado?: JobStatus;
          fecha_programada?: string | null;
          notas?: string | null;
          creado_en?: string;
          actualizado_en?: string;
          venta_id?: string | null;
          etapa?: EtapaOtKanban | string;
          pausada?: boolean;
          medidas_confirmadas?: boolean;
          fecha_medidas_confirmadas?: string | null;
          requiere_reserva_stock?: boolean;
          bloqueada?: boolean;
          motivo_bloqueo?: string | null;
          orden_key?: string | null;
          tipo?: OtTipo;
          ot_origen_id?: string | null;
          bacha_requerida?: boolean;
          bacha_origen?: BachaOrigen | null;
          bacha_tipo?: string | null;
          bacha_colocacion?: string | null;
          bacha_id?: string | null;
          nafe?: string | null;
          plan_corte?: Json | null;
          tipo_entrega?: TipoEntregaOt;
          entregada_en?: string | null;
        };
        Update: {
          id?: string;
          id_cotizacion?: string | null;
          id_cliente?: string | null;
          titulo?: string;
          estado?: JobStatus;
          fecha_programada?: string | null;
          notas?: string | null;
          creado_en?: string;
          actualizado_en?: string;
          venta_id?: string | null;
          etapa?: EtapaOtKanban | string;
          pausada?: boolean;
          medidas_confirmadas?: boolean;
          fecha_medidas_confirmadas?: string | null;
          requiere_reserva_stock?: boolean;
          bloqueada?: boolean;
          motivo_bloqueo?: string | null;
          orden_key?: string | null;
          tipo?: OtTipo;
          ot_origen_id?: string | null;
          bacha_requerida?: boolean;
          bacha_origen?: BachaOrigen | null;
          bacha_tipo?: string | null;
          bacha_colocacion?: string | null;
          bacha_id?: string | null;
          nafe?: string | null;
          plan_corte?: Json | null;
          tipo_entrega?: TipoEntregaOt;
          entregada_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ordenes_trabajo_id_cliente_fkey";
            columns: ["id_cliente"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_trabajo_id_cotizacion_fkey";
            columns: ["id_cotizacion"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_trabajo_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_trabajo_ot_origen_id_fkey";
            columns: ["ot_origen_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_trabajo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordenes_trabajo_bacha_id_fkey";
            columns: ["bacha_id"];
            isOneToOne: false;
            referencedRelation: "bachas_inventario";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          client_id: string;
          job_id: string | null;
          quote_id: string | null;
          status: InvoiceStatus;
          issue_date: string | null;
          due_date: string | null;
          subtotal_cents: number;
          tax_cents: number;
          total_cents: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          job_id?: string | null;
          quote_id?: string | null;
          status?: InvoiceStatus;
          issue_date?: string | null;
          due_date?: string | null;
          subtotal_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          job_id?: string | null;
          quote_id?: string | null;
          status?: InvoiceStatus;
          issue_date?: string | null;
          due_date?: string | null;
          subtotal_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_trabajo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          cuit: string | null;
          tax_condition: string | null;
          address: string | null;
          postal_code: string | null;
          province: string | null;
          locality: string | null;
          rubros: string[];
          origen: "nacional" | "exterior" | "propio";
          pais: string | null;
          contact_name: string | null;
          notes: string | null;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          cuit?: string | null;
          tax_condition?: string | null;
          address?: string | null;
          postal_code?: string | null;
          province?: string | null;
          locality?: string | null;
          rubros?: string[];
          origen?: "nacional" | "exterior" | "propio";
          pais?: string | null;
          contact_name?: string | null;
          notes?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          cuit?: string | null;
          tax_condition?: string | null;
          address?: string | null;
          postal_code?: string | null;
          province?: string | null;
          locality?: string | null;
          rubros?: string[];
          origen?: "nacional" | "exterior" | "propio";
          pais?: string | null;
          contact_name?: string | null;
          notes?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      remitos: {
        Row: {
          id: string;
          supplier_id: string;
          branch_code: string;
          serial_code: string;
          issue_date: string;
          notes: string | null;
          origen_placa: OrigenPlaca;
          importacion_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          branch_code?: string;
          serial_code?: string;
          issue_date: string;
          notes?: string | null;
          origen_placa?: OrigenPlaca;
          importacion_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          branch_code?: string;
          serial_code?: string;
          issue_date?: string;
          notes?: string | null;
          origen_placa?: OrigenPlaca;
          importacion_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "remitos_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "remitos_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "remitos_importacion_id_fkey";
            columns: ["importacion_id"];
            isOneToOne: false;
            referencedRelation: "importaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      remito_lines: {
        Row: {
          id: string;
          remito_id: string;
          material_id: string | null;
          material_label: string;
          qty_slabs: number;
          largo_cm: number | null;
          ancho_cm: number | null;
          precio_unitario: number | null;
          sort_order: number;
          lote_codigo: string | null;
          origen_placa: OrigenPlaca;
          modo_medidas: "iguales" | "distintas";
          m2_total: number;
        };
        Insert: {
          id?: string;
          remito_id: string;
          material_id?: string | null;
          material_label: string;
          qty_slabs: number;
          largo_cm?: number | null;
          ancho_cm?: number | null;
          precio_unitario?: number | null;
          sort_order?: number;
          lote_codigo?: string | null;
          origen_placa?: OrigenPlaca;
          modo_medidas?: "iguales" | "distintas";
          m2_total?: number;
        };
        Update: {
          id?: string;
          remito_id?: string;
          material_id?: string | null;
          material_label?: string;
          qty_slabs?: number;
          largo_cm?: number | null;
          ancho_cm?: number | null;
          precio_unitario?: number | null;
          sort_order?: number;
          lote_codigo?: string | null;
          origen_placa?: OrigenPlaca;
          modo_medidas?: "iguales" | "distintas";
          m2_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "remito_lines_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "remito_lines_remito_id_fkey";
            columns: ["remito_id"];
            isOneToOne: false;
            referencedRelation: "remitos";
            referencedColumns: ["id"];
          },
        ];
      };
      lotes_cantera: {
        Row: {
          id: string;
          material_id: string;
          qty_kg_remaining: number;
          qty_kg_initial: number;
          purchase_uom: string;
          supplier_id: string | null;
          receipt_ref: string | null;
          notes: string | null;
          issue_date: string;
          largo_cm: number | null;
          ancho_cm: number | null;
          espesor_cm: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          qty_kg_remaining: number;
          qty_kg_initial: number;
          purchase_uom?: string;
          supplier_id?: string | null;
          receipt_ref?: string | null;
          notes?: string | null;
          issue_date?: string;
          largo_cm?: number | null;
          ancho_cm?: number | null;
          espesor_cm?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          material_id?: string;
          qty_kg_remaining?: number;
          qty_kg_initial?: number;
          purchase_uom?: string;
          supplier_id?: string | null;
          receipt_ref?: string | null;
          notes?: string | null;
          issue_date?: string;
          largo_cm?: number | null;
          ancho_cm?: number | null;
          espesor_cm?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lotes_cantera_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lotes_cantera_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lotes_cantera_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      conversiones_materiales: {
        Row: {
          id: string;
          parent_material_id: string;
          child_material_id: string;
          kg_parent_per_m2_child: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_material_id: string;
          child_material_id: string;
          kg_parent_per_m2_child: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_material_id?: string;
          child_material_id?: string;
          kg_parent_per_m2_child?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversiones_materiales_parent_material_id_fkey";
            columns: ["parent_material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversiones_materiales_child_material_id_fkey";
            columns: ["child_material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      procesamientos_cantera: {
        Row: {
          id: string;
          lote_id: string;
          material_bruto_id: string;
          qty_kg_consumidos: number;
          issue_date: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lote_id: string;
          material_bruto_id: string;
          qty_kg_consumidos: number;
          issue_date?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lote_id?: string;
          material_bruto_id?: string;
          qty_kg_consumidos?: number;
          issue_date?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "procesamientos_cantera_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes_cantera";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "procesamientos_cantera_material_bruto_id_fkey";
            columns: ["material_bruto_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "procesamientos_cantera_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      procesamiento_lineas: {
        Row: {
          id: string;
          procesamiento_id: string;
          material_producto_id: string;
          cantidad: number;
          unit: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          procesamiento_id: string;
          material_producto_id: string;
          cantidad: number;
          unit: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          procesamiento_id?: string;
          material_producto_id?: string;
          cantidad?: number;
          unit?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "procesamiento_lineas_procesamiento_id_fkey";
            columns: ["procesamiento_id"];
            isOneToOne: false;
            referencedRelation: "procesamientos_cantera";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "procesamiento_lineas_material_producto_id_fkey";
            columns: ["material_producto_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      chapas_inventario: {
        Row: {
          id: string;
          remito_line_id: string | null;
          bulto: string;
          material_id: string | null;
          material_label: string;
          largo_cm: number;
          ancho_cm: number;
          espesor_cm: number | null;
          estado: InventorySlabEstado;
          lote_codigo: string | null;
          ot_reserva_id: string | null;
          motivo_estado: string | null;
          chapa_origen_id: string | null;
          origen_placa: OrigenPlaca;
          rotura_tipo: RoturaTipoDb | null;
          rotura_momento: RoturaMomentoDb | null;
          ot_rotura_id: string | null;
          cliente_rotura: string | null;
          precio_m2: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          remito_line_id?: string | null;
          bulto: string;
          material_id?: string | null;
          material_label: string;
          largo_cm: number;
          ancho_cm: number;
          espesor_cm?: number | null;
          estado?: InventorySlabEstado;
          lote_codigo?: string | null;
          ot_reserva_id?: string | null;
          motivo_estado?: string | null;
          chapa_origen_id?: string | null;
          origen_placa?: OrigenPlaca;
          rotura_tipo?: RoturaTipoDb | null;
          rotura_momento?: RoturaMomentoDb | null;
          ot_rotura_id?: string | null;
          cliente_rotura?: string | null;
          precio_m2?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          remito_line_id?: string | null;
          bulto?: string;
          material_id?: string | null;
          material_label?: string;
          largo_cm?: number;
          ancho_cm?: number;
          espesor_cm?: number | null;
          estado?: InventorySlabEstado;
          lote_codigo?: string | null;
          ot_reserva_id?: string | null;
          motivo_estado?: string | null;
          chapa_origen_id?: string | null;
          origen_placa?: OrigenPlaca;
          rotura_tipo?: RoturaTipoDb | null;
          rotura_momento?: RoturaMomentoDb | null;
          ot_rotura_id?: string | null;
          cliente_rotura?: string | null;
          precio_m2?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chapas_inventario_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chapas_inventario_remito_line_id_fkey";
            columns: ["remito_line_id"];
            isOneToOne: false;
            referencedRelation: "remito_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chapas_inventario_ot_reserva_fkey";
            columns: ["ot_reserva_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_trabajo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chapas_inventario_ot_rotura_id_fkey";
            columns: ["ot_rotura_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_trabajo";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movimientos: {
        Row: {
          id: string;
          chapa_id: string | null;
          ot_id: string | null;
          tipo: "reserva" | "liberacion" | "consumo" | "baja" | "retazo_alta" | "bloqueo";
          detalle: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chapa_id?: string | null;
          ot_id?: string | null;
          tipo: "reserva" | "liberacion" | "consumo" | "baja" | "retazo_alta" | "bloqueo";
          detalle?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chapa_id?: string | null;
          ot_id?: string | null;
          tipo?: "reserva" | "liberacion" | "consumo" | "baja" | "retazo_alta" | "bloqueo";
          detalle?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ot_stock_unidades: {
        Row: {
          id: string;
          ot_id: string;
          material_id: string;
          qty_reservada: number;
          qty_consumida: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ot_id: string;
          material_id: string;
          qty_reservada?: number;
          qty_consumida?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ot_id?: string;
          material_id?: string;
          qty_reservada?: number;
          qty_consumida?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ot_stock_unidades_ot_id_fkey";
            columns: ["ot_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_trabajo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ot_stock_unidades_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      presupuestos: {
        Row: {
          id: string;
          numero: string;
          cliente: string;
          client_id: string | null;
          total: number;
          moneda: "ars" | "usd";
          status: PresupuestoEstado;
          payload: Json;
          nro_version: number;
          lista_precio_id: string | null;
          cotizacion_usd: number | null;
          descuento_global: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          numero: string;
          cliente?: string;
          client_id?: string | null;
          total?: number;
          moneda: "ars" | "usd";
          status?: PresupuestoEstado;
          payload?: Json;
          nro_version?: number;
          lista_precio_id?: string | null;
          cotizacion_usd?: number | null;
          descuento_global?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          numero?: string;
          cliente?: string;
          client_id?: string | null;
          total?: number;
          moneda?: "ars" | "usd";
          status?: PresupuestoEstado;
          payload?: Json;
          nro_version?: number;
          lista_precio_id?: string | null;
          cotizacion_usd?: number | null;
          descuento_global?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presupuestos_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presupuestos_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      seguimiento_presupuestos: {
        Row: {
          id: string;
          presupuesto_id: string;
        };
        Insert: {
          id?: string;
          presupuesto_id: string;
        };
        Update: {
          id?: string;
          presupuesto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seguimiento_presupuestos_presupuesto_id_fkey";
            columns: ["presupuesto_id"];
            isOneToOne: false;
            referencedRelation: "presupuestos";
            referencedColumns: ["id"];
          },
        ];
      };
      comisiones: {
        Row: {
          id: string;
          presupuesto_id: string;
        };
        Insert: {
          id?: string;
          presupuesto_id: string;
        };
        Update: {
          id?: string;
          presupuesto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comisiones_presupuesto_id_fkey";
            columns: ["presupuesto_id"];
            isOneToOne: false;
            referencedRelation: "presupuestos";
            referencedColumns: ["id"];
          },
        ];
      };
      presupuesto_mediciones: {
        Row: {
          id: string;
          presupuesto_id: string;
          estado: MedicionEstado;
          solicitado_por: string | null;
          solicitado_en: string | null;
          fecha_programada: string | null;
          medido_por: string | null;
          medido_en: string | null;
          motivo_salto: string | null;
          notas: string | null;
          conformidad_pendiente: boolean;
          conformidad_total_anterior: number | null;
          conformidad_total_nuevo: number | null;
          conformidad_en: string | null;
          conformidad_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          presupuesto_id: string;
          estado?: MedicionEstado;
          solicitado_por?: string | null;
          solicitado_en?: string | null;
          fecha_programada?: string | null;
          medido_por?: string | null;
          medido_en?: string | null;
          motivo_salto?: string | null;
          notas?: string | null;
          conformidad_pendiente?: boolean;
          conformidad_total_anterior?: number | null;
          conformidad_total_nuevo?: number | null;
          conformidad_en?: string | null;
          conformidad_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          presupuesto_id?: string;
          estado?: MedicionEstado;
          solicitado_por?: string | null;
          solicitado_en?: string | null;
          fecha_programada?: string | null;
          medido_por?: string | null;
          medido_en?: string | null;
          motivo_salto?: string | null;
          notas?: string | null;
          conformidad_pendiente?: boolean;
          conformidad_total_anterior?: number | null;
          conformidad_total_nuevo?: number | null;
          conformidad_en?: string | null;
          conformidad_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presupuesto_mediciones_presupuesto_id_fkey";
            columns: ["presupuesto_id"];
            isOneToOne: true;
            referencedRelation: "presupuestos";
            referencedColumns: ["id"];
          },
        ];
      };
      presupuesto_versiones: {
        Row: {
          id: string;
          presupuesto_id: string;
          nro: number;
          total: number;
          m2: number;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          presupuesto_id: string;
          nro: number;
          total?: number;
          m2?: number;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          presupuesto_id?: string;
          nro?: number;
          total?: number;
          m2?: number;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presupuesto_versiones_presupuesto_id_fkey";
            columns: ["presupuesto_id"];
            isOneToOne: false;
            referencedRelation: "presupuestos";
            referencedColumns: ["id"];
          },
        ];
      };
      presupuesto_eventos_precio: {
        Row: {
          id: string;
          presupuesto_id: string;
          tipo: "primer_precio" | "enviado_pdf" | "version_nueva" | "ajuste";
          monto: number;
          moneda: "ars" | "usd";
          created_at: string;
          created_by: string | null;
          meta: Json;
        };
        Insert: {
          id?: string;
          presupuesto_id: string;
          tipo: "primer_precio" | "enviado_pdf" | "version_nueva" | "ajuste";
          monto?: number;
          moneda?: "ars" | "usd";
          created_at?: string;
          created_by?: string | null;
          meta?: Json;
        };
        Update: {
          id?: string;
          presupuesto_id?: string;
          tipo?: "primer_precio" | "enviado_pdf" | "version_nueva" | "ajuste";
          monto?: number;
          moneda?: "ars" | "usd";
          created_at?: string;
          created_by?: string | null;
          meta?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "presupuesto_eventos_precio_presupuesto_id_fkey";
            columns: ["presupuesto_id"];
            isOneToOne: false;
            referencedRelation: "presupuestos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presupuesto_eventos_precio_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      ventas: {
        Row: {
          id: string;
          presupuesto_id: string;
          estado: VentaEstado;
          fecha_confirmacion_medidas: string | null;
          confirmado_por: string | null;
          notas_medicion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          presupuesto_id: string;
          estado?: VentaEstado;
          fecha_confirmacion_medidas?: string | null;
          confirmado_por?: string | null;
          notas_medicion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          presupuesto_id?: string;
          estado?: VentaEstado;
          fecha_confirmacion_medidas?: string | null;
          confirmado_por?: string | null;
          notas_medicion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ventas_presupuesto_id_fkey";
            columns: ["presupuesto_id"];
            isOneToOne: true;
            referencedRelation: "presupuestos";
            referencedColumns: ["id"];
          },
        ];
      };
      ventas_pagos: {
        Row: {
          id: string;
          venta_id: string;
          monto: string;
          moneda: "ars" | "usd";
          fecha: string;
          metodo: string;
          nota: string | null;
          cuenta_id: string | null;
          retencion_porcentaje: number | null;
          retencion_monto: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venta_id: string;
          monto: string | number;
          moneda: "ars" | "usd";
          fecha: string;
          metodo: string;
          nota?: string | null;
          cuenta_id?: string | null;
          retencion_porcentaje?: number | null;
          retencion_monto?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          venta_id?: string;
          monto?: string | number;
          moneda?: "ars" | "usd";
          fecha?: string;
          metodo?: string;
          nota?: string | null;
          cuenta_id?: string | null;
          retencion_porcentaje?: number | null;
          retencion_monto?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ventas_pagos_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ventas_pagos_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_scraps: {
        Row: {
          id: string;
          accion: string;
          ingreso_tipo: string;
          material_id: string | null;
          material_label: string;
          cantidad: number;
          n_chapa: string | null;
          observacion: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          accion?: string;
          ingreso_tipo: string;
          material_id?: string | null;
          material_label: string;
          cantidad?: number;
          n_chapa?: string | null;
          observacion?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          accion?: string;
          ingreso_tipo?: string;
          material_id?: string | null;
          material_label?: string;
          cantidad?: number;
          n_chapa?: string | null;
          observacion?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_scraps_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_scraps_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      bachas_inventario: {
        Row: {
          id: string;
          origen: BachaOrigen;
          cliente_nombre: string | null;
          cliente_id: string | null;
          modelo: string | null;
          medidas: string | null;
          ubicacion: string | null;
          estado: BachaInventarioEstado;
          ot_id: string | null;
          notas: string | null;
          created_at: string;
          precio_venta: number | null;
          moneda: "ars" | "usd";
        };
        Insert: {
          id?: string;
          origen: BachaOrigen;
          cliente_nombre?: string | null;
          cliente_id?: string | null;
          modelo?: string | null;
          medidas?: string | null;
          ubicacion?: string | null;
          estado?: BachaInventarioEstado;
          ot_id?: string | null;
          notas?: string | null;
          created_at?: string;
          precio_venta?: number | null;
          moneda?: "ars" | "usd";
        };
        Update: {
          id?: string;
          origen?: BachaOrigen;
          cliente_nombre?: string | null;
          cliente_id?: string | null;
          modelo?: string | null;
          medidas?: string | null;
          ubicacion?: string | null;
          estado?: BachaInventarioEstado;
          ot_id?: string | null;
          notas?: string | null;
          created_at?: string;
          precio_venta?: number | null;
          moneda?: "ars" | "usd";
        };
        Relationships: [
          {
            foreignKeyName: "bachas_inventario_ot_id_fkey";
            columns: ["ot_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_trabajo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bachas_inventario_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      articulos: {
        Row: {
          id: string;
          codigo: string;
          descripcion: string;
          unidad: UnidadArticuloDb;
          calcula_material: boolean;
          medida_estandar_m2: number | null;
          prefer_modo_manual: boolean;
          activo: boolean;
          sort_order: number;
          precio: number | null;
          moneda: "ars" | "usd";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          descripcion: string;
          unidad?: UnidadArticuloDb;
          calcula_material?: boolean;
          medida_estandar_m2?: number | null;
          prefer_modo_manual?: boolean;
          activo?: boolean;
          sort_order?: number;
          precio?: number | null;
          moneda?: "ars" | "usd";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          descripcion?: string;
          unidad?: UnidadArticuloDb;
          calcula_material?: boolean;
          medida_estandar_m2?: number | null;
          prefer_modo_manual?: boolean;
          activo?: boolean;
          precio?: number | null;
          moneda?: "ars" | "usd";
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      listas_precio: {
        Row: {
          id: string;
          codigo: string;
          label: string;
          moneda: "ars" | "usd";
          descripcion: string | null;
          activa: boolean;
          vigente_desde: string | null;
          vigente_hasta: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          label: string;
          moneda?: "ars" | "usd";
          descripcion?: string | null;
          activa?: boolean;
          vigente_desde?: string | null;
          vigente_hasta?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          label?: string;
          moneda?: "ars" | "usd";
          descripcion?: string | null;
          activa?: boolean;
          vigente_desde?: string | null;
          vigente_hasta?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuario_roles: {
        Row: {
          id: string;
          usuario_id: string;
          rol: RolOperativo;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          rol: RolOperativo;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          rol?: RolOperativo;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuario_roles_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      listas_precio_materiales: {
        Row: {
          id: string;
          lista_precio_id: string;
          material_id: string;
          precio: number;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lista_precio_id: string;
          material_id: string;
          precio: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lista_precio_id?: string;
          material_id?: string;
          precio?: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listas_precio_materiales_lista_precio_id_fkey";
            columns: ["lista_precio_id"];
            isOneToOne: false;
            referencedRelation: "listas_precio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listas_precio_materiales_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      listas_precio_items: {
        Row: {
          id: string;
          lista_precio_id: string;
          articulo_id: string;
          precio: number;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lista_precio_id: string;
          articulo_id: string;
          precio?: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lista_precio_id?: string;
          articulo_id?: string;
          precio?: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listas_precio_items_lista_precio_id_fkey";
            columns: ["lista_precio_id"];
            isOneToOne: false;
            referencedRelation: "listas_precio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listas_precio_items_articulo_id_fkey";
            columns: ["articulo_id"];
            isOneToOne: false;
            referencedRelation: "articulos";
            referencedColumns: ["id"];
          },
        ];
      };
      cuentas_financieras: {
        Row: {
          id: string;
          nombre: string;
          tipo: "caja" | "banco" | "tarjeta" | "cheque" | "otro";
          moneda: "ars" | "usd";
          saldo_inicial: number;
          activa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          tipo: "caja" | "banco" | "tarjeta" | "cheque" | "otro";
          moneda: "ars" | "usd";
          saldo_inicial?: number;
          activa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          tipo?: "caja" | "banco" | "tarjeta" | "cheque" | "otro";
          moneda?: "ars" | "usd";
          saldo_inicial?: number;
          activa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      movimientos_caja: {
        Row: {
          id: string;
          cuenta_id: string;
          tipo: "ingreso" | "egreso" | "transferencia_entrada" | "transferencia_salida";
          monto: number;
          moneda: "ars" | "usd";
          fecha: string;
          descripcion: string | null;
          concepto: ConceptoMovimientoDb;
          metodo: "efectivo" | "transferencia" | "cheque" | "tarjeta";
          referencia_tipo: string | null;
          referencia_id: string | null;
          cuenta_contraparte_id: string | null;
          transferencia_grupo_id: string | null;
          supplier_id: string | null;
          comprobante_path: string | null;
          acreditacion: "no_aplica" | "pendiente" | "acreditado";
          monto_acreditado: number | null;
          fecha_acreditacion: string | null;
          movimiento_origen_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cuenta_id: string;
          tipo: "ingreso" | "egreso" | "transferencia_entrada" | "transferencia_salida";
          monto: number;
          moneda: "ars" | "usd";
          fecha: string;
          descripcion?: string | null;
          concepto?: ConceptoMovimientoDb;
          metodo: "efectivo" | "transferencia" | "cheque" | "tarjeta";
          referencia_tipo?: string | null;
          referencia_id?: string | null;
          cuenta_contraparte_id?: string | null;
          transferencia_grupo_id?: string | null;
          supplier_id?: string | null;
          comprobante_path?: string | null;
          acreditacion?: "no_aplica" | "pendiente" | "acreditado";
          monto_acreditado?: number | null;
          fecha_acreditacion?: string | null;
          movimiento_origen_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          cuenta_id?: string;
          tipo?: "ingreso" | "egreso" | "transferencia_entrada" | "transferencia_salida";
          monto?: number;
          moneda?: "ars" | "usd";
          fecha?: string;
          descripcion?: string | null;
          concepto?: ConceptoMovimientoDb;
          metodo?: "efectivo" | "transferencia" | "cheque" | "tarjeta";
          referencia_tipo?: string | null;
          referencia_id?: string | null;
          cuenta_contraparte_id?: string | null;
          transferencia_grupo_id?: string | null;
          supplier_id?: string | null;
          comprobante_path?: string | null;
          acreditacion?: "no_aplica" | "pendiente" | "acreditado";
          monto_acreditado?: number | null;
          fecha_acreditacion?: string | null;
          movimiento_origen_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas_financieras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_movimiento_origen_id_fkey";
            columns: ["movimiento_origen_id"];
            isOneToOne: true;
            referencedRelation: "movimientos_caja";
            referencedColumns: ["id"];
          },
        ];
      };
      cierres_caja: {
        Row: {
          id: string;
          fecha: string;
          cuenta_id: string;
          saldo_calculado: number;
          saldo_arqueo: number | null;
          notas: string | null;
          cerrado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fecha: string;
          cuenta_id: string;
          saldo_calculado: number;
          saldo_arqueo?: number | null;
          notas?: string | null;
          cerrado_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          fecha?: string;
          cuenta_id?: string;
          saldo_calculado?: number;
          saldo_arqueo?: number | null;
          notas?: string | null;
          cerrado_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cierres_caja_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas_financieras";
            referencedColumns: ["id"];
          },
        ];
      };
      importaciones: {
        Row: {
          id: string;
          supplier_id: string;
          descripcion: string;
          pais_origen: string;
          nro_orden_compra: string | null;
          fecha_orden_compra: string | null;
          monto_factura_usd: number | null;
          fecha_factura_provisoria: string | null;
          fecha_embarque: string | null;
          fecha_estimada_llegada: string | null;
          fecha_llegada_real: string | null;
          fecha_nacionalizacion: string | null;
          nro_despacho: string | null;
          estado: ImportacionEstado;
          despachante_nombre: string | null;
          despachante_telefono: string | null;
          notas: string | null;
          medio_transporte: ImportacionMedioTransporte | null;
          nro_conocimiento: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          descripcion: string;
          pais_origen: string;
          nro_orden_compra?: string | null;
          fecha_orden_compra?: string | null;
          monto_factura_usd?: number | null;
          fecha_factura_provisoria?: string | null;
          fecha_embarque?: string | null;
          fecha_estimada_llegada?: string | null;
          fecha_llegada_real?: string | null;
          fecha_nacionalizacion?: string | null;
          nro_despacho?: string | null;
          estado?: ImportacionEstado;
          despachante_nombre?: string | null;
          despachante_telefono?: string | null;
          notas?: string | null;
          medio_transporte?: ImportacionMedioTransporte | null;
          nro_conocimiento?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          descripcion?: string;
          pais_origen?: string;
          nro_orden_compra?: string | null;
          fecha_orden_compra?: string | null;
          monto_factura_usd?: number | null;
          fecha_factura_provisoria?: string | null;
          fecha_embarque?: string | null;
          fecha_estimada_llegada?: string | null;
          fecha_llegada_real?: string | null;
          fecha_nacionalizacion?: string | null;
          nro_despacho?: string | null;
          estado?: ImportacionEstado;
          despachante_nombre?: string | null;
          despachante_telefono?: string | null;
          notas?: string | null;
          medio_transporte?: ImportacionMedioTransporte | null;
          nro_conocimiento?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "importaciones_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "importaciones_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      importacion_gastos: {
        Row: {
          id: string;
          importacion_id: string;
          concepto: ImportacionGastoConcepto;
          monto: number;
          moneda: "ars" | "usd";
          es_iva_recuperable: boolean;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          importacion_id: string;
          concepto: ImportacionGastoConcepto;
          monto: number;
          moneda?: "ars" | "usd";
          es_iva_recuperable?: boolean;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          importacion_id?: string;
          concepto?: ImportacionGastoConcepto;
          monto?: number;
          moneda?: "ars" | "usd";
          es_iva_recuperable?: boolean;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "importacion_gastos_importacion_id_fkey";
            columns: ["importacion_id"];
            isOneToOne: false;
            referencedRelation: "importaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      importacion_documentos: {
        Row: {
          id: string;
          importacion_id: string;
          tipo: ImportacionDocumentoTipo;
          nombre_archivo: string;
          url: string;
          notas: string | null;
          etapa: ImportacionEstado | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          importacion_id: string;
          tipo: ImportacionDocumentoTipo;
          nombre_archivo: string;
          url: string;
          notas?: string | null;
          etapa?: ImportacionEstado | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          importacion_id?: string;
          tipo?: ImportacionDocumentoTipo;
          nombre_archivo?: string;
          url?: string;
          notas?: string | null;
          etapa?: ImportacionEstado | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "importacion_documentos_importacion_id_fkey";
            columns: ["importacion_id"];
            isOneToOne: false;
            referencedRelation: "importaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      exportaciones: {
        Row: {
          id: string;
          client_id: string;
          descripcion: string;
          pais_destino: string | null;
          nro_pedido: string | null;
          fecha_pedido: string | null;
          nro_factura: string | null;
          fecha_factura: string | null;
          monto_factura: number | null;
          moneda: "ars" | "usd";
          medio_transporte: ImportacionMedioTransporte | null;
          nro_bl: string | null;
          fecha_embarque: string | null;
          estado: ExportacionEstado;
          banco_nombre: string | null;
          banco_cuenta: string | null;
          cuenta_id: string | null;
          fecha_cobro: string | null;
          movimiento_id: string | null;
          notas: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          descripcion: string;
          pais_destino?: string | null;
          nro_pedido?: string | null;
          fecha_pedido?: string | null;
          nro_factura?: string | null;
          fecha_factura?: string | null;
          monto_factura?: number | null;
          moneda?: "ars" | "usd";
          medio_transporte?: ImportacionMedioTransporte | null;
          nro_bl?: string | null;
          fecha_embarque?: string | null;
          estado?: ExportacionEstado;
          banco_nombre?: string | null;
          banco_cuenta?: string | null;
          cuenta_id?: string | null;
          fecha_cobro?: string | null;
          movimiento_id?: string | null;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          descripcion?: string;
          pais_destino?: string | null;
          nro_pedido?: string | null;
          fecha_pedido?: string | null;
          nro_factura?: string | null;
          fecha_factura?: string | null;
          monto_factura?: number | null;
          moneda?: "ars" | "usd";
          medio_transporte?: ImportacionMedioTransporte | null;
          nro_bl?: string | null;
          fecha_embarque?: string | null;
          estado?: ExportacionEstado;
          banco_nombre?: string | null;
          banco_cuenta?: string | null;
          cuenta_id?: string | null;
          fecha_cobro?: string | null;
          movimiento_id?: string | null;
          notas?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exportaciones_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exportaciones_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas_financieras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exportaciones_movimiento_id_fkey";
            columns: ["movimiento_id"];
            isOneToOne: true;
            referencedRelation: "movimientos_caja";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exportaciones_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      exportacion_gastos: {
        Row: {
          id: string;
          exportacion_id: string;
          concepto: ExportacionGastoConcepto;
          monto: number;
          moneda: "ars" | "usd";
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exportacion_id: string;
          concepto: ExportacionGastoConcepto;
          monto: number;
          moneda?: "ars" | "usd";
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exportacion_id?: string;
          concepto?: ExportacionGastoConcepto;
          monto?: number;
          moneda?: "ars" | "usd";
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exportacion_gastos_exportacion_id_fkey";
            columns: ["exportacion_id"];
            isOneToOne: false;
            referencedRelation: "exportaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      exportacion_documentos: {
        Row: {
          id: string;
          exportacion_id: string;
          tipo: ExportacionDocumentoTipo;
          nombre_archivo: string;
          url: string;
          notas: string | null;
          etapa: ExportacionEstado | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exportacion_id: string;
          tipo: ExportacionDocumentoTipo;
          nombre_archivo: string;
          url: string;
          notas?: string | null;
          etapa?: ExportacionEstado | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exportacion_id?: string;
          tipo?: ExportacionDocumentoTipo;
          nombre_archivo?: string;
          url?: string;
          notas?: string | null;
          etapa?: ExportacionEstado | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exportacion_documentos_exportacion_id_fkey";
            columns: ["exportacion_id"];
            isOneToOne: false;
            referencedRelation: "exportaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracion_empresa: {
        Row: {
          id: number;
          razon_social: string;
          nombre_fantasia: string | null;
          cuit: string | null;
          condicion_iva: string | null;
          direccion: string | null;
          localidad: string | null;
          telefono: string | null;
          email: string | null;
          sitio_web: string | null;
          dolar_hoy: number | null;
          dolar_actualizado_en: string | null;
          dolar_actualizado_por: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          razon_social?: string;
          nombre_fantasia?: string | null;
          cuit?: string | null;
          condicion_iva?: string | null;
          direccion?: string | null;
          localidad?: string | null;
          telefono?: string | null;
          email?: string | null;
          sitio_web?: string | null;
          dolar_hoy?: number | null;
          dolar_actualizado_en?: string | null;
          dolar_actualizado_por?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          razon_social?: string;
          nombre_fantasia?: string | null;
          cuit?: string | null;
          condicion_iva?: string | null;
          direccion?: string | null;
          localidad?: string | null;
          telefono?: string | null;
          email?: string | null;
          sitio_web?: string | null;
          dolar_hoy?: number | null;
          dolar_actualizado_en?: string | null;
          dolar_actualizado_por?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_saldos_cuentas: {
        Row: {
          cuenta_id: string;
          nombre: string;
          tipo: "caja" | "banco" | "tarjeta" | "cheque" | "otro";
          moneda: "ars" | "usd";
          saldo_inicial: number;
          movimientos_neto: number;
          saldo_actual: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_remito_with_slabs: {
        Args: { p_payload: Json };
        Returns: string;
      };
      create_manual_slabs: {
        Args: { p_payload: Json };
        Returns: number;
      };
      register_cantera_ingreso: {
        Args: { p_payload: Json };
        Returns: undefined;
      };
      register_cantera_procesamiento: {
        Args: { p_payload: Json };
        Returns: undefined;
      };
      reservar_ot_stock_unidades: {
        Args: {
          p_ot_id: string;
          p_material_id: string;
          p_qty: number;
          p_created_by?: string | null;
        };
        Returns: undefined;
      };
      consumir_ot_stock_unidades: {
        Args: {
          p_ot_id: string;
          p_material_id: string;
          p_qty?: number | null;
          p_created_by?: string | null;
        };
        Returns: undefined;
      };
      liberar_ot_stock_unidades: {
        Args: {
          p_ot_id: string;
          p_material_id: string;
          p_qty?: number | null;
          p_created_by?: string | null;
        };
        Returns: undefined;
      };
      get_articulos_con_precios: {
        Args: { p_lista_precio_id: string };
        Returns: Array<{
          id: string;
          codigo: string;
          descripcion: string;
          unidad: UnidadArticuloDb;
          calcula_material: boolean;
          medida_estandar_m2: number | null;
          prefer_modo_manual: boolean;
          sort_order: number;
          precio: number | null;
        }>;
      };
      mis_roles: {
        Args: Record<never, never>;
        Returns: Array<{ rol: RolOperativo }>;
      };
      tiene_rol: {
        Args: { p_rol: RolOperativo };
        Returns: boolean;
      };
      admin_listar_usuarios: {
        Args: Record<never, never>;
        Returns: Array<{
          id: string;
          email: string | null;
          full_name: string | null;
          es_admin: boolean;
          roles: string[];
          ultimo_ingreso: string | null;
          creado: string;
        }>;
      };
      admin_guardar_usuario: {
        Args: { p_id: string; p_full_name: string; p_es_admin: boolean; p_roles: RolOperativo[] };
        Returns: undefined;
      };
      admin_reiniciar_guia: {
        Args: { p_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      quote_status: QuoteStatus;
      job_status: JobStatus;
      invoice_status: InvoiceStatus;
      profile_role: ProfileRole;
      inventory_slab_estado: InventorySlabEstado;
      rotura_tipo: RoturaTipoDb;
      rotura_momento: RoturaMomentoDb;
      origen_placa: OrigenPlaca;
      material_kind: MaterialKindDb;
      bacha_origen: BachaOrigen;
      bacha_inventario_estado: BachaInventarioEstado;
      presupuesto_estado: PresupuestoEstado;
      medicion_estado: MedicionEstado;
      venta_estado: VentaEstado;
      unidad_articulo: UnidadArticuloDb;
      rol_operativo: RolOperativo;
      importacion_estado: ImportacionEstado;
      exportacion_estado: ExportacionEstado;
      liquidacion_estado: LiquidacionEstado;
    };
  };
}
