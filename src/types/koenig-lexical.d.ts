// The package ships no type declarations. We use a narrow surface only.
declare module "@tryghost/koenig-lexical" {
  import type { ComponentType, ReactNode } from "react";

  export type KoenigJson = Record<string, unknown>;

  export const KoenigComposer: ComponentType<any>;
  export const KoenigEditor: ComponentType<{
    onChange?: (json: KoenigJson) => void;
    children?: ReactNode;
    [key: string]: unknown;
  }>;
  export const KoenigComposableEditor: ComponentType<any>;
  export const HtmlOutputPlugin: ComponentType<{
    html?: string;
    setHtml?: (html: string) => void;
  }>;
  export const DEFAULT_NODES: unknown[];
  export const BASIC_NODES: unknown[];
  export const DEFAULT_TRANSFORMERS: unknown[];
  export const BASIC_TRANSFORMERS: unknown[];
  export const AllDefaultPlugins: ComponentType<any>;
  export const version: string;
}

declare module "@tryghost/koenig-lexical/style.css";
