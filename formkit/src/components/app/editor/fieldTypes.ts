/**
 * The field library, in the order it reads on the left of the builder.
 *
 * `type` matches `questionType` in the Convex schema exactly — adding one here
 * without adding it there will not save.
 */
export type FieldType = {
  type: string;
  label: string;
  group: string;
  icon: string;
  /** What the person answering sees, described for the builder's preview. */
  preview: "text" | "textarea" | "choice" | "multi" | "dropdown" | "yesno" | "scale" | "rating" | "file" | "signature" | "date";
  defaultOptions?: string[];
};

export const FIELD_TYPES: FieldType[] = [
  { type: "short-text", label: "Short text", group: "Text", icon: "type", preview: "text" },
  { type: "long-text", label: "Long text", group: "Text", icon: "align-left", preview: "textarea" },
  { type: "email", label: "Email", group: "Contact", icon: "at-sign", preview: "text" },
  { type: "phone", label: "Phone", group: "Contact", icon: "phone", preview: "text" },
  { type: "url", label: "Website", group: "Contact", icon: "link", preview: "text" },
  {
    type: "single-choice",
    label: "One of several",
    group: "Choice",
    icon: "circle-dot",
    preview: "choice",
    defaultOptions: ["First option", "Second option", "Third option"],
  },
  {
    type: "multi-choice",
    label: "Any of several",
    group: "Choice",
    icon: "list-checks",
    preview: "multi",
    defaultOptions: ["First option", "Second option", "Third option"],
  },
  {
    type: "dropdown",
    label: "A long list",
    group: "Choice",
    icon: "chevron-down",
    preview: "dropdown",
    defaultOptions: ["First option", "Second option", "Third option"],
  },
  { type: "yes-no", label: "Yes or no", group: "Choice", icon: "toggle-left", preview: "yesno" },
  { type: "number", label: "Number", group: "Numbers", icon: "hash", preview: "text" },
  { type: "rating", label: "Rating", group: "Numbers", icon: "star", preview: "rating" },
  { type: "scale", label: "Scale", group: "Numbers", icon: "sliders-horizontal", preview: "scale" },
  { type: "date", label: "Date", group: "Time", icon: "calendar", preview: "date" },
  { type: "time", label: "Time", group: "Time", icon: "clock", preview: "text" },
  { type: "file", label: "File upload", group: "Attachments", icon: "paperclip", preview: "file" },
  { type: "signature", label: "Signature", group: "Attachments", icon: "pen-line", preview: "signature" },
];

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
