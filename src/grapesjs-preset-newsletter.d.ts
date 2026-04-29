/**
 * Das `grapesjs-preset-newsletter`-Paket liefert keine eigenen TS-Typen.
 * Wir nutzen es nur als Plugin-Funktion in `grapesjs.init({ plugins: [...] })`.
 */
declare module "grapesjs-preset-newsletter" {
  import type { Editor } from "grapesjs";
  type PluginFn = (editor: Editor, opts?: Record<string, unknown>) => void;
  const plugin: PluginFn;
  export default plugin;
}
