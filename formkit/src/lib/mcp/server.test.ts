import { describe, expect, it, vi } from "vitest";
import { respond, TOOLS, Unauthorised, type ApiCall } from "./server";

const api = (status = 200, body: unknown = { ok: true }) => vi.fn<ApiCall>(async () => ({ status, body }));

describe("Formkit's MCP server", () => {
  it("agrees a protocol version and names itself", async () => {
    const r = await respond({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, api());
    expect(r?.result).toMatchObject({ protocolVersion: "2025-06-18", serverInfo: { name: "formkit" } });
    const later = await respond({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2099-01-01" } }, api());
    expect((later?.result as { protocolVersion: string }).protocolVersion).toBe("2025-11-25");
  });

  it("answers no notification", async () => {
    expect(await respond({ jsonrpc: "2.0", method: "notifications/initialized" }, api())).toBeNull();
  });

  it("lists its tools, none of them able to delete", async () => {
    const r = await respond({ jsonrpc: "2.0", id: 1, method: "tools/list" }, api());
    const tools = (r?.result as { tools: { name: string; annotations: { destructiveHint: boolean } }[] }).tools;
    expect(tools.map((t) => t.name)).toContain("create_form");
    expect(tools.every((t) => !t.annotations.destructiveHint && !/delete/.test(t.name))).toBe(true);
    expect(TOOLS).toHaveLength(tools.length);
  });

  it("calls the API for a tool, and reports what it refused", async () => {
    const ok = api(200, { id: "f1", title: "Sign-up" });
    const r = await respond({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_form", arguments: { form_id: "f1" } } }, ok);
    expect(ok).toHaveBeenCalledWith("GET", "forms/f1");
    expect(r?.result).toMatchObject({ isError: false, structuredContent: { title: "Sign-up" } });

    const no = api(403, { error: { message: "This key cannot do that." } });
    const refused = await respond({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "publish_form", arguments: { form_id: "f1" } } }, no);
    expect(refused?.result).toMatchObject({ isError: true, content: [{ text: "This key cannot do that." }] });
  });

  it("sends an expired token back to sign in", async () => {
    await expect(
      respond({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_forms", arguments: {} } }, api(401, {})),
    ).rejects.toBeInstanceOf(Unauthorised);
  });

  it("reads a form as a resource", async () => {
    const call = api(200, { id: "f1" });
    const r = await respond({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "formkit://forms/f1/summary" } }, call);
    expect(call).toHaveBeenCalledWith("GET", "forms/f1/summary");
    expect((r?.result as { contents: { uri: string }[] }).contents[0]!.uri).toBe("formkit://forms/f1/summary");
  });

  it("refuses an unknown method", async () => {
    const r = await respond({ jsonrpc: "2.0", id: 1, method: "sampling/createMessage" }, api());
    expect(r?.error?.code).toBe(-32601);
  });

  it("shows a form and responses in views, for hosts that can", async () => {
    const r = await respond({ jsonrpc: "2.0", id: 1, method: "tools/list" }, api());
    const tools = (r?.result as { tools: { name: string; _meta?: { ui?: { resourceUri: string } } }[] }).tools;
    expect(tools.find((t) => t.name === "get_form")?._meta?.ui?.resourceUri).toBe("ui://formkit/form-preview.html");
    expect(tools.find((t) => t.name === "list_responses")?._meta?.ui?.resourceUri).toBe("ui://formkit/responses.html");

    const listed = await respond({ jsonrpc: "2.0", id: 2, method: "resources/list" }, api(200, { data: [] }));
    expect((listed?.result as { resources: { uri: string; mimeType: string }[] }).resources).toEqual(
      expect.arrayContaining([expect.objectContaining({ uri: "ui://formkit/responses.html", mimeType: "text/html;profile=mcp-app" })]),
    );

    const page = await respond({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "ui://formkit/form-preview.html" } }, api());
    const content = (page?.result as { contents: { mimeType: string; text: string }[] }).contents[0]!;
    expect(content.mimeType).toBe("text/html;profile=mcp-app");
    expect(content.text).toMatch(/^<!doctype html>/);
    // Self-contained: nothing loaded from elsewhere, and data never written as HTML.
    expect(content.text).not.toMatch(/<script[^>]+src=|<link[^>]+href=|innerHTML/);

    const chatgpt = await respond({ jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "ui://formkit/responses.skybridge.html" } }, api());
    expect((chatgpt?.result as { contents: { mimeType: string }[] }).contents[0]!.mimeType).toBe("text/html+skybridge");
  });
});
