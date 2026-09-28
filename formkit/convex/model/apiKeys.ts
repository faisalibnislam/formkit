/** API keys are kept only as a SHA-256 hash; the key itself is shown once. */
export async function sha256Hex(text: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
