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
export type InventorySlabEstado = "Disponible" | "Reservada";
export type MaterialKindDb = "marmol" | "otra_piedra" | "agglomerado_otro";
export type PresupuestoEstado = "pendiente" | "aprobado" | "rechazado";
export type VentaEstado =
  | "aprobado_sin_sena"
  | "senado"
  | "en_produccion"
  | "finalizado"
  | "entregado";
export type EtapaOtKanban = "medicion" | "corte" | "produccion" | "despacho";

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
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
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
      jobs: {
        Row: {
          id: string;
          quote_id: string | null;
          client_id: string | null;
          title: string;
          status: JobStatus;
          scheduled_for: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          venta_id: string | null;
          etapa_ot: EtapaOtKanban | string;
          pausada: boolean;
        };
        Insert: {
          id?: string;
          quote_id?: string | null;
          client_id?: string | null;
          title: string;
          status?: JobStatus;
          scheduled_for?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          venta_id?: string | null;
          etapa_ot?: EtapaOtKanban | string;
          pausada?: boolean;
        };
        Update: {
          id?: string;
          quote_id?: string | null;
          client_id?: string | null;
          title?: string;
          status?: JobStatus;
          scheduled_for?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          venta_id?: string | null;
          etapa_ot?: EtapaOtKanban | string;
          pausada?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_venta_id_fkey";
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
            referencedRelation: "jobs";
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
          created_at: string;
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
          created_at?: string;
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
          created_at?: string;
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
        ];
      };
      presupuestos: {
        Row: {
          id: string;
          numero: string;
          cliente: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          presupuesto_id: string;
          estado?: VentaEstado;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          presupuesto_id?: string;
          estado?: VentaEstado;
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
    };
    Views: Record<string, never>;
    Functions: {
      create_remito_with_slabs: {
        Args: { p_payload: Json };
        Returns: string;
      };
      register_cantera_ingreso: {
        Args: { p_payload: Json };
        Returns: undefined;
      };
    };
    Enums: {
      quote_status: QuoteStatus;
      job_status: JobStatus;
      invoice_status: InvoiceStatus;
      profile_role: ProfileRole;
      inventory_slab_estado: InventorySlabEstado;
      material_kind: MaterialKindDb;
      presupuesto_estado: PresupuestoEstado;
      venta_estado: VentaEstado;
    };
  };
}
