"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  PillTabs,
  Switch,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "./ds";
import { ImageUpload } from "./ImageUpload";
import { fullTime } from "./bits";

/**
 * Account settings.
 *
 * Identity is person-first: the account is a person, companies are optional and
 * plural, and each identity can claim one link of its own.
 */
type Tab = "account" | "companies" | "sharing" | "emails";

export function Settings() {
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();

  /* The section is read from the URL rather than held in state, so the account
     menu's "Companies and branding" lands on that section even from inside
     Settings — a soft navigation does not remount this component, so seeded
     state would have kept whichever section was already open. */
  const tab: Tab = (search.get("tab") as Tab) ?? "account";
  const setTab = (next: Tab) =>
    router.replace(next === "account" ? "/app/settings" : `/app/settings?tab=${next}`, {
      scroll: false,
    });

  const viewer = useQuery(api.users.viewer, {});
  const companies = useQuery(api.companies.list, {});
  const shared = useQuery(api.collaborators.sharedWithMe, {});
  const log = useQuery(api.notifications.log, {});

  const updateProfile = useMutation(api.users.updateProfile);
  const setAvatar = useMutation(api.users.setAvatar);
  const setLogo = useMutation(api.companies.setLogo);
  const addCompany = useMutation(api.companies.add);
  const updateCompany = useMutation(api.companies.update);
  const removeCompany = useMutation(api.companies.remove);
  const claim = useMutation(api.companies.claim);
  const release = useMutation(api.companies.release);

  const [handle, setHandle] = useState("");
  const [newCompany, setNewCompany] = useState("");

  if (!viewer) return null;

  return (
    <div className="fk-settings">
      <div className="fk-panel" data-pad="tight">
        <PillTabs
          ariaLabel="Settings section"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "account", label: "Account" },
            { value: "companies", label: "Companies" },
            { value: "sharing", label: "Sharing" },
            { value: "emails", label: "Email log" },
          ]}
        />
      </div>

      {tab === "account" && (
        <>
          <section className="fk-panel">
            <h3>You</h3>
            <p className="fk-panel-lede">
              This is the account. Companies are optional, and you can have several.
            </p>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <ImageUpload
                label="Your picture"
                help="PNG, JPEG, WebP or SVG, up to 5 MB. It appears wherever your name does."
                hasImage={!!viewer.image}
                preview={<Avatar name={viewer.name} image={viewer.image} size="xl" />}
                onUploaded={(storageId) => setAvatar({ storageId })}
                onCleared={() => setAvatar({ storageId: null })}
              />
              <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Name">
                  <Input
                    defaultValue={viewer.name}
                    onBlur={(e) => updateProfile({ name: e.target.value })}
                  />
                </Field>
                <Field label="Email" help="Sign-in address. Changing it needs a new code.">
                  <Input readOnly value={viewer.email} />
                </Field>
                <Field label="Time zone" help="Dates and times in the app are shown in this zone.">
                  <Input
                    defaultValue={viewer.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
                    onBlur={(e) => updateProfile({ timezone: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="fk-panel">
            <h3>Your link</h3>
            <p className="fk-panel-lede">
              Claiming a name moves every form you publish under your own name from
              <strong> formkit.app/f/…</strong> to <strong>formkit.app/{viewer.handle || "your-name"}/…</strong>.
            </p>
            {viewer.handle ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="fk-chip" style={{ fontSize: 14.5, padding: "10px 16px" }}>
                  formkit.app/{viewer.handle}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await release({ owner: "me" });
                    toast("Link released", {
                      detail: "Your forms are back at formkit.app/f/ links.",
                    });
                  }}
                >
                  Release it
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="your-name"
                  style={{ maxWidth: 260 }}
                />
                <Button
                  disabled={handle.trim().length < 3}
                  onClick={async () => {
                    try {
                      await claim({ owner: "me", handle });
                      toast(`formkit.app/${handle.trim().toLowerCase()} is yours`);
                      setHandle("");
                    } catch (e) {
                      toast("That name could not be claimed", {
                        detail: e instanceof Error ? e.message : undefined,
                        tone: "error",
                      });
                    }
                  }}
                >
                  Claim it
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      {tab === "companies" && (
        <>
          <section className="fk-panel">
            <h3>Add a company</h3>
            <p className="fk-panel-lede">
              A company is a hat you wear — a brand a form can go out under. You do not need one.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Input
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="Studio Nine"
                style={{ flex: 1, minWidth: 200 }}
              />
              <Button
                iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}
                disabled={!newCompany.trim()}
                onClick={async () => {
                  await addCompany({ name: newCompany });
                  toast(`${newCompany.trim()} added`);
                  setNewCompany("");
                }}
              >
                Add
              </Button>
            </div>
          </section>

          {(companies ?? []).length === 0 ? (
            <section className="fk-panel">
              <EmptyState
                title="No companies"
                description="Your forms publish under your own name until you add one."
              />
            </section>
          ) : (
            (companies ?? []).map((c) => (
              <section key={c._id} className="fk-panel">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <h3 style={{ flex: 1, margin: 0 }}>{c.name}</h3>
                  <Badge>{c.formCount} {c.formCount === 1 ? "form" : "forms"}</Badge>
                  <IconButton
                    label={`Delete ${c.name}`}
                    tone="danger"
                    onClick={async () => {
                      await removeCompany({ companyId: c._id });
                      toast(`${c.name} removed`, {
                        detail: "Its forms now publish under your own name.",
                      });
                    }}
                  >
                    <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <ImageUpload
                    label="Logo"
                    help="Shown on this company's published forms and in the emails they send. Up to 5 MB."
                    hasImage={!!c.logoUrl}
                    preview={
                      <span className="fk-logo-plate">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt="" />
                        ) : (
                          <ImageIcon size={22} strokeWidth={1.6} aria-hidden />
                        )}
                      </span>
                    }
                    onUploaded={(storageId) => setLogo({ companyId: c._id, storageId })}
                    onCleared={() => setLogo({ companyId: c._id, storageId: null })}
                  />

                  <div className="fk-fieldrow">
                    <Field label="Name">
                      <Input
                        defaultValue={c.name}
                        onBlur={(e) => updateCompany({ companyId: c._id, patch: { name: e.target.value } })}
                      />
                    </Field>
                    <Field label="Website">
                      <Input
                        defaultValue={c.website ?? ""}
                        placeholder="studionine.co"
                        onBlur={(e) =>
                          updateCompany({ companyId: c._id, patch: { website: e.target.value } })
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Tagline" help="Shown under the name on a branded form.">
                    <Textarea
                      rows={2}
                      defaultValue={c.tagline ?? ""}
                      onBlur={(e) =>
                        updateCompany({ companyId: c._id, patch: { tagline: e.target.value } })
                      }
                    />
                  </Field>

                  <Field label="Link">
                    {c.handle ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="fk-chip" style={{ fontSize: 14.5, padding: "10px 16px" }}>
                          formkit.app/{c.handle}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => release({ owner: c._id as Id<"companies"> })}
                        >
                          Release it
                        </Button>
                      </div>
                    ) : (
                      <CompanyHandleField companyId={c._id} />
                    )}
                  </Field>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ flex: 1, fontSize: 14.5 }}>
                      New forms default to this company&rsquo;s branding
                    </span>
                    <Switch
                      checked={!!c.useBranding}
                      label={`New forms default to ${c.name}`}
                      onChange={(on) => updateCompany({ companyId: c._id, patch: { useBranding: on } })}
                    />
                  </div>
                </div>
              </section>
            ))
          )}
        </>
      )}

      {tab === "sharing" && (
        <section className="fk-panel" data-pad="none">
          <div style={{ padding: "22px 24px 8px" }}>
            <h3 style={{ margin: 0 }}>Forms shared with you</h3>
            <p className="fk-panel-lede" style={{ margin: "6px 0 0" }}>
              People add you to a form from its own Collaborators panel.
            </p>
          </div>
          {(shared ?? []).length === 0 ? (
            <div style={{ padding: "8px 24px 24px" }}>
              <EmptyState title="Nothing shared with you" description="Forms other people put you on appear here." />
            </div>
          ) : (
            <div className="fk-rows" style={{ marginTop: 10 }}>
              {(shared ?? []).map((s) => (
                <Link key={s._id} href={`/app/forms/${s.formId}`} className="fk-row">
                  <span className="fk-row-main">
                    <span className="fk-row-title">{s.title}</span>
                    <span className="fk-row-meta">
                      {s.owner} · you are a {s.role}
                    </span>
                  </span>
                  <span className="fk-row-side">
                    <Badge tone={s.status === "active" ? "success" : "warning"}>
                      {s.status === "active" ? "Active" : "Pending"}
                    </Badge>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "emails" && (
        <section className="fk-panel" data-pad="none">
          <div style={{ padding: "22px 24px 8px" }}>
            <h3 style={{ margin: 0 }}>Email log</h3>
            <p className="fk-panel-lede" style={{ margin: "6px 0 0" }}>
              Every notification, confirmation and export Formkit sent on your behalf.
            </p>
          </div>
          {(log ?? []).length === 0 ? (
            <div style={{ padding: "8px 24px 24px" }}>
              <EmptyState title="Nothing sent yet" description="This fills up as your forms collect answers." />
            </div>
          ) : (
            <div className="fk-rows" style={{ marginTop: 10 }}>
              {(log ?? []).map((e) => (
                <div key={e._id} className="fk-row" data-static="true">
                  <span className="fk-row-main">
                    <span className="fk-row-title">{e.subject}</span>
                    <span className="fk-row-meta">
                      {e.kind}
                      {e.form ? ` · ${e.form}` : ""} · to {e.to} · {fullTime(e.at)}
                      {e.state === "failed" && e.detail ? ` · ${e.detail}` : ""}
                    </span>
                  </span>
                  <span className="fk-row-side">
                    <Badge tone={e.state === "sent" ? "success" : "error"}>
                      {e.state === "sent" ? "Sent" : "Failed"}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** The claim field for one company, kept separate so each keeps its own text. */
function CompanyHandleField({ companyId }: { companyId: Id<"companies"> }) {
  const toast = useToast();
  const claim = useMutation(api.companies.claim);
  const [value, setValue] = useState("");
  const check = useQuery(api.handles.check, value.trim().length >= 2 ? { handle: value, companyId } : "skip");

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="studio-nine"
          invalid={check ? !check.ok : undefined}
          style={{ maxWidth: 260 }}
        />
        <Button
          disabled={!check?.ok}
          onClick={async () => {
            try {
              await claim({ owner: companyId, handle: value });
              toast(`formkit.app/${check?.handle} is yours`);
              setValue("");
            } catch (e) {
              toast("That name could not be claimed", {
                detail: e instanceof Error ? e.message : undefined,
                tone: "error",
              });
            }
          }}
        >
          Claim it
        </Button>
      </div>
      {check?.problem && (
        <span className="ui-error" style={{ marginTop: 6, display: "block" }}>
          {check.problem}
        </span>
      )}
    </>
  );
}
