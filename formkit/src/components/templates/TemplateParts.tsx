import { GitBranch, Link2, Mic, Palette, Paperclip, Plus, QrCode, Star } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { QuestionJump } from "@/components/templates/TemplatePreviewer";
import type { TemplatePreview, PreviewQuestion } from "@/content/templatePreview";
import type { FormTemplate } from "@/content/templates";

/**
 * The pieces of a template's own page: the form drawn page by page (each
 * question opens in the live preview), a response as it would land, and the
 * three steps from template to published form.
 */

export function TemplateFlow({ t, preview }: { t: FormTemplate; preview: TemplatePreview }) {
  return (
    <ol className="fk-tf">
      {preview.pages.map((page, p) => {
        const qs = preview.questions.map((q, i) => ({ q, i })).filter((x) => x.q.page === page);
        return (
          <li key={page} className="fk-tf-page" style={{ ["--prog" as string]: `${((p + 1) / preview.pages.length) * 100}%` }}>
            <span className="fk-tf-head">
              <em>Page {p + 1}</em>
              <b>{page}</b>
              <small>
                {qs.length} {qs.length === 1 ? "question" : "questions"}
              </small>
            </span>
            <div className="fk-tf-qs">
              {qs.map(({ q, i }) => {
                const site = t.questions[i];
                return (
                  <QuestionJump key={`${i}-${q.title}`} index={i}>
                    <span className="fk-tpl-qindex">{String(i + 1).padStart(2, "0")}</span>
                    <span className="fk-tpl-qglyph">
                      <Glyph name={site?.icon ?? "text"} size={14} />
                    </span>
                    <span className="fk-tf-qtext">
                      <b>
                        {q.title}
                        {q.required && <i aria-label="Required">*</i>}
                      </b>
                      <small>{site?.type ?? q.type}</small>
                    </span>
                  </QuestionJump>
                );
              })}
            </div>
          </li>
        );
      })}
      <li className="fk-tf-page fk-tf-end">
        <span className="fk-tf-head">
          <em>Then</em>
          <b>{preview.thanks.title}</b>
        </span>
        <p>{preview.thanks.message}</p>
        {t.logic && (
          <span className="fk-tf-logic">
            <GitBranch size={13} strokeWidth={2} aria-hidden /> Conditional logic is already set up
          </span>
        )}
      </li>
    </ol>
  );
}

const SAMPLE: Record<string, string> = {
  name: "Maya Okafor",
  email: "maya@northstar.co",
  phone: "+44 20 7946 0321",
  url: "northstar.co",
  website: "northstar.co",
  number: "12",
  date: "12 March 2027",
  company: "Northstar",
  address: "14 Hatton Garden, London",
};

/** What one answer looks like in the response, by answer type. */
function Answer({ q, label }: { q: PreviewQuestion; label?: string }) {
  const byLabel = SAMPLE[(label ?? "").toLowerCase()];
  if (byLabel) return <span>{byLabel}</span>;
  if (q.type === "yes-no") return <span className="fk-tr-pill">Yes</span>;
  if (q.type === "single-choice" || q.type === "dropdown")
    return q.options?.[0] ? <span className="fk-tr-pill">{q.options[0]}</span> : <span className="fk-tr-muted">One choice</span>;
  if (q.type === "multi-choice")
    return (
      <span className="fk-tr-pills">
        {(q.options ?? []).slice(0, 2).map((o) => (
          <span key={o} className="fk-tr-pill">
            {o}
          </span>
        ))}
      </span>
    );
  if (q.type === "rating")
    return (
      <span className="fk-tr-stars" aria-label="4 stars">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} size={13} strokeWidth={2} data-on={s <= 4 || undefined} aria-hidden />
        ))}
      </span>
    );
  if (q.type === "scale") return <span className="fk-tr-pill">{Math.max(q.min ?? 1, (q.max ?? 5) - 1)}</span>;
  if (q.type === "voice")
    return (
      <span className="fk-tr-file">
        <Mic size={12} strokeWidth={2} aria-hidden /> Voice recording, 0:48
      </span>
    );
  if (q.type === "file")
    return (
      <span className="fk-tr-file">
        <Paperclip size={12} strokeWidth={2} aria-hidden /> brief.pdf
      </span>
    );
  if (SAMPLE[q.type]) return <span>{SAMPLE[q.type]}</span>;
  return <span className="fk-tr-muted">Their answer, in their own words</span>;
}

export function TemplateResponse({ t, preview }: { t: FormTemplate; preview: TemplatePreview }) {
  const name = t.name;
  const shown = preview.questions.slice(0, 6);
  const rest = preview.questions.length - shown.length;
  return (
    <div className="fk-tr" aria-label="A sample response">
      <div className="fk-tr-head">
        <span className="fk-tr-av">MO</span>
        <span>
          <b>Maya Okafor</b>
          <small>{name} · just now</small>
        </span>
        <span className="fk-tr-new">New</span>
      </div>
      <dl>
        {shown.map((q, i) => (
          <div key={q.title}>
            <dt>{q.title}</dt>
            <dd>
              <Answer q={q} label={t.questions[i]?.type} />
            </dd>
          </div>
        ))}
      </dl>
      {rest > 0 && <p className="fk-tr-more">and {rest} more answers</p>}
    </div>
  );
}

export function TemplateSteps({ slug }: { slug: string }) {
  return (
    <ol className="fk-ts">
      <li>
        <span className="fk-help-art">
          <span className="fk-art fk-art-create">
            <span className="fk-art-btn">
              <Plus size={12} strokeWidth={2.6} /> Use this template
            </span>
            <span className="fk-art-lines">
              <i />
              <i />
            </span>
          </span>
        </span>
        <span className="fk-ts-n">1</span>
        <b>Make it your own copy</b>
        <span>It becomes a draft in your account. Nothing you change touches the original.</span>
      </li>
      <li>
        <span className="fk-help-art">
          <span className="fk-art fk-ts-look">
            <span className="fk-ts-swatches" aria-hidden>
              <i style={{ background: "#d8e9f7" }} />
              <i style={{ background: "#e6f2ee" }} />
              <i style={{ background: "#fdeeed" }} />
              <i style={{ background: "#21282E" }} />
            </span>
            <span className="fk-art-ai">
              <Palette size={11} strokeWidth={2.2} /> Reword, reorder, re-theme
            </span>
          </span>
        </span>
        <span className="fk-ts-n">2</span>
        <b>Change anything</b>
        <span>Questions, pages, logic, theme and logo. It is an ordinary form from here on.</span>
      </li>
      <li>
        <span className="fk-help-art">
          <span className="fk-art fk-art-share">
            <span className="fk-art-link">
              <Link2 size={12} strokeWidth={2.2} /> formkit.app/you/{slug}
            </span>
            <span className="fk-art-qr">
              <QrCode size={34} strokeWidth={1.6} />
            </span>
          </span>
        </span>
        <span className="fk-ts-n">3</span>
        <b>Publish and share</b>
        <span>
          Your own link, a QR code or an embed. Every answer lands in one inbox.
        </span>
      </li>
    </ol>
  );
}
