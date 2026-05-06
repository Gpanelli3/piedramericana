# Piedra Americana — escritorio (Tauri + React + Supabase)

Aplicación de escritorio para operar la marmolería: clientes, presupuestos, trabajos y facturación. El backend es [Supabase](https://supabase.com/) (Postgres + Auth).

## Requisitos

- Node.js 20+
- [Rust](https://www.rust-lang.org/tools/install) (para compilar Tauri)
- Cuenta y proyecto Supabase

## Configuración

1. Copia variables de entorno:

   ```bash
   copy .env.example .env.local
   ```

   En macOS/Linux: `cp .env.example .env.local`

2. En el [dashboard de Supabase](https://supabase.com/dashboard), **Settings → API**, pega `URL` y `anon public` en `.env.local`.

3. Aplica el esquema en tu proyecto (si aún no existe o fusiona a mano con lo que ya tengas):

   - SQL en [`supabase/migrations/20260106120000_initial_marmoleria.sql`](supabase/migrations/20260106120000_initial_marmoleria.sql) — ejecútalo en el SQL Editor o con la CLI (`supabase db push`).

4. Crea un usuario en **Authentication → Users** (o regístrate desde la app si habilitas sign-up) y prueba el login.

### Tipos TypeScript desde Supabase

Con la [Supabase CLI](https://supabase.com/docs/guides/cli) autenticada:

```bash
supabase gen types typescript --project-id <tu_project_id> --schema public > src/types/database.generated.ts
```

Luego puedes sustituir o extender [`src/types/database.ts`](src/types/database.ts) según el resultado generado.

## Desarrollo

```bash
npm install
npm run tauri dev
```

## Compilación instalador (Windows)

```bash
npm run tauri build
```

Los artefactos quedan en `src-tauri/target/release/bundle/`.

## Integración con mockup v0

Cuando tengas el código exportado desde v0, sustituye o fusiona componentes en `src/pages/` y el layout en `src/layouts/AppShell.tsx`. Lista de artefactos pendientes: [`docs/ARTIFACTOS.md`](docs/ARTIFACTOS.md).

## Identificador de la app

- **Bundle ID**: `com.piedramericana.app` ( [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) )
- Ajusta iconos en `src-tauri/icons/` si lo necesitas.
