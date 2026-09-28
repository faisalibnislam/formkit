/**
 * The field library, in the order it reads on the left of the builder.
 *
 * `type` matches `questionType` in the Convex schema exactly - adding one here
 * without adding it there will not save. Labels and groups follow the design
 * system's FIELD_TYPES.
 */
export type FieldType = {
  type: string;
  label: string;
  group: string;
  icon: string;
  /** What the person answering sees, described for the builder's preview. */
  preview:
    | "text"
    | "textarea"
    | "choice"
    | "multi"
    | "dropdown"
    | "yesno"
    | "scale"
    | "rating"
    | "file"
    | "signature"
    | "date"
    | "hidden";
  defaultOptions?: string[];
};

const OPTIONS = ["Option one", "Option two", "Option three"];

export const FIELD_TYPES: FieldType[] = [
  { type: "short-text", label: "Short text", group: "Text", icon: "type", preview: "text" },
  { type: "long-text", label: "Long text", group: "Text", icon: "align-left", preview: "textarea" },
  { type: "number", label: "Number", group: "Text", icon: "hash", preview: "text" },
  { type: "email", label: "Email", group: "Contact", icon: "mail", preview: "text" },
  { type: "name", label: "Name", group: "Contact", icon: "user", preview: "text" },
  { type: "phone", label: "Phone", group: "Contact", icon: "phone", preview: "text" },
  { type: "company", label: "Company", group: "Contact", icon: "building-2", preview: "text" },
  { type: "url", label: "URL", group: "Contact", icon: "link", preview: "text" },
  { type: "address", label: "Address", group: "Contact", icon: "map-pin", preview: "textarea" },
  { type: "date", label: "Date", group: "Time", icon: "calendar", preview: "date" },
  { type: "time", label: "Time", group: "Time", icon: "clock", preview: "text" },
  {
    type: "single-choice",
    label: "Single choice",
    group: "Choice",
    icon: "circle-dot",
    preview: "choice",
    defaultOptions: OPTIONS,
  },
  {
    type: "multi-choice",
    label: "Multiple choice",
    group: "Choice",
    icon: "list-checks",
    preview: "multi",
    defaultOptions: OPTIONS,
  },
  {
    type: "dropdown",
    label: "Dropdown",
    group: "Choice",
    icon: "chevron-down",
    preview: "dropdown",
    defaultOptions: OPTIONS,
  },
  { type: "yes-no", label: "Yes / No", group: "Choice", icon: "toggle-left", preview: "yesno" },
  { type: "rating", label: "Rating", group: "Rating", icon: "star", preview: "rating" },
  { type: "scale", label: "Opinion scale", group: "Rating", icon: "sliders-horizontal", preview: "scale" },
  { type: "file", label: "File upload", group: "Upload", icon: "paperclip", preview: "file" },
  { type: "signature", label: "Signature", group: "Upload", icon: "pen-line", preview: "signature" },
  { type: "hidden", label: "Hidden field", group: "Smart", icon: "eye-off", preview: "hidden" },
];

/** Field types that are part of a paid plan, and the feature that covers them. */
export const PAID_TYPES: Record<string, "logic.hidden"> = { hidden: "logic.hidden" };

export const FIELD_GROUPS = Array.from(new Set(FIELD_TYPES.map((t) => t.group)));

export function fieldType(type: string | null | undefined) {
  return FIELD_TYPES.find((t) => t.type === type) ?? FIELD_TYPES[0]!;
}

/** Whether a type keeps a list of options the person writes. */
export function hasOptions(type: string | null | undefined) {
  return ["single-choice", "multi-choice", "dropdown"].includes(type ?? "");
}

export function hasScale(type: string | null | undefined) {
  return ["scale", "rating"].includes(type ?? "");
}

/** Types that take a typed answer, and so a placeholder. */
export function hasPlaceholder(type: string | null | undefined) {
  return [
    "short-text",
    "long-text",
    "number",
    "email",
    "name",
    "phone",
    "company",
    "url",
    "address",
  ].includes(type ?? "");
}

/** Search the library the way the builder does: by label, group or id. */
export function matchFieldTypes(term: string) {
  const q = term.trim().toLowerCase();
  if (!q) return FIELD_TYPES;
  return FIELD_TYPES.filter((t) => `${t.label} ${t.group} ${t.type}`.toLowerCase().includes(q));
}

/** "Untitled question" for a plain text field, "<Label> question" otherwise. */
export function defaultTitle(type: string) {
  const t = fieldType(type);
  if (t.type === "hidden") return "Where they came from";
  return t.type === "short-text" ? "Untitled question" : `${t.label} question`;
}

/** ".pdf .png docx" → [".pdf", ".png", ".docx"]. */
export function parseAccept(text: string) {
  return Array.from(
    new Set(
      text
        .split(/[\s,;]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .map((t) => (t.startsWith(".") ? t : `.${t}`))
        .filter((t) => /^\.[a-z0-9]+$/.test(t)),
    ),
  );
}
