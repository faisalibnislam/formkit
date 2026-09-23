/**
 * The script a Popup or Full screen embed loads.
 *
 *   <script src="https://formkit.app/embed.js" data-form="https://formkit.app/f/slug"
 *           data-mode="popup" data-label="Open the form" async></script>
 *
 * Popup puts a button where the tag sits and opens the form over the page;
 * Full screen opens it over the page straight away. Either closes with the ×,
 * a click on the backdrop, or Escape. Only formkit links are opened, so the
 * snippet cannot be pointed at anything else.
 */
const SOURCE = `(function () {
  var tag = document.currentScript;
  if (!tag) return;
  var src = tag.getAttribute("data-form") || "";
  var mode = tag.getAttribute("data-mode") || "popup";
  var label = tag.getAttribute("data-label") || "Open the form";
  var origin = new URL(tag.src).origin;
  var target;
  try { target = new URL(src, origin); } catch (e) { return; }
  if (target.origin !== origin && !/(^|\\.)formkit\\.app$/.test(target.hostname)) return;

  function open() {
    if (document.getElementById("fk-embed-layer")) return;
    var layer = document.createElement("div");
    layer.id = "fk-embed-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:" + (mode === "fullscreen" ? "0" : "4vh 16px") + ";background:rgba(28,32,35,.42);backdrop-filter:blur(4px)";
    var frame = document.createElement("iframe");
    frame.src = target.href;
    frame.title = "Form";
    frame.style.cssText = "width:100%;height:100%;max-width:" + (mode === "fullscreen" ? "none" : "760px") + ";border:0;border-radius:" + (mode === "fullscreen" ? "0" : "24px") + ";background:#fff;box-shadow:0 30px 70px -20px rgba(10,30,60,.35)";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close the form");
    close.textContent = "\\u00d7";
    close.style.cssText = "position:absolute;top:16px;right:16px;width:44px;height:44px;border:0;border-radius:50%;background:#fff;color:#21282E;font:500 24px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18)";
    function shut() {
      document.removeEventListener("keydown", onKey);
      layer.remove();
    }
    function onKey(e) { if (e.key === "Escape") shut(); }
    close.addEventListener("click", shut);
    layer.addEventListener("click", function (e) { if (e.target === layer) shut(); });
    document.addEventListener("keydown", onKey);
    layer.appendChild(frame);
    layer.appendChild(close);
    document.body.appendChild(layer);
    close.focus();
  }

  if (mode === "fullscreen") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", open);
    else open();
    return;
  }
  var button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText = "display:inline-flex;align-items:center;height:48px;padding:0 24px;border:0;border-radius:999px;background:#21282E;color:#fff;font:500 15px/1 system-ui,sans-serif;cursor:pointer";
  button.addEventListener("click", open);
  tag.parentNode.insertBefore(button, tag);
})();
`;

export function GET() {
  return new Response(SOURCE, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
