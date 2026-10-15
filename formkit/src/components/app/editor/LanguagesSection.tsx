"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Languages, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LANGS, type Lang } from "../../../../convex/model/langs";
import { LANG_NAMES } from "@/components/live/i18n";
import { Button, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { DraftArea, DraftPill } from "./Draft";
import { tracked } from "./saveStatus";
import { errorText } from "../settings/bits";

/**
 * Settings → General → Languages. The form's own language (every plan): its
 * buttons and messages follow it. On Pro, more languages, each translated by
 * AI and then the owner's to change; people get theirs from their browser,
 * a switcher, or a link ending ?lang=.
 */

type Data = NonNullable<ReturnType<typeof useQuery<typeof api.translations.forForm>>>;

export function LanguagesSection({ formId, features }: { formId: Id<"forms">; features?: Record<string, boolean> | null }) {
  const toast = useToast();
  const data = useQuery(api.translations.forForm, { formId });
  const setLanguage = useMutation(api.translations.setLanguage);
  const setLanguages = useMutation(api.translations.setLanguages);
  const translate = useAction(api.translations.translate);
  const gate = useGate("forms.languages", features);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Lang | null>(null);
  if (!data) return null;

  const others = LANGS.filter((l) => l !== data.language && !data.languages.includes(l));

  async function run(lang: Lang) {
    setBusy(lang);
    try {
      await translate({ formId, lang });
      toast(`Translated into ${LANG_NAMES[lang]}`, { detail: "Read it over below, and change anything." });
      setOpen(lang);
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not translate."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="fk-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0, flex: 1 }}>Languages</h3>
        {gate.locked && <ProChip onClick={() => openUpgrade({ feature: "forms.languages" })} />}
      </div>
      <p className="fk-panel-lede">
        The form’s buttons and messages follow its language. On Pro it can be offered in more: people get their browser’s
        language when the form has it, can switch, and a link ending ?lang=es opens it in Spanish.
      </p>
      <div className="fk-proprow">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14 }}>Written in</div>
          <div className="fk-proprow-hint">The language of your questions</div>
        </div>
        <div style={{ width: 200 }}>
          <Select
            size="sm"
            ariaLabel="Written in"
            value={data.language}
            options={LANGS.map((l) => ({ value: l, label: LANG_NAMES[l] }))}
            onChange={(language) => tracked(setLanguage({ formId, language }))}
          />
        </div>
      </div>

      {data.languages.map((l) => {
        const t = data.translations.find((x) => x.lang === l);
        return (
          <div key={l} className="fk-domainrow">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Languages size={16} strokeWidth={1.8} aria-hidden />
              <strong style={{ fontWeight: 500 }}>{LANG_NAMES[l]}</strong>
              <span className="fk-proprow-hint" style={{ margin: 0 }}>
                {t ? "Translated" : "Not translated yet, so people see your own words"}
              </span>
              <span style={{ flex: 1 }} />
              <Button variant="ghost" size="sm" disabled={busy === l} iconLeft={<Sparkles size={15} strokeWidth={1.8} aria-hidden />} onClick={() => void run(l)}>
                {busy === l ? "Translating…" : t ? "Translate again" : "Translate with AI"}
              </Button>
              {t && (
                <Button variant="ghost" size="sm" onClick={() => setOpen(open === l ? null : l)}>
                  {open === l ? "Close" : "Edit"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => tracked(setLanguages({ formId, languages: data.languages.filter((x) => x !== l) }))}
              >
                Remove
              </Button>
            </div>
            {open === l && t && <Editor formId={formId} lang={l} data={data} />}
          </div>
        );
      })}

      {others.length > 0 && (
        <div className="fk-proprow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>Offer it in another language</div>
            <div className="fk-proprow-hint">Translating uses one AI edit. You can change every word after.</div>
          </div>
          <div style={{ width: 200 }}>
            <Select
              size="sm"
              ariaLabel="Add a language"
              value=""
              options={[{ value: "", label: "Add a language" }, ...others.map((l) => ({ value: l, label: LANG_NAMES[l] }))]}
              onChange={gate.guard(async (l: string) => {
                if (!l) return;
                try {
                  await setLanguages({ formId, languages: [...data.languages, l] });
                  await run(l as Lang);
                } catch (e) {
                  if (!upgradeOnPlanError(e)) toast(errorText(e, "That language was not added."));
                }
              })}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** The translation beside your own words, to change any of it. */
function Editor({ formId, lang, data }: { formId: Id<"forms">; lang: Lang; data: Data }) {
  const setText = useMutation(api.translations.setText);
  const t = data.translations.find((x) => x.lang === lang)!;
  const byId = new Map(t.blocks.map((b) => [b.blockId as string, b]));
  const save = (blockId: Id<"blocks"> | undefined, field: string, value: string | string[]) =>
    tracked(setText({ formId, lang, blockId, field, value }));
  const screens: [string, string, string | undefined][] = [
    ["welcomeTitle", "Welcome title", data.source.screens.welcomeTitle],
    ["welcomeMessage", "Welcome message", data.source.screens.welcomeMessage],
    ["welcomeButton", "Start button", data.source.screens.welcomeButton],
    ["thanksTitle", "Thank-you title", data.source.screens.thanksTitle],
    ["thanksMessage", "Thank-you message", data.source.screens.thanksMessage],
  ];
  return (
    <div className="fk-translate" dir="auto">
      {screens
        .filter(([, , src]) => src)
        .map(([field, label, src]) => (
          <div key={field} className="fk-translate-row">
            <div className="fk-translate-src">
              <span className="fk-translate-label">{label}</span>
              {src}
            </div>
            <DraftArea rows={1} value={(t.screens as Record<string, string | undefined>)[field] ?? ""} placeholder={src} onCommit={(v) => save(undefined, field, v)} />
          </div>
        ))}
      {data.source.blocks
        .filter((b) => b.title || b.options)
        .map((b) => {
          const x = byId.get(b.blockId);
          return (
            <div key={b.blockId} className="fk-translate-row">
              <div className="fk-translate-src">{b.title ?? b.pageName}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <DraftPill value={x?.title ?? ""} placeholder={b.title ?? ""} onCommit={(v) => save(b.blockId, "title", v)} />
                {b.options && (
                  <DraftArea
                    rows={Math.min(6, b.options.length)}
                    value={(x?.options ?? []).join("\n")}
                    placeholder={b.options.join("\n")}
                    onCommit={(v) => save(b.blockId, "options", v.split("\n"))}
                  />
                )}
                {b.options && <span className="fk-proprow-hint">One per line, in the same order: {b.options.length}.</span>}
              </div>
            </div>
          );
        })}
    </div>
  );
}
