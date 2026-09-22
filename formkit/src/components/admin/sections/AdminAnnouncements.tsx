"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { fullTime } from "@/components/app/bits";

/** A message on every customer's dashboard. */
export function AdminAnnouncements() {
  const toast = useToast();
  const list = useQuery(api.admin.announcements, {});
  const save = useMutation(api.admin.saveAnnouncement);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <>
      <section className="fk-panel">
        <h3>Write one</h3>
        <p className="fk-panel-lede">
          Say what changed and what it means for them. No exclamation marks, no sales pitch.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Excel exports are here"
            />
          </Field>
          <Field label="Message">
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Export responses straight to a spreadsheet with the columns intact."
            />
          </Field>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              disabled={!title.trim() || !body.trim()}
              onClick={async () => {
                await save({ title, body, state: "live" });
                toast("Published to every dashboard");
                setTitle("");
                setBody("");
              }}
            >
              Publish
            </Button>
            <Button
              variant="secondary"
              disabled={!title.trim()}
              onClick={async () => {
                await save({ title, body, state: "draft" });
                toast("Saved as a draft");
                setTitle("");
                setBody("");
              }}
            >
              Save a draft
            </Button>
          </div>
        </div>
      </section>

      {(list ?? []).map((a) => (
        <section key={a._id} className="fk-panel">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h3 style={{ flex: 1, margin: 0 }}>{a.title}</h3>
            <Badge tone={a.state === "live" ? "success" : a.state === "draft" ? "draft" : "neutral"}>
              {a.state === "live" ? "Live" : a.state === "draft" ? "Draft" : "Ended"}
            </Badge>
          </div>
          <p className="fk-panel-lede">
            {a.audience} · {fullTime(a.createdAt)}
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.6, maxWidth: "68ch" }}>
            {a.body}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {a.state !== "live" && (
              <Button
                size="sm"
                onClick={() =>
                  save({ announcementId: a._id, title: a.title, body: a.body, state: "live" })
                }
              >
                Publish
              </Button>
            )}
            {a.state === "live" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  save({ announcementId: a._id, title: a.title, body: a.body, state: "ended" })
                }
              >
                End it
              </Button>
            )}
          </div>
        </section>
      ))}
    </>
  );
}
