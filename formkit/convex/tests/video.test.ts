import { expect, test } from "vitest";
import { videoEmbed } from "../model/video";

test("YouTube and Vimeo links become privacy-friendly embeds; nothing else does", () => {
  expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  expect(videoEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  expect(videoEmbed("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871?dnt=1");
  expect(videoEmbed("https://evil.example/embed")).toBeNull();
  expect(videoEmbed("javascript:alert(1)")).toBeNull();
});
