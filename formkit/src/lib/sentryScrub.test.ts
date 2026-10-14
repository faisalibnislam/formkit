import { expect, test } from "vitest";
import { scrubUrl } from "./sentryScrub";

test("error reports never carry tokens or answers from a URL", () => {
  expect(scrubUrl("https://formkit.app/r/abc123secret")).toBe("https://formkit.app/r/[token]");
  expect(scrubUrl("https://formkit.app/j/invite-token?x=1")).toBe("https://formkit.app/j/[token]");
  expect(scrubUrl("https://formkit.app/acme/sign-up?email=ada@example.com&budget=5000")).toBe("https://formkit.app/acme/sign-up");
  expect(scrubUrl("https://formkit.app/app/forms/f1#x")).toBe("https://formkit.app/app/forms/f1");
});
