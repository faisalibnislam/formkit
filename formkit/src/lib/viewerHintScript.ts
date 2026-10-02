/**
 * Shared by the server layout and the browser (viewerHint.ts): where the
 * remembered viewer lives, and the script that draws it before first paint.
 * No "use client" here, so the root layout can inline the script.
 */
export const HINT_KEY = "fk_viewer";

/**
 * Runs in <head> before the page paints: marks <html> when a viewer is
 * remembered, so CSS shows the account capsule in place of "Sign in", with
 * their initials and photo filled in from custom properties.
 */
export const HINT_SCRIPT = `(function(){try{var h=JSON.parse(localStorage.getItem(${JSON.stringify(HINT_KEY)})||"null");if(!h)return;var d=document.documentElement;d.setAttribute("data-fk-viewer",h.image?"photo":"");if(h.plan)d.setAttribute("data-fk-plan",h.plan);d.style.setProperty("--fk-hint-initials",JSON.stringify(h.initials||""));d.style.setProperty("--fk-hint-name",JSON.stringify(h.name||""));if(h.image)d.style.setProperty("--fk-hint-img","url("+JSON.stringify(h.image)+")");}catch(e){}})();`;
