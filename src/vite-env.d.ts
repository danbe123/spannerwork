/// <reference types="vite/client" />
/// <reference types="node" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Test globals for vitest
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var __respErrorHandler: any;
  // eslint-disable-next-line no-var
  var global: typeof globalThis;

  namespace NodeJS {
    interface Timeout {
      ref(): this;
      unref(): this;
    }
  }
}
