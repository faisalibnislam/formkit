"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, Field, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useEscape } from "@/components/ui/useEscape";
import { OwnerMark } from "./owners";
import { errorText } from "./settings/bits";

/**
 * The company switcher, beside the logo. Every account has its own company
 * and can make as many more as it likes; each is its own workspace with its
 * own forms, members and plan. Switching is remembered on the account.
 */

const PLAN_WORD = { free: "Free", pro: "Pro", business: "Business" } as const;
const ROLE_WORD = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" } as const;

export function CompanySwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const toast = useToast();
  const data = useQuery(api.spaces.list, {});
  const setCurrent = useMutation(api.spaces.setCurrent);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  useEscape(open, () => setOpen(false));

  // A link can open a company: invitations send people to /app?space=<key>.
  useEffect(() => {
    const want = search.get("space");
    if (!want) return;
    const t = window.setTimeout(() => {
      void setCurrent({ key: want })
        .catch((e) => toast(errorText(e, "That company could not be opened.")))
        .finally(() => {
          const next = new URLSearchParams(search.toString());
          next.delete("space");
          router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
        });
    }, 0);
    return () => window.clearTimeout(t);
  }, [search, pathname, router, setCurrent, toast]);

  if (!data) return <span className="fk-switcher" aria-hidden data-loading="true" />;
  const current = data.spaces.find((s) => s.key === data.current) ?? data.spaces[0]!;
  const mark = (s: (typeof data.spaces)[number], size: number) => (
    <OwnerMark owner={{ key: s.key, kind: s.kind, name: s.name, imageUrl: s.imageUrl }} size={size} />
  );

  async function pick(key: string) {
    setOpen(false);
    if (key === data!.current) return;
    try {
      await setCurrent({ key });
      // A form belongs to one company; its page makes no sense in another.
      if (pathname?.startsWith("/app/forms/")) router.push("/app");
    } catch (e) {
      toast(errorText(e, "That company could not be opened."));
    }
  }

  return (
    <span className="fk-switcher">
      <button
        type="button"
        className="fk-switcher-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Company: ${current.name}. Switch company`}
        onClick={() => setOpen((v) => !v)}
      >
        {mark(current, 24)}
        <span className="fk-switcher-name">{current.name}</span>
        <span className="fk-switcher-plan">{PLAN_WORD[current.plan]}</span>
        <ChevronsUpDown size={15} strokeWidth={1.8} aria-hidden />
      </button>
      {open && (
        <>
          <span className="fk-menu-scrim" onClick={() => setOpen(false)} aria-hidden />
          <span className="fk-menu fk-switcher-menu" data-align="left" role="menu">
            <span className="fk-menu-head">Your companies</span>
            {data.spaces.map((s) => (
              <button
                key={s.key}
                type="button"
                role="menuitemradio"
                aria-checked={s.key === data.current}
                className="fk-menu-item fk-switcher-item"
                onClick={() => void pick(s.key)}
              >
                {mark(s, 28)}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="fk-switcher-item-name">{s.name}</span>
                  <span className="fk-switcher-item-meta">
                    {s.kind === "me" && s.mine ? "Personal" : ROLE_WORD[s.role]} · {PLAN_WORD[s.plan]}
                    {s.plan !== "free" ? ` · ${s.seats} ${s.seats === 1 ? "seat" : "seats"}` : ""}
                  </span>
                </span>
                {s.key === data.current && <Check size={16} strokeWidth={2} aria-hidden />}
              </button>
            ))}
            <span className="fk-menu-rule" />
            <button
              type="button"
              role="menuitem"
              className="fk-menu-item"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              <Plus size={16} strokeWidth={1.8} aria-hidden />
              Create a company
            </button>
            <Link role="menuitem" href="/app/settings?tab=company" className="fk-menu-item" onClick={() => setOpen(false)}>
              <Settings2 size={16} strokeWidth={1.8} aria-hidden />
              {current.name} settings
            </Link>
          </span>
        </>
      )}
      {creating && <CreateCompany onClose={() => setCreating(false)} />}
    </span>
  );
}

function CreateCompany({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const create = useMutation(api.spaces.create);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await create({ name });
      toast(`${name.trim()} is ready`, { detail: "Add its logo and invite people in its settings." });
      onClose();
      router.push("/app/settings?tab=company");
    } catch (e) {
      toast(errorText(e, "That company could not be made."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Create a company"
      description="A separate workspace with its own forms, members, brand and plan. Free to start."
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || busy} onClick={() => void go()}>
            {busy ? "Creating…" : "Create company"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <Field label="Company name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio Nine" maxLength={80} />
        </Field>
      </form>
    </Modal>
  );
}
