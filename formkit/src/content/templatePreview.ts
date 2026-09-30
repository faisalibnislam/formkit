import { builtinTemplate } from "../../convex/model/builtinTemplates";

/**
 * A template as a respondent meets it, for the live previews on /templates:
 * the welcome screen, every question with its page and options, and the
 * thank-you screen. Read from the app's own definition (the same one "Use
 * this template" copies), so the preview is the real form.
 */

export type PreviewQuestion = {
  title: string;
  /** The app's field type: short-text, single-choice, scale… */
  type: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  page: string;
};

export type TemplatePreview = {
  accent: string;
  welcome: { title: string; message: string; button: string };
  thanks: { title: string; message: string };
  questions: PreviewQuestion[];
  pages: string[];
};

export function templatePreview(slug: string): TemplatePreview | null {
  const t = builtinTemplate(slug);
  if (!t) return null;
  const questions: PreviewQuestion[] = [];
  const pages: string[] = [];
  let page = "";
  for (const b of t.blocks) {
    if (b.kind === "pagebreak") {
      page = b.pageName;
      continue;
    }
    if (!page) page = "Questions";
    if (!pages.includes(page)) pages.push(page);
    questions.push({
      title: b.title,
      type: b.type,
      help: b.help,
      placeholder: b.placeholder,
      required: b.required,
      options: b.options,
      min: b.scaleMin,
      max: b.scaleMax,
      page,
    });
  }
  return {
    accent: t.accent,
    welcome: { title: t.welcome.title, message: t.welcome.message, button: t.welcome.button ?? "Start" },
    thanks: t.thanks,
    questions,
    pages,
  };
}
