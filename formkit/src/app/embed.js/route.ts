/**
 * The script a Popup or Full screen embed loads.
 *
 *   <script src="https://formkit.app/embed.js" data-form="https://formkit.app/f/slug"
 *           data-mode="popup" data-label="Open the form" async></script>
 *
 * Inline puts the form where the tag sits and grows its frame to fit each
 * page. Popup puts a button there and opens the form over the page; Full
 * screen opens it over the page straight away. Either closes with the ×, a
 * click on the backdrop, or Escape, and keeps Tab inside while open. When the
 * form is sent, window gets a "formkit:submit" event with the response id.
 * Only forms on the script's own address (formkit.app, or the owner's domain
 * serving this same script) or on formkit.app are opened.
 */
const SOURCE = `(function () {
  var tag = document.currentScript;
  if (!tag) return;
  var src = tag.getAttribute("data-form") || "";
  var mode = tag.getAttribute("data-mode") || "popup";
  var label = tag.getAttribute("data-label") || "Open the form";
  var title = tag.getAttribute("data-title") || "Form";
  var origin = new URL(tag.src).origin;
  var target;
  try { target = new URL(src, origin); } catch (e) { return; }
  // The form must be on the address the script came from (formkit.app or
  // the owner's own domain), or on formkit.app.
  if (target.origin !== origin && !/(^|\\.)formkit\\.app$/.test(target.hostname)) return;

  // The form says how tall it is and when it has been sent.
  function listen(frame, sized) {
    window.addEventListener("message", function (e) {
      if (e.source !== frame.contentWindow || e.origin !== target.origin || !e.data) return;
      if (e.data.type === "formkit:resize" && sized && typeof e.data.height === "number") {
        frame.style.height = Math.max(200, Math.min(20000, Math.ceil(e.data.height))) + "px";
      }
      if (e.data.type === "formkit:submit") {
        window.dispatchEvent(new CustomEvent("formkit:submit", { detail: { formId: e.data.formId, responseId: e.data.responseId } }));
      }
    });
  }

  function makeFrame() {
    var frame = document.createElement("iframe");
    frame.src = target.href;
    frame.title = title;
    frame.setAttribute("allow", "microphone; clipboard-write");
    return frame;
  }

  if (mode === "inline") {
    var inline = makeFrame();
    inline.loading = "lazy";
    inline.style.cssText = "display:block;width:100%;height:720px;border:0;background:transparent";
    listen(inline, true);
    tag.parentNode.insertBefore(inline, tag);
    return;
  }

  function open() {
    if (document.getElementById("fk-embed-layer")) return;
    var opener = document.activeElement;
    var layer = document.createElement("div");
    layer.id = "fk-embed-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", title);
    layer.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:" + (mode === "fullscreen" ? "0" : "4vh 16px") + ";background:rgba(28,32,35,.42);backdrop-filter:blur(4px)";
    var frame = makeFrame();
    frame.style.cssText = "width:100%;height:100%;max-width:" + (mode === "fullscreen" ? "none" : "760px") + ";border:0;border-radius:" + (mode === "fullscreen" ? "0" : "24px") + ";background:#fff;box-shadow:0 30px 70px -20px rgba(10,30,60,.35)";
    listen(frame, false);
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close the form");
    close.textContent = "\\u00d7";
    close.style.cssText = "position:absolute;top:16px;right:16px;width:44px;height:44px;border:0;border-radius:50%;background:#fff;color:#21282E;font:500 24px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18)";
    function shut() {
      document.removeEventListener("keydown", onKey);
      layer.remove();
      // Back where the person was, for keyboard and screen reader users.
      if (opener && opener.focus) opener.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") shut();
      // Tab stays inside the dialog: the close button and the form.
      if (e.key === "Tab") {
        var stops = [close, frame];
        var at = stops.indexOf(document.activeElement);
        if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === stops.length - 1)) {
          e.preventDefault();
          (e.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
        }
      }
    }
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
