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
        fbclid: getParam("fbclid"),
        gclid: getParam("gclid"),
        gbraid: getParam("gbraid"),
        wbraid: getParam("wbraid"),
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
    var buttons = document.querySelectorAll("[data-trackflow-link]");
    buttons.forEach(function (el) {
      var linkId = el.getAttribute("data-trackflow-link");
      if (!linkId || el.getAttribute("data-trackflow-ready")) return;

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
          }
        })
        .catch(function () {});
    });
  }

  ensureSession().then(wireButtons);
})();
`.trim();

  return new NextResponse(script, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
  });
}
