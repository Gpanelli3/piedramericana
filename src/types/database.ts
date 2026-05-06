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
        };
        Insert: {
          id?: string;
          name: string;
          unit?: string;
          stock_qty?: number;
          reorder_level?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          unit?: string;
          stock_qty?: number;
          reorder_level?: number | null;
          notes?: string | null;
          created_at?: string;
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
          client_id: string;
          title: string;
          status: JobStatus;
          scheduled_for: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id?: string | null;
          client_id: string;
          title: string;
          status?: JobStatus;
          scheduled_for?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quote_id?: string | null;
          client_id?: string;
          title?: string;
          status?: JobStatus;
          scheduled_for?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      quote_status: QuoteStatus;
      job_status: JobStatus;
      invoice_status: InvoiceStatus;
      profile_role: ProfileRole;
    };
  };
}
