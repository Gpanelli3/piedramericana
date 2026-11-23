-- Guía de uso: qué recorridos ya vio cada persona (bienvenida, general, por módulo).
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS guias_vistas text[] NOT NULL DEFAULT '{}';
