/**
 * `mjml-browser` liefert keine eigenen TypeScript-Definitionen.
 * Wir typisieren nur den schmalen Teil, den wir tatsächlich nutzen:
 * `mjml2html(source, options) → { html, errors }`.
 */
declare module "mjml-browser" {
  export type MjmlError = {
    line: number;
    message: string;
    tagName?: string;
    formattedMessage: string;
  };

  export type MjmlOptions = {
    validationLevel?: "strict" | "soft" | "skip";
    keepComments?: boolean;
    minify?: boolean;
    beautify?: boolean;
  };

  export type MjmlResult = {
    html: string;
    errors: MjmlError[];
  };

  const mjml2html: (input: string, options?: MjmlOptions) => MjmlResult;
  export default mjml2html;
}
