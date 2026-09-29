"use client";

import { useSeededQuery, useViewer } from "@/lib/seed";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BadgeCheck,
  Braces,
  Droplet,
  Eye,
  GripVertical,
  ImageIcon,
  LayoutGrid,
  Maximize2,
  Monitor,
  Palette,
  Plus,
  Smartphone,
  Tablet,
  Type,
  Upload,
  X,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  ColorField,
  IconButton,
  PillTabs,
  Segmented,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, useGate } from "@/components/plan/usePlan";
import { useToast } from "@/components/ui/Toast";
import { LogoLockup } from "@/components/live/LogoLockup";
import { FONTS, fontStack, loadFont, loadFontPreviews } from "./fonts";
import { openPreview } from "./previewBus";
import { PublishedUnderPicker } from "./PublishedUnder";
import {
  COLUMN,
  LOGO_PX,
  MAX_EXTRA_LOGOS,
  SIZE_SCALE,
  THEME_PRESETS,
  WEIGHTS,
  buttonInk,
  themeOf,
  type Theme,
} from "./themes";
import { useSettingsDraft } from "./useSettingsDraft";

/**
 * Design: the theme, the type, the layout, and which identity the form goes
 * out under - with a preview that repaints as anything changes.
 */

type Section = "theme" | "colors" | "type" | "layout" | "branding" | "css";
type Device = "desktop" | "tablet" | "mobile";

const INK = "#21282E";
const SWATCHES: Record<"bg" | "surface" | "text" | "primary", string[]> = {
  bg: ["#ffffff", "#f4f4f4", "#d8e9f7", "#e6f2ee", "#fdf7e0", INK],
  surface: ["#ffffff", "#fafafa", "#f4f4f4", "#2b333a", INK],
  text: [INK, "#6d747a", "#ffffff"],
  primary: [INK, "#2e78bb", "#337c38", "#86b2dc", "#b33e3a", "#bd9a24"],
};
const LOGO_TYPES = ["image/png", "image/svg+xml"];
const LOGO_MAX = 2 * 1024 * 1024;

function PropRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="fk-proprow">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{label}</div>
        {hint && <div className="fk-proprow-hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function DesignTab({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const form = useSeededQuery(api.forms.get, { formId });
  const viewer = useViewer();
  const uploadUrl = useMutation(api.users.generateUploadUrl);

  const [section, setSection] = useState<Section>("theme");
  const [device, setDevice] = useState<Device>("desktop");
  const [logoDrag, setLogoDrag] = useState<number | null>(null);
  const [logoOver, setLogoOver] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [theme, set] = useSettingsDraft<Theme>(formId, "theme", themeOf(form?.theme ?? null));
  const fontGate = useGate("design.fonts", form?.ownerPlan?.features);
  const cssGate = useGate("design.css", form?.ownerPlan?.features);
  const fontInput = useRef<HTMLInputElement>(null);
  const [cssDraft, setCssDraft] = useState<string | null>(null);

  useEffect(() => {
    loadFont(theme.font);
    loadFont(theme.heading);
  }, [theme.font, theme.heading]);

  if (!form) return null;

  const companies = viewer?.companies ?? [];
  const identity = form.identity;
  const scale = SIZE_SCALE[theme.size];
  const split = theme.layout === "split";
  const ink = buttonInk(theme.primary);
  const fields = form.blocks.filter((b) => b.kind === "field");
  const logos = theme.logos ?? [];
  const logoUrls = form.logos ?? [];

  async function addLogos(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const room = MAX_EXTRA_LOGOS - logos.length;
    if (room <= 0) {
      toast("Three additional logos is the limit", { detail: "Remove one to add another" });
      return;
    }
    const take = list.slice(0, room);
    const refused = take.find((f) => !LOGO_TYPES.includes(f.type) || f.size > LOGO_MAX);
    if (refused) {
      toast("That logo was not added", {
        detail: `${refused.name} needs to be an SVG or PNG under 2 MB.`,
        tone: "error",
      });
      return;
    }
    setUploading(true);
    try {
      const added: Theme["logos"] = [];
      for (const file of take) {
        const url = await uploadUrl({});
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = (await res.json()) as { storageId: string };
        added.push({ name: file.name.replace(/\.[a-z0-9]+$/i, ""), storageId });
      }
      set({ logos: [...logos, ...added] });
      toast(added.length === 1 ? "Logo added" : `${added.length} logos added`, {
        detail: take.map((f) => f.name).join(", "),
      });
      if (list.length > room) {
        toast(`Only ${room} slot${room === 1 ? "" : "s"} left`, { detail: "The rest were not added" });
      }
    } catch {
      toast("That upload did not finish", { detail: "Check the connection and try again.", tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function addFont(file: File | null) {
    if (!file) return;
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      toast("That font was not added", { detail: "Use a WOFF2, WOFF, TTF or OTF file under 2 MB.", tone: "error" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadUrl({});
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "font/woff2" }, body: file });
      const { storageId } = (await res.json()) as { storageId: string };
      const name = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Brand font";
      set({ customFont: { name, storageId } });
      toast("Brand font added", { detail: `${name} is used on the live form` });
    } catch {
      toast("That upload did not finish", { detail: "Check the connection and try again.", tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  function moveLogo(from: number, to: number) {
    setLogoDrag(null);
    setLogoOver(null);
    if (from === to) return;
    const next = logos.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    set({ logos: next });
  }

  const fontOptions = FONTS.map((f) => ({ value: f.name, label: f.name, note: f.cat }));
  const fontStyle = (o: { value: string }) => ({ fontFamily: fontStack(o.value) });
  const chain = [identity?.name ?? "Your logo", ...logos.map((l, i) => l.name || `Logo ${i + 1}`)]
    .concat(logos.length < MAX_EXTRA_LOGOS ? ["…"] : [])
    .join("  ×  ");

  const deviceWidth = { desktop: "100%", tablet: 640, mobile: 390 }[device];
  const questionPreview = fields.slice(0, 2);

  return (
    <div className="fk-design">
      <aside className="fk-panel fk-design-panel" data-pad="tight">
        <h3 style={{ margin: "0 0 6px" }}>Appearance</h3>
        <p className="fk-panel-lede">
          Start from a preset, then make it yours. Everything here shows up in the preview
          straight away.
        </p>
        <div style={{ marginBottom: 20 }}>
          <PillTabs
            ariaLabel="Design sections"
            value={section}
            onChange={setSection}
            tabs={[
              { value: "theme", label: "Theme", icon: <Palette size={15} strokeWidth={1.8} aria-hidden /> },
              { value: "colors", label: "Colors", icon: <Droplet size={15} strokeWidth={1.8} aria-hidden /> },
              { value: "type", label: "Type", icon: <Type size={15} strokeWidth={1.8} aria-hidden /> },
              { value: "layout", label: "Layout", icon: <LayoutGrid size={15} strokeWidth={1.8} aria-hidden /> },
              { value: "branding", label: "Branding", icon: <BadgeCheck size={15} strokeWidth={1.8} aria-hidden /> },
              { value: "css", label: "CSS", icon: <Braces size={15} strokeWidth={1.8} aria-hidden /> },
            ]}
          />
        </div>

        {section === "theme" && (
          <div className="fk-presets">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="fk-preset"
                aria-pressed={theme.preset === p.id}
                onClick={() =>
                  set({
                    preset: p.id,
                    bg: p.bg,
                    surface: p.surface,
                    text: p.text,
                    primary: p.primary,
                    radius: p.radius,
                  })
                }
              >
                <span className="fk-preset-canvas" style={{ background: p.bg }}>
                  <span
                    style={{
                      display: "block",
                      height: 10,
                      width: "62%",
                      borderRadius: 999,
                      background: p.text,
                      opacity: 0.85,
                    }}
                  />
                  <span
                    style={{
                      display: "block",
                      height: 22,
                      marginTop: 10,
                      borderRadius: Math.min(p.radius, 11),
                      background: p.surface,
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)",
                    }}
                  />
                  <span
                    style={{
                      display: "block",
                      width: 44,
                      height: 16,
                      marginTop: 10,
                      borderRadius: Math.min(p.radius, 8),
                      background: p.primary,
                    }}
                  />
                </span>
                <span className="fk-preset-name">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {section === "colors" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 8 }}>
              {(
                [
                  ["Background", "bg"],
                  ["Surface", "surface"],
                  ["Text", "text"],
                  ["Accent", "primary"],
                ] as const
              ).map(([label, key]) => (
                <div key={key}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
                      {theme[key]}
                    </span>
                  </div>
                  <ColorField
                    label={label}
                    value={theme[key]}
                    presets={SWATCHES[key]}
                    onChange={(hex) => set({ [key]: hex, preset: "custom" } as Partial<Theme>)}
                  />
                </div>
              ))}
            </div>
            <PropRow label="Corner radius">
              <div style={{ width: 130 }}>
                <Select
                  size="sm"
                  ariaLabel="Corner radius"
                  value={String(theme.radius)}
                  onChange={(v) => set({ radius: Number(v) })}
                  options={[
                    { value: "4", label: "4" },
                    { value: "12", label: "12" },
                    { value: "20", label: "20" },
                    { value: "28", label: "28" },
                    { value: "999", label: "Pill" },
                  ]}
                />
              </div>
            </PropRow>
          </div>
        )}

        {section === "type" && (
          <div>
            {(
              [
                ["Heading font", "heading"],
                ["Body font", "font"],
              ] as const
            ).map(([label, key]) => (
              <PropRow key={key} label={label}>
                <div style={{ width: 190 }}>
                  <Select
                    size="sm"
                    ariaLabel={label}
                    searchable
                    searchPlaceholder={`Search ${FONTS.length} fonts`}
                    value={theme[key]}
                    options={fontOptions}
                    optionStyle={fontStyle}
                    onOpen={loadFontPreviews}
                    onChange={(v) => {
                      loadFont(v);
                      set({ [key]: v } as Partial<Theme>);
                    }}
                  />
                </div>
              </PropRow>
            ))}
            <PropRow
              label="Your brand font"
              hint={
                theme.customFont
                  ? `${theme.customFont.name}, used for headings and text on the live form`
                  : "Upload a font file of your own (WOFF2, WOFF, TTF or OTF, up to 2 MB)"
              }
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {fontGate.locked && <ProChip onClick={() => openUpgrade({ feature: "design.fonts" })} />}
                {theme.customFont ? (
                  <Button variant="ghost" size="sm" onClick={() => set({ customFont: null })}>
                    Remove
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={uploading}
                    onClick={() => (fontGate.locked ? openUpgrade({ feature: "design.fonts" }) : fontInput.current?.click())}
                  >
                    Upload
                  </Button>
                )}
                <input
                  ref={fontInput}
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  hidden
                  onChange={(e) => {
                    void addFont(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </span>
            </PropRow>
            <PropRow label="Font size">
              <div style={{ width: 130 }}>
                <Select
                  size="sm"
                  ariaLabel="Font size"
                  value={theme.size}
                  onChange={(v) => set({ size: v as Theme["size"] })}
                  options={["Small", "Medium", "Large"].map((v) => ({ value: v, label: v }))}
                />
              </div>
            </PropRow>
            <PropRow label="Heading weight">
              <div style={{ width: 130 }}>
                <Select
                  size="sm"
                  ariaLabel="Heading weight"
                  value={theme.weight}
                  onChange={(v) => set({ weight: v as Theme["weight"] })}
                  options={["Light", "Regular", "Medium", "Bold"].map((v) => ({ value: v, label: v }))}
                />
              </div>
            </PropRow>
          </div>
        )}

        {section === "css" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="fk-proprow-hint" style={{ margin: 0 }}>
              CSS for the published form only. It cannot reach the rest of the page. Start from the form&rsquo;s own classes:
              .fk-live-q, .fk-live-q-title, .fk-live-q-help, .fk-live-choice, .fk-live-progress, .fk-live-foot.
            </p>
            {cssGate.locked && (
              <span>
                <ProChip onClick={() => openUpgrade({ feature: "design.css" })} />
              </span>
            )}
            <Textarea
              rows={12}
              value={cssDraft ?? theme.css ?? ""}
              placeholder={".fk-live-q-title {\n  letter-spacing: -0.02em;\n}"}
              disabled={cssGate.locked}
              onChange={(e) => setCssDraft(e.target.value)}
              onBlur={() => {
                if (cssDraft === null || cssDraft === (theme.css ?? "")) return setCssDraft(null);
                set({ css: cssDraft });
                setCssDraft(null);
              }}
              style={{ fontSize: 13.5, lineHeight: 1.55 }}
            />
            <p className="fk-proprow-hint" style={{ margin: 0 }}>
              Shows on the live form and in Preview. Up to 20,000 characters; imports and scripts are removed.
            </p>
          </div>
        )}

        {section === "layout" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Segmented
              ariaLabel="Layout"
              size="sm"
              value={theme.layout}
              onChange={(layout) => set({ layout })}
              options={[
                { value: "centered", label: "Centered" },
                { value: "wide", label: "Wide" },
                { value: "full", label: "Full screen" },
                { value: "split", label: "Split" },
              ]}
            />
            <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
              Centered reads in a 620px column. Split moves the question to the left and leaves
              room for a logo or image.
            </p>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 10 }}>How questions arrive</div>
            <Segmented
              ariaLabel="How questions arrive"
              size="sm"
              value={theme.flow}
              onChange={(flow) => set({ flow })}
              options={[
                { value: "classic", label: "Classic" },
                { value: "conversational", label: "Conversational" },
              ]}
            />
            <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
              {theme.flow === "conversational"
                ? "One question at a time, with Enter to go on and the submit button always in reach. Suits phones and short forms."
                : "A page of questions at a time, split wherever you add a page break. Suits anything somebody wants to review before sending."}
            </p>
          </div>
        )}

        {section === "branding" && (
          <div>
            {companies.length > 0 && form.mine && (
              <div style={{ padding: "2px 0 14px" }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>Published under</div>
                <PublishedUnderPicker formId={formId} form={form} />
                <div className="fk-proprow-hint" style={{ marginTop: 10, wordBreak: "break-all" }}>
                  {form.links.primary}
                  {!identity?.handle && !form.links.formkit ? " (no link claimed yet)" : ""}
                </div>
              </div>
            )}

            <PropRow label="Show logos" hint="Turn off for an unbranded form">
              <Switch checked={theme.showLogo} label="Show logos" onChange={(on) => set({ showLogo: on })} />
            </PropRow>

            <div className="fk-leadlogo">
              <span className="fk-leadlogo-mark">
                {identity?.logoUrl ? (
                  <img src={identity.logoUrl} alt="Logo" />
                ) : (
                  <ImageIcon size={18} strokeWidth={1.8} aria-hidden />
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>
                  {identity?.name ?? "You"}
                </span>
                <span className="fk-proprow-hint" style={{ display: "block" }}>
                  {identity?.logoUrl
                    ? "From Settings → Companies"
                    : identity?.kind === "company"
                      ? "No logo yet. Add one in Settings → Companies"
                      : "Your own forms carry your name. A company can carry a logo."}
                </span>
              </span>
              {!identity?.logoUrl && (
                <Link
                  href={`/app/settings?tab=companies${form.brand !== "me" ? `&co=${form.brand}` : ""}`}
                  className="ui-btn"
                  data-variant="secondary"
                  data-size="sm"
                >
                  <Upload size={15} strokeWidth={1.8} aria-hidden />
                  Add logo
                </Link>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "16px 0 8px" }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Additional logos</span>
              <span className="fk-proprow-hint">
                {logos.length} of {MAX_EXTRA_LOGOS}
              </span>
            </div>
            <p className="fk-proprow-hint" style={{ margin: "0 0 8px" }}>
              {identity?.logoUrl
                ? "The logo of whoever this form is published under always leads the row. Add up to three more and they sit beside it, separated by a ×."
                : "Add a logo to a company in Settings → Companies and it leads the row for its forms. Up to three more sit beside it, separated by a ×."}
            </p>
            <p className="fk-proprow-hint" style={{ margin: "0 0 12px", wordBreak: "break-word" }}>
              {chain}
            </p>

            {logos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {logos.map((l, i) => (
                  <div
                    key={`${l.storageId ?? l.name}-${i}`}
                    className="fk-logorow"
                    draggable
                    data-dragging={logoDrag === i ? "true" : undefined}
                    data-over={logoOver === i && logoDrag !== null && logoDrag !== i ? "true" : undefined}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", `fk-logo:${i}`);
                      setLogoDrag(i);
                    }}
                    onDragOver={(e) => {
                      if (logoDrag === null) return;
                      e.preventDefault();
                      if (logoOver !== i) setLogoOver(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (logoDrag !== null) moveLogo(logoDrag, i);
                    }}
                    onDragEnd={() => {
                      setLogoDrag(null);
                      setLogoOver(null);
                    }}
                  >
                    <span className="fk-logorow-grip" title="Drag to reorder">
                      <GripVertical size={15} strokeWidth={1.8} aria-hidden />
                    </span>
                    {logoUrls[i]?.url ? (
                      <img className="fk-logorow-thumb" src={logoUrls[i]!.url!} alt="" />
                    ) : (
                      <span className="fk-logorow-initial">{(l.name || "?").charAt(0)}</span>
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <input
                        className="fk-logorow-name"
                        value={l.name}
                        aria-label="Logo name"
                        onChange={(e) =>
                          set({ logos: logos.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                        }
                      />
                      <span className="fk-proprow-hint" style={{ display: "block", marginTop: 0 }}>
                        Additional logo {i + 1}
                      </span>
                    </span>
                    <IconButton
                      label={`Remove ${l.name || "this logo"}`}
                      onClick={() => {
                        set({ logos: logos.filter((_, j) => j !== i) });
                        toast("Logo removed", { detail: l.name });
                      }}
                    >
                      <X size={15} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}

            {logos.length < MAX_EXTRA_LOGOS ? (
              <label className="fk-logodrop" data-busy={uploading ? "true" : undefined}>
                <span className="fk-logodrop-mark">
                  <Plus size={18} strokeWidth={1.8} aria-hidden />
                </span>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 500, marginTop: 10 }}>
                  {uploading ? "Uploading…" : "Add a logo"}
                </span>
                <span className="fk-proprow-hint" style={{ display: "block", marginTop: 4 }}>
                  SVG or PNG · 2MB · {MAX_EXTRA_LOGOS - logos.length} of 3 slots left
                </span>
                <input
                  type="file"
                  accept="image/png,image/svg+xml"
                  multiple
                  aria-label="Upload an additional logo"
                  disabled={uploading}
                  onChange={(e) => {
                    void addLogos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : (
              <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
                Three additional logos is the limit. Remove one to add another.
              </p>
            )}

            <PropRow label="Alignment">
              <Segmented
                ariaLabel="Logo alignment"
                size="sm"
                value={theme.logoAlign}
                onChange={(logoAlign) => set({ logoAlign })}
                options={[
                  { value: "left", title: "Left", icon: <AlignLeft size={15} strokeWidth={1.8} aria-hidden /> },
                  { value: "center", title: "Centre", icon: <AlignCenter size={15} strokeWidth={1.8} aria-hidden /> },
                  { value: "right", title: "Right", icon: <AlignRight size={15} strokeWidth={1.8} aria-hidden /> },
                ]}
              />
            </PropRow>
            <PropRow label="Logo size">
              <div style={{ width: 130 }}>
                <Select
                  size="sm"
                  ariaLabel="Logo size"
                  value={theme.logoSize}
                  onChange={(v) => set({ logoSize: v as Theme["logoSize"] })}
                  options={["Small", "Medium", "Large"].map((v) => ({ value: v, label: v }))}
                />
              </div>
            </PropRow>
          </div>
        )}
      </aside>

      {/* ---------- preview ---------- */}
      <div className="fk-design-preview">
        <div className="fk-design-bar">
          <Badge>
            <Eye size={13} strokeWidth={1.8} aria-hidden /> Live preview
          </Badge>
          <span style={{ flex: 1, minWidth: 10 }} />
          <Segmented
            ariaLabel="Preview device"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", title: "Desktop", icon: <Monitor size={16} strokeWidth={1.8} aria-hidden /> },
              { value: "tablet", title: "Tablet", icon: <Tablet size={16} strokeWidth={1.8} aria-hidden /> },
              { value: "mobile", title: "Mobile", icon: <Smartphone size={16} strokeWidth={1.8} aria-hidden /> },
            ]}
          />
          <Button
            variant="secondary"
            iconLeft={<Maximize2 size={16} strokeWidth={1.8} aria-hidden />}
            onClick={() => openPreview({ device })}
          >
            Full screen
          </Button>
        </div>

        <div
          className="fk-theme-shell"
          style={{ width: deviceWidth, background: theme.bg, color: theme.text }}
        >
          <div
            className="fk-theme-inner"
            data-split={split ? "true" : undefined}
            style={{
              maxWidth: COLUMN[theme.layout],
              margin: theme.layout === "full" ? 0 : "0 auto",
              fontFamily: fontStack(theme.font),
            }}
          >
            {theme.showLogo && (
              <LogoLockup
                lead={identity ? { name: identity.name, logoUrl: identity.logoUrl } : null}
                extras={logos.map((l, i) => ({ name: l.name, url: logoUrls[i]?.url ?? null }))}
                align={split ? "left" : theme.logoAlign}
                size={LOGO_PX[theme.logoSize]}
              />
            )}
            <h1
              style={{
                fontFamily: fontStack(theme.heading),
                fontSize: 40 * scale,
                fontWeight: WEIGHTS[theme.weight],
                letterSpacing: "-.022em",
                lineHeight: 1.06,
                textAlign: split ? "left" : "center",
                margin: "26px 0 0",
              }}
            >
              {form.welcome?.title || form.title}
            </h1>
            <p
              style={{
                fontSize: 17 * scale,
                lineHeight: 1.6,
                textAlign: split ? "left" : "center",
                margin: "12px 0 0",
                opacity: 0.62,
              }}
            >
              {form.welcome?.message || "A few questions. It should take about two minutes."}
            </p>

            <div style={{ marginTop: 38, display: "flex", flexDirection: "column", gap: 26 }}>
              {questionPreview.map((q) => (
                <div key={q._id}>
                  <div
                    style={{
                      fontFamily: fontStack(theme.heading),
                      fontSize: 19 * scale,
                      fontWeight: 500,
                      letterSpacing: "-.01em",
                      marginBottom: 12,
                    }}
                  >
                    {q.title || "Untitled question"}
                  </div>
                  {q.options?.length && q.type !== "dropdown" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {q.options.slice(0, 3).map((o) => (
                        <span
                          key={o}
                          className="fk-theme-choice"
                          style={{ background: theme.surface, borderRadius: Math.min(theme.radius, 24) }}
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: q.type === "multi-choice" ? 5 : "50%",
                              boxShadow: `inset 0 0 0 1.5px ${theme.text}`,
                              opacity: 0.5,
                            }}
                          />
                          {o}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="fk-theme-field"
                      data-tall={q.type === "long-text" || q.type === "address" ? "true" : undefined}
                      style={{ background: theme.surface, borderRadius: Math.min(theme.radius, 24) }}
                    >
                      {q.placeholder || (q.type === "dropdown" ? "Choose one" : "")}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: split ? "flex-start" : "center", marginTop: 38 }}>
              <span
                className="fk-theme-button"
                style={{ background: theme.primary, color: ink, borderRadius: theme.radius }}
              >
                Submit
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
