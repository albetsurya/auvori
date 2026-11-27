/// <reference types="vite/client" />

declare module '*.frag?raw' {
  const source: string;
  export default source;
}

declare module '*.vert?raw' {
  const source: string;
  export default source;
}

interface ImportMetaEnv {
  readonly VITE_LYNK_CHECKOUT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
