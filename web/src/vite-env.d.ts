/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPS_SCRIPT_URL: string;
  readonly VITE_APPS_SCRIPT_API_KEY: string;
  /** Opcional: si se define, la app pide este PIN antes de mostrar cualquier pantalla. */
  readonly VITE_APP_PIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
