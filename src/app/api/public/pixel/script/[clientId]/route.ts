import { NextRequest, NextResponse } from 'next/server';

const TRACKFLOW_BASE_URL = process.env.NEXTAUTH_URL || '';

// GET /api/public/pixel/script/:clientId — serves the TrackFlow pixel, unique per client (the
// script embeds clientId in its calls). Public/unauthenticated, served as a plain script so
// it can be dropped on the client's site with <script src=".../script/<clientId>" async></script>.
//
// What it does: captures UTM/click-id params from the current URL into a PixelSession (reused
// across page views via localStorage), then rewrites every element on the page carrying
// data-trackflow-link="<TrackingLink id>" so its href points at the right WhatsApp number with
// that visitor's own tracking code stitched into the message — see /api/public/pixel/wa-link.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;

  const script = `
(function () {
  var CLIENT_ID = ${JSON.stringify(clientId)};
  var BASE_URL = ${JSON.stringify(TRACKFLOW_BASE_URL)};
  var STORAGE_KEY = "tf_session_" + CLIENT_ID;

  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name) || null;
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Fallback for when the click id isn't in the CURRENT page's URL (e.g. the visitor clicked
  // through from an earlier page that had it) — Meta's own Pixel and Google's Conversion
  // Linker/gtag, if also installed on the site, keep it alive in a first-party cookie across
  // the whole domain. _fbc is "fb.<subdomainIndex>.<timestamp>.<fbclid>"; _gcl_aw is
  // "GCL.<timestamp>.<gclid>". Both are absent if those platforms' own scripts aren't present.
  function fbclidFromCookie() {
    var fbc = getCookie("_fbc");
    if (!fbc) return null;
    var parts = fbc.split(".");
    return parts.length >= 4 ? parts.slice(3).join(".") : null;
  }

  function gclidFromCookie() {
    var gclAw = getCookie("_gcl_aw");
    if (!gclAw) return null;
    var parts = gclAw.split(".");
    return parts.length >= 3 ? parts[2] : null;
  }

  function ensureSession() {
    var existing = null;
    try { existing = window.localStorage.getItem(STORAGE_KEY); } catch (e) {}

    return fetch(BASE_URL + "/api/public/pixel/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        existingSessionCode: existing,
        utmSource: getParam("utm_source"),
        utmMedium: getParam("utm_medium"),
        utmCampaign: getParam("utm_campaign"),
        utmContent: getParam("utm_content"),
        utmTerm: getParam("utm_term"),
        fbclid: getParam("fbclid") || fbclidFromCookie(),
        gclid: getParam("gclid") || gclidFromCookie(),
        gbraid: getParam("gbraid"),
        wbraid: getParam("wbraid"),
        fbp: getCookie("_fbp"),
        landingUrl: window.location.href,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.sessionCode) {
          try { window.localStorage.setItem(STORAGE_KEY, data.sessionCode); } catch (e) {}
        }
        return data.sessionCode;
      })
      .catch(function () { return null; });
  }

  function wireButtons(sessionCode) {
    if (!sessionCode) return;
    var buttons = document.querySelectorAll("[data-trackflow-link]:not([data-trackflow-ready])");
    buttons.forEach(function (el) {
      var linkId = el.getAttribute("data-trackflow-link");
      if (!linkId) return;
      el.setAttribute("data-trackflow-ready", "pending"); // claim it before the async call resolves

      fetch(BASE_URL + "/api/public/pixel/wa-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: linkId, sessionCode: sessionCode }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.waLink) {
            el.setAttribute("href", data.waLink);
            el.setAttribute("data-trackflow-ready", "1");
          } else {
            el.removeAttribute("data-trackflow-ready");
          }
        })
        .catch(function () { el.removeAttribute("data-trackflow-ready"); });
    });
  }

  // The tag manager or framework rendering this page may inject it before the WhatsApp buttons
  // exist yet (e.g. GTM's default trigger fires as soon as the container loads, not necessarily
  // after the page's own content renders) — wait for the DOM, then keep watching for buttons
  // added later (lazy-rendered widgets, client-side routing, cookie-consent-gated content).
  function start() {
    ensureSession().then(function (sessionCode) {
      wireButtons(sessionCode);

      if (window.MutationObserver) {
        var observer = new MutationObserver(function () {
          wireButtons(sessionCode);
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
`.trim();

  return new NextResponse(script, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
  });
}
