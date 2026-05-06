# Artefactos para integrar (checklist)

Marca y entrega cada ítem cuando esté listo; sustituye o extiende las migraciones en `supabase/migrations/` según tu modelo real.

## Mockup v0

- [ ] ZIP o carpeta con el código exportado, o repo git del mockup
- [ ] Enlace al proyecto v0 (si aplica)
- [ ] Confirmación: ¿Tailwind + shadcn u otra librería?

## Supabase

- [ ] URL del proyecto (`https://xxxxx.supabase.co`) — no pegues keys en el chat
- [ ] Archivo `.env.local` en tu máquina con:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- [ ] SQL adicional o migraciones ya aplicadas en el dashboard (exportar y fusionar con esta repo)
- [ ] Reglas de negocio para RLS: roles (admin, ventas, taller), multi-sucursal sí/no

## Dominio

- [ ] Flujo acordado (ej.: presupuesto → aprobación → trabajo → factura)
- [ ] Lista de estados válidos por entidad si difieren del esquema inicial

## GitHub

- [ ] Repositorio creado (público o privado) y `origin` configurado
- [ ] Colaboradores invitados si el equipo es >1
