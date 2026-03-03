/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPSLOG_API_URL: string;
  readonly VITE_OPSLOG_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
