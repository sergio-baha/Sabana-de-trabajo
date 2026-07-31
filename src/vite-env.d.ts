/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Inyectadas por vite.config.ts (define) en build time — ver
// src/components/shared/BuildInfoBadge.tsx.
declare const __APP_COMMIT__: string
declare const __APP_BUILD_TIME__: string
