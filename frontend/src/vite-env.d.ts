/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_AUTH_USERNAME?: string;
  readonly VITE_LOCAL_AUTH_PASSWORD?: string;
  readonly VITE_LOCAL_AUTH_FULL_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
