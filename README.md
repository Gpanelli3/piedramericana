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

### Distribución en varias PCs (orientación)

- En una máquina de build con Node 20+, Rust y el [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) disponible, generá el instalador y copiá el `.msi` / `.exe` del directorio `bundle` a cada equipo del cliente.
- La app usa la **misma instancia Supabase** para todos: cada instalación solo necesita el mismo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (p. ej. empaquetados en el build o documentados para pegarlos en `.env.local` por sitio).
- **Actualizaciones:** mientras no haya [Tauri updater](https://v2.tauri.app/plugin/updater/) configurado, cada nueva versión es un nuevo instalador; coordiná con el cliente sustituir o reinstalar según su política IT.
- **Versionado:** incrementá `version` en [`package.json`](package.json) y en [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) antes de cada release para distinguir builds.

## UI (v0 / shadcn)

La interfaz del mockup v0 ya está integrada: vistas en `src/components/vista-*.tsx`, sidebar en `src/components/app-sidebar.tsx`, componentes en `src/components/ui/`. El alias de importación es `@/` → `src/` (ver `vite.config.ts` y `tsconfig.json`).

## Identificador de la app

- **Bundle ID**: `com.piedramericana.app` ( [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) )
- Ajusta iconos en `src-tauri/icons/` si lo necesitas.
