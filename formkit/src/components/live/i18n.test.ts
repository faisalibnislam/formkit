import { describe, expect, it } from "vitest";
import { LANGS, localize, pickLang, tr } from "./i18n";

describe("the live form's languages", () => {
  it("has every phrase in every language, with its placeholders", () => {
    for (const l of LANGS) {
      expect(tr(l, "next")).toBeTruthy();
      expect(tr(l, "fileOver", { mb: 20 })).toContain("20");
      expect(tr(l, "everyRow", { n: 2 })).toContain("2");
    }
    expect(tr("es", "next")).toBe("Siguiente");
    expect(tr("ar", "submit")).toBe("إرسال");
  });

  it("picks the link's language, then the browser's, then the form's own", () => {
    expect(pickLang(["en", "es", "de"], "en", "de", ["es-ES"])).toBe("de");
    expect(pickLang(["en", "es"], "en", null, ["fr-FR", "es-MX"])).toBe("es");
    expect(pickLang(["en", "es"], "en", "ja", ["ja"])).toBe("en");
  });

  it("shows translated options while answers keep the form's own", () => {
    const data = {
      blocks: [{ _id: "b", title: "Plan?", help: null, placeholder: null, pageName: null, options: ["Free", "Pro"] }],
      welcome: { title: "Hi", message: "", button: "Start" },
      thanks: null,
      closedMessage: "Closed",
    };
    const es = localize(data, { lang: "es", blocks: [{ blockId: "b", title: "¿Plan?", options: ["Gratis", "Pro"] }], screens: { welcomeTitle: "Hola" } });
    expect(es.blocks[0]).toMatchObject({ title: "¿Plan?", options: ["Free", "Pro"], optionLabels: ["Gratis", "Pro"] });
    expect(es.welcome?.title).toBe("Hola");
    expect(es.welcome?.button).toBe("Start");
  });
});
