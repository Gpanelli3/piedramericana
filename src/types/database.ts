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
export type InventorySlabEstado = "Disponible" | "Reservada" | "Usada" | "Baja";
export type OrigenPlaca = "nacional" | "importado" | "cantera" | "otro";
export type MaterialKindDb = "marmol" | "otra_piedra" | "agglomerado_otro";
export type PresupuestoEstado = "pendiente" | "aprobado" | "rechazado";
export type VentaEstado =
  | "senado"
  | "en_medicion"
  | "en_produccion"
  | "finalizado"
  | "entregado";
export type EtapaOtKanban = "medicion" | "corte" | "produccion" | "despacho";
export type UnidadArticuloDb = "M2" | "ML" | "UNI";
export type RolOperativo =
  | "vendedor"
  | "medidor"
  | "cortador"
  | "produccion"
  | "instalador"
  | "reparador"
  | "administracion"
  | "admin";

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          full_name: string | null;
          role: ProfileRole;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
        };
        Relationships: [];
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
        ];
      };
      remito_lines: {
        Row: {
          id: string;
          remito_id: string;
          material_id: string | null;
          material_label: string;
          qty_slabs: number;
          largo_cm: number;
          ancho_cm: number;
          precio_unitario: number | null;
          sort_order: number;
          lote_codigo: string | null;
          origen_placa: OrigenPlaca;
        };
        Insert: {
          id?: string;
          remito_id: string;
          material_id?: string | null;
          material_label: string;
          qty_slabs: number;
          largo_cm: number;
          ancho_cm: number;
          precio_unitario?: number | null;
          sort_order?: number;
          lote_codigo?: string | null;
          origen_placa?: OrigenPlaca;
        };
        Update: {
          id?: string;
          remito_id?: string;
          material_id?: string | null;
          material_label?: string;
          qty_slabs?: number;
          largo_cm?: number;
          ancho_cm?: number;
          precio_unitario?: number | null;
          sort_order?: number;
          lote_codigo?: string | null;
          origen_placa?: OrigenPlaca;
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
          estado: InventorySlabEstado;
          lote_codigo: string | null;
          ot_reserva_id: string | null;
          motivo_estado: string | null;
          chapa_origen_id: string | null;
          origen_placa: OrigenPlaca;
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
          estado?: InventorySlabEstado;
          lote_codigo?: string | null;
          ot_reserva_id?: string | null;
          motivo_estado?: string | null;
          chapa_origen_id?: string | null;
          origen_placa?: OrigenPlaca;
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
          estado?: InventorySlabEstado;
          lote_codigo?: string | null;
          ot_reserva_id?: string | null;
          motivo_estado?: string | null;
          chapa_origen_id?: string | null;
          origen_placa?: OrigenPlaca;
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
        ];
      };
      stock_movimientos: {
        Row: {
          id: string;
          chapa_id: string | null;
          ot_id: string | null;
          tipo: "reserva" | "liberacion" | "consumo" | "baja" | "retazo_alta";
          detalle: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chapa_id?: string | null;
          ot_id?: string | null;
          tipo: "reserva" | "liberacion" | "consumo" | "baja" | "retazo_alta";
          detalle?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chapa_id?: string | null;
          ot_id?: string | null;
          tipo?: "reserva" | "liberacion" | "consumo" | "baja" | "retazo_alta";
          detalle?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
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
          tipo: "caja" | "banco" | "tarjeta" | "otro";
          moneda: "ars" | "usd";
          saldo_inicial: number;
          activa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          tipo: "caja" | "banco" | "tarjeta" | "otro";
          moneda: "ars" | "usd";
          saldo_inicial?: number;
          activa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          tipo?: "caja" | "banco" | "tarjeta" | "otro";
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
          referencia_tipo: string | null;
          referencia_id: string | null;
          cuenta_contraparte_id: string | null;
          transferencia_grupo_id: string | null;
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
          referencia_tipo?: string | null;
          referencia_id?: string | null;
          cuenta_contraparte_id?: string | null;
          transferencia_grupo_id?: string | null;
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
          referencia_tipo?: string | null;
          referencia_id?: string | null;
          cuenta_contraparte_id?: string | null;
          transferencia_grupo_id?: string | null;
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
    };
    Views: {
      v_saldos_cuentas: {
        Row: {
          cuenta_id: string;
          nombre: string;
          tipo: "caja" | "banco" | "tarjeta" | "otro";
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
      register_cantera_ingreso: {
        Args: { p_payload: Json };
        Returns: undefined;
      };
      register_cantera_procesamiento: {
        Args: { p_payload: Json };
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
    };
    Enums: {
      quote_status: QuoteStatus;
      job_status: JobStatus;
      invoice_status: InvoiceStatus;
      profile_role: ProfileRole;
      inventory_slab_estado: InventorySlabEstado;
      origen_placa: OrigenPlaca;
      material_kind: MaterialKindDb;
      presupuesto_estado: PresupuestoEstado;
      venta_estado: VentaEstado;
      unidad_articulo: UnidadArticuloDb;
      rol_operativo: RolOperativo;
    };
  };
}
