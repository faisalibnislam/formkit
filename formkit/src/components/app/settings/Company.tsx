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
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { OwnerMark } from "../owners";

/**
 * Settings → Company: the company being worked in. A person's own company
 * carries their name and link; any other has its logos, link, details and
 * brand. Below, every company they can open, and making another. One claim
 * path serves the person and every company, so a name cannot be taken twice.
 */

type Company = NonNullable<FunctionReturnType<typeof api.companies.current>>;

export function CompanySection() {
  const toast = useToast();
  const viewer = useViewer();
  const company = useQuery(api.companies.current, {});
  const setPrefs = useMutation(api.users.setPreferences);
  const badgeGate = useGate("brand.badge");

  if (!viewer || company === undefined) return <PageSkeleton kind="panel" />;

  return (
    <>
      {company === null ? (
        <>
          <HandleCard
            owner="me"
            current={viewer.handle}
            title="Your own Formkit link"
            lede="Claim your name and anything published in your own company is shared under it. Other companies claim their own links."
            placeholder="your-name"
          />

          <Panel title="Your own company" lede="Your personal workspace: forms here go out under your own name.">
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

          <DomainsPanel identities={[{ value: "me" as const, label: `${viewer.name} (you)`, handle: viewer.handle }]} />
        </>
      ) : company.canManage ? (
        <>
          <CompanyEditor key={company._id} company={company} />
          {company.mine && (
            <DomainsPanel identities={[{ value: company._id, label: company.name, handle: company.handle ?? null }]} />
          )}
        </>
      ) : (
        <Panel
          title={company.name}
          lede="Only the company’s owner and admins can change its details, logos and brand."
        />
      )}

      <AllCompanies />
    </>
  );
}

/** Every company this person can open, with making another. */
function AllCompanies() {
  const toast = useToast();
  const data = useQuery(api.spaces.list, {});
  const open = useMutation(api.spaces.setCurrent);
  const create = useMutation(api.spaces.create);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!data) return null;
  const PLAN = { free: "Free", pro: "Pro", business: "Business" } as const;

  return (
    <Panel
      title="Your companies"
      lede="Each company is its own workspace: its own forms, members, brand and plan. Make as many as you like, free."
      aside={
        <Button variant="secondary" iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />} onClick={() => setAdding(true)}>
          Create a company
        </Button>
      }
    >
      <div className="fk-corows">
        {data.spaces.map((c) => (
          <div key={c.key} className="fk-corow" data-open={c.key === data.current ? "true" : undefined}>
            <OwnerMark owner={{ key: c.key, kind: c.kind, name: c.name, imageUrl: c.imageUrl }} size={38} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="fk-corow-name">{c.name}</span>
              <span className="fk-corow-link">
                {c.kind === "me" && c.mine ? "Personal" : c.role === "owner" ? "Owner" : c.role[0]!.toUpperCase() + c.role.slice(1)} ·{" "}
                {PLAN[c.plan]}
                {c.plan !== "free" ? ` · ${c.seats} ${c.seats === 1 ? "seat" : "seats"}` : ""}
              </span>
            </span>
            {c.key === data.current ? (
              <span className="fk-corow-count">Open now</span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void open({ key: c.key }).catch((e) => toast(errorText(e, "That company could not be opened.")))}
              >
                Open
              </Button>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <Modal
          title="Create a company"
          description="A separate workspace with its own forms, members, brand and plan. Free to start."
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
                  try {
                    await create({ name });
                  } catch (e) {
                    toast(errorText(e, "That company could not be made."));
                    return;
                  }
                  toast(`${name.trim()} is ready`, { detail: "You are working in it now. Add its logos below." });
                  setName("");
                  setAdding(false);
                }}
              >
                Create company
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
    </Panel>
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

function CompanyEditor({ company }: { company: Company }) {
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
      <Panel
        title="Company logos"
        lede="Two versions, so every place gets the one that fits. SVG or PNG with a transparent background works best, up to 5 MB each."
      >
        <div className="fk-logoslots">
          <div className="fk-logoslot">
            <div className="fk-logoslot-head">
              <span className="fk-logoslot-name">Full logo</span>
              <span className="fk-logoslot-where">Form headers, emails and your domain’s home page</span>
            </div>
            <ImageUpload
              label="Full logo"
              help="Your wordmark, or the symbol with the name beside it. At least 200px tall."
              hasImage={!!company.logoUrl}
              preview={
                <span className="fk-logo-plate" data-shape="wide">
                  {company.logoUrl ? <img src={company.logoUrl} alt="" /> : <ImageIcon size={22} strokeWidth={1.6} aria-hidden />}
                </span>
              }
              onUploaded={(storageId) => setLogo({ companyId: company._id, storageId, kind: "full" })}
              onCleared={() => setLogo({ companyId: company._id, storageId: null, kind: "full" })}
            />
          </div>
          <div className="fk-logoslot">
            <div className="fk-logoslot-head">
              <span className="fk-logoslot-name">Square logo</span>
              <span className="fk-logoslot-where">The browser tab on your forms, and beside the company name in Formkit</span>
            </div>
            <ImageUpload
              label="Square logo"
              help={
                company.markUrl
                  ? "Just the symbol, cropped square. At least 512 × 512px."
                  : company.logoUrl
                    ? "Just the symbol, cropped square. Until there is one, the full logo is shrunk to fit."
                    : "Just the symbol, cropped square. Until there is one, the first letter of the name stands in."
              }
              hasImage={!!company.markUrl}
              preview={
                <span className="fk-logo-plate" data-shape="square">
                  {company.markUrl ? (
                    <img src={company.markUrl} alt="" />
                  ) : (
                    <ImageIcon size={22} strokeWidth={1.6} aria-hidden />
                  )}
                </span>
              }
              onUploaded={(storageId) => setLogo({ companyId: company._id, storageId, kind: "square" })}
              onCleared={() => setLogo({ companyId: company._id, storageId: null, kind: "square" })}
            />
          </div>
        </div>
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
          {company.mine && (
            <Button variant="ghost" iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />} onClick={() => setConfirm(true)}>
              Delete company
            </Button>
          )}
        </div>
      </Panel>

      {confirm && (
        <Modal
          title={`Delete ${company.name}?`}
          description={
            company.formCount
              ? `Its ${company.formCount} ${company.formCount === 1 ? "form moves" : "forms move"} to your own company, its members lose access, and its link is released.`
              : "Its members lose access and its link is released."
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
                  try {
                    await remove({ companyId: company._id });
                  } catch (e) {
                    setConfirm(false);
                    toast(errorText(e, "That company could not be deleted."));
                    return;
                  }
                  toast(`${company.name} deleted`, { detail: "Its forms moved to your own company" });
                }}
              >
                Delete company
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
