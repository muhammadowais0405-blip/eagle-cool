/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  api: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, cb: (...args: any[]) => void): () => void;
    platform: string;
  };
}
