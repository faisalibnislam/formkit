"use client";

import { useViewer } from "@/lib/seed";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Briefcase,
  Check,
  Image as ImageIcon,
  Landmark,
  Link2,
  Mail,
  Phone,
  Plus,
  Quote,
  Receipt,
  Store,
  Trash2,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, ColorField, Field, Input, Modal, Switch, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ImageUpload } from "../ImageUpload";
import { Panel, Row, errorText } from "./bits";
import { PageSkeleton } from "../Skeleton";
import { DomainsPanel } from "./Domains";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate, usePlan } from "@/components/plan/usePlan";

/**
 * Settings → Companies. The person is the account; companies are optional and
 * plural, each with its own link, logo, details and brand. One claim path
 * serves the person and every company, so a name cannot be taken twice.
 */

type Company = FunctionReturnType<typeof api.companies.list>[number];

export function CompanySection() {
  const toast = useToast();
  const viewer = useViewer();
  const companies = useQuery(api.companies.list, {});
  const add = useMutation(api.companies.add);
  const setPrefs = useMutation(api.users.setPreferences);
  const plan = usePlan();
  const badgeGate = useGate("brand.badge");
  const brandsGate = useGate("brands");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  if (!viewer || !companies) return <PageSkeleton kind="panel" />;
  const selected = companies.find((c) => c._id === open) ?? null;
  const cap = plan?.limits.companies ?? null;
  const full = cap !== null && companies.length >= cap;
  // Free goes to Pro for five; Pro goes to Business for as many as you like.
  const next = brandsGate.locked ? "brands" : "brands.unlimited";

  return (
    <>
      <HandleCard
        owner="me"
        current={viewer.handle}
        title="Your own Formkit link"
        lede="Claim your name and anything you publish as yourself is shared under it. Companies claim their own links further down."
        placeholder="your-name"
      />

      <Panel title="Your own forms" lede="Forms you publish as yourself rather than under a company.">
        <Row
          label="Show “Made with Formkit”"
          hint={
            <>
              A small credit at the bottom of the form and its confirmation email.{" "}
              {badgeGate.locked && <ProChip onClick={() => openUpgrade({ feature: "brand.badge" })} />}
            </>
          }
        >
          <Switch
            checked={!viewer.hideBadge || badgeGate.locked}
            label="Show Made with Formkit on my own forms"
            onChange={badgeGate.guard(async (on: boolean) => {
              try {
                await setPrefs({ hideBadge: !on });
              } catch (e) {
                if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
              }
            })}
          />
        </Row>
      </Panel>

      <Panel
        title="Companies"
        lede="Optional: a studio, a side project, a client you invoice through. Each one claims its own link and carries its own logo and colour. One company on Free, five on Pro, as many as you need on Business."
        aside={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {full && (
              <ProChip plan={next === "brands" ? "pro" : "business"} onClick={() => openUpgrade({ feature: next })} />
            )}
            <Button
              variant="secondary"
              iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}
              onClick={() => (full ? openUpgrade({ feature: next }) : setAdding(true))}
            >
              Add a company
            </Button>
          </span>
        }
      >
        {companies.length === 0 ? (
          <p className="fk-setpanel-empty">
            You are on Formkit as yourself. Forms go out under your own name, which is all most people need.
          </p>
        ) : (
          <div className="fk-corows">
            {companies.map((c) => (
              <div key={c._id} className="fk-corow" data-open={c._id === open ? "true" : undefined}>
                <span className="fk-corow-mark" style={{ background: c.brandColor ?? "var(--blue-300)" }} aria-hidden>
                  {c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.name.trim().charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="fk-corow-name">{c.name}</span>
                  <span className="fk-corow-link">{c.handle ? `formkit.app/${c.handle}` : "No link claimed"}</span>
                </span>
                <span className="fk-corow-count">
                  {c.formCount} {c.formCount === 1 ? "form" : "forms"}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setOpen(c._id === open ? null : c._id)}>
                  {c._id === open ? "Editing" : "Open"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {selected && <CompanyEditor key={selected._id} company={selected} onDone={() => setOpen(null)} />}

      <DomainsPanel
        identities={[
          { value: "me" as const, label: `${viewer.name} (you)`, handle: viewer.handle },
          ...companies.map((c) => ({ value: c._id, label: c.name, handle: c.handle ?? null })),
        ]}
      />

      {adding && (
        <Modal
          title="Add a company"
          description="A brand a form can go out under. You can fill in the rest after."
          onClose={() => setAdding(false)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                disabled={!name.trim()}
                onClick={async () => {
                  let id;
                  try {
                    id = await add({ name });
                  } catch (e) {
                    setAdding(false);
                    if (!upgradeOnPlanError(e)) toast(errorText(e, "That company could not be added."));
                    return;
                  }
                  toast(`${name.trim()} added`, { detail: "Claim its link and add its logo below" });
                  setName("");
                  setAdding(false);
                  setOpen(id);
                }}
              >
                Add company
              </Button>
            </>
          }
        >
          <Field label="Company name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Studio Nine"
              icon={<Store size={17} strokeWidth={1.8} aria-hidden />}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}

/** Claiming, changing or releasing a formkit.app/<name> link. */
function HandleCard({
  owner,
  current,
  title,
  lede,
  placeholder,
}: {
  owner: "me" | Id<"companies">;
  current: string | null;
  title: string;
  lede: string;
  placeholder: string;
}) {
  const toast = useToast();
  const claim = useMutation(api.companies.claim);
  const release = useMutation(api.companies.release);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current ?? "";
  const changed = value.trim().toLowerCase() !== (current ?? "");
  const check = useQuery(
    api.handles.check,
    changed && value.trim().length >= 2
      ? { handle: value, companyId: owner === "me" ? undefined : owner }
      : "skip",
  );
  const [error, setError] = useState("");

  return (
    <Panel title={title} lede={lede}>
      <div className="fk-handle">
        <span className="fk-handle-prefix">formkit.app/</span>
        <Input
          value={value}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
          placeholder={placeholder}
          invalid={!!error || (check ? !check.ok : undefined)}
          aria-label={title}
          wrapStyle={{ flex: 1, minWidth: 160, maxWidth: 280 }}
        />
      </div>
      <div className="fk-handle-preview">
        <Link2 size={14} strokeWidth={1.8} aria-hidden />
        formkit.app/{(check?.handle ?? value.trim().toLowerCase()) || placeholder}/client-onboarding
      </div>
      {(error || check?.problem) && <div className="ui-error fk-handle-msg">{error || check?.problem}</div>}
      <div className="fk-setpanel-actions">
        <Button
          iconLeft={<Check size={16} strokeWidth={1.8} aria-hidden />}
          disabled={!changed || !value.trim() || (check ? !check.ok : true)}
          onClick={async () => {
            try {
              const h = await claim({ owner, handle: value });
              setDraft(null);
              toast(`formkit.app/${h ?? value.trim().toLowerCase()} is yours`, {
                detail: "Forms published under it use it straight away",
              });
            } catch (e) {
              setError(errorText(e, "That name could not be claimed."));
            }
          }}
        >
          {current ? "Save link" : "Claim link"}
        </Button>
        {current && (
          <Button
            variant="ghost"
            onClick={async () => {
              await release({ owner });
              setDraft(null);
              toast("Link released", { detail: "Those forms are back at formkit.app/f/ links" });
            }}
          >
            Release it
          </Button>
        )}
      </div>
    </Panel>
  );
}

const DETAILS = [
  { key: "name", label: "Company name", icon: Store, placeholder: "Studio Nine" },
  { key: "legalName", label: "Legal entity name", icon: Landmark, placeholder: "Studio Nine LLC" },
  { key: "tagline", label: "Tagline", icon: Quote, placeholder: "What you do, in a few words" },
  { key: "industry", label: "Industry", icon: Briefcase, placeholder: "Design studio" },
  { key: "website", label: "Website", icon: Link2, placeholder: "studionine.co" },
  { key: "contactEmail", label: "Contact email", icon: Mail, placeholder: "hello@studionine.co" },
  { key: "phone", label: "Phone number", icon: Phone, placeholder: "+1 415 555 0180" },
  { key: "taxId", label: "Tax or VAT ID", icon: Receipt, placeholder: "US 88-1234567" },
] as const;

type DetailKey = (typeof DETAILS)[number]["key"] | "address" | "brandColor";

function CompanyEditor({ company, onDone }: { company: Company; onDone: () => void }) {
  const badgeGate = useGate("brand.badge");
  const toast = useToast();
  const update = useMutation(api.companies.update);
  const setLogo = useMutation(api.companies.setLogo);
  const remove = useMutation(api.companies.remove);
  const [draft, setDraft] = useState<Partial<Record<DetailKey, string>>>({});
  const [confirm, setConfirm] = useState(false);
  const val = (k: DetailKey) => draft[k] ?? ((company as Record<string, unknown>)[k] as string | undefined) ?? "";
  const dirty = Object.keys(draft).length > 0;

  return (
    <>
      <div className="fk-coedit-bar">
        <span>Editing {company.name}</span>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>

      <Panel
        title="Company logo"
        lede="Used on published forms, emails and exports. SVG or PNG, at least 200px tall, transparent background if you have one."
      >
        <ImageUpload
          label="Logo"
          help="Up to 5 MB. Without one, the first letter of the name stands in."
          hasImage={!!company.logoUrl}
          preview={
            <span className="fk-logo-plate">
              {company.logoUrl ? <img src={company.logoUrl} alt="" /> : <ImageIcon size={22} strokeWidth={1.6} aria-hidden />}
            </span>
          }
          onUploaded={async (storageId) => {
            await setLogo({ companyId: company._id, storageId });
            toast("Logo uploaded");
          }}
          onCleared={async () => {
            await setLogo({ companyId: company._id, storageId: null });
            toast("Logo removed", { detail: "The initial is showing again" });
          }}
        />
      </Panel>

      <HandleCard
        owner={company._id}
        current={company.handle ?? null}
        title="This company's Formkit link"
        lede={`Forms published under ${company.name} are shared from this link. Without one they fall back to formkit.app/f/ and a random-looking slug.`}
        placeholder="your-company"
      />

      <Panel title="Company details">
        <div className="fk-fieldgrid">
          {DETAILS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                value={val(f.key)}
                placeholder={f.placeholder}
                icon={<f.icon size={17} strokeWidth={1.8} aria-hidden />}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label="Registered address">
            <Textarea
              rows={3}
              value={val("address")}
              placeholder="Street, city, state, ZIP, country"
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Brand defaults" lede="Applied to every new form so you are not restyling each one.">
        <div className="fk-brandcolor">
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14.5 }}>Brand color</span>
            <span className="fk-proprow-hint">{val("brandColor") || "Not set"}</span>
          </span>
          <ColorField
            label="Brand color"
            presets={["#2e78bb", "#21282e", "#4b9d6e", "#c4614f", "#8a5cc2", "#d9a13b"]}
            value={val("brandColor") || "#2e78bb"}
            onChange={(hex) => setDraft((d) => ({ ...d, brandColor: hex }))}
          />
        </div>
        <Row label="Use company branding on new forms" hint="Logo, name and brand color, applied automatically">
          <Switch
            checked={!!company.useBranding}
            label="Use company branding on new forms"
            onChange={(on) => void update({ companyId: company._id, patch: { useBranding: on } })}
          />
        </Row>
        <Row
          label="Show “Made with Formkit”"
          hint={
            <>
              A small credit at the bottom of this company&rsquo;s forms and confirmation emails.{" "}
              {badgeGate.locked && <ProChip onClick={() => openUpgrade({ feature: "brand.badge" })} />}
            </>
          }
        >
          <Switch
            checked={company.badge !== false || badgeGate.locked}
            label="Show Made with Formkit"
            onChange={(on) =>
              !on && badgeGate.locked
                ? openUpgrade({ feature: "brand.badge" })
                : void update({ companyId: company._id, patch: { badge: on } }).catch((e) => upgradeOnPlanError(e))
            }
          />
        </Row>
        <div className="fk-setpanel-actions">
          <Button
            iconLeft={<Check size={16} strokeWidth={1.8} aria-hidden />}
            disabled={!dirty}
            onClick={async () => {
              const patch = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v?.trim() ?? ""]));
              if ("name" in patch && !patch.name) {
                toast("A company needs a name", { tone: "error" });
                return;
              }
              try {
                await update({ companyId: company._id, patch });
                setDraft({});
                toast("Company saved", { detail: `${patch.name ?? company.name} · applied to new forms` });
              } catch (e) {
                toast("That was not saved", { detail: errorText(e, ""), tone: "error" });
              }
            }}
          >
            Save company
          </Button>
          <Button variant="ghost" iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />} onClick={() => setConfirm(true)}>
            Remove company
          </Button>
        </div>
      </Panel>

      {confirm && (
        <Modal
          title={`Remove ${company.name}?`}
          description={
            company.formCount
              ? `Its ${company.formCount} ${company.formCount === 1 ? "form goes" : "forms go"} back to publishing under your own name. Its link is released.`
              : "Its link is released. No forms use it."
          }
          onClose={() => setConfirm(false)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await remove({ companyId: company._id });
                  toast(`${company.name} removed`, { detail: "Its forms now publish under your own name" });
                  onDone();
                }}
              >
                Remove company
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </>
  );
}
