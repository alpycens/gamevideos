/**
 * Clip Archive — video service worker
 *
 * GitHub serves release files as generic downloads, so phone browsers
 * (especially iPhones) refuse to play them inline. This worker sits
 * inside the site itself: it intercepts "sw-video/<assetId>/<name>"
 * requests, streams the file from GitHub, and relabels it with a real
 * video MIME type. Range requests pass through, so seeking works and
 * playback starts instantly.
 *
 * Deploy: put this file next to index.html in the repo. Nothing else.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

function repoInfo() {
  // https://alpycens.github.io/gamevideos/sw.js -> owner/repo
  const host = self.location.hostname;
  const parts = self.location.pathname.split("/").filter(Boolean);
  const owner = host.endsWith(".github.io") ? host.replace(".github.io", "") : "alpycens";
  const repo = parts.length > 1 ? parts[0] : (parts[0] && parts[0] !== "sw.js" ? parts[0] : "gamevideos");
  return { owner, repo };
}

const MIME = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogg: "video/ogg",
};

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.includes("/sw-video/")) {
    event.respondWith(streamVideo(event.request, url));
  }
});

async function streamVideo(request, url) {
  try {
    const tail = url.pathname.split("/sw-video/")[1] || "";
    const [assetId, rawName = "video.mp4"] = tail.split("/");
    if (!/^\d+$/.test(assetId)) return new Response("bad request", { status: 400 });

    const ext = decodeURIComponent(rawName).split(".").pop().toLowerCase();
    const { owner, repo } = repoInfo();

    const headers = { "Accept": "application/octet-stream" };
    const range = request.headers.get("range");
    if (range) headers["Range"] = range;

    const upstream = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`,
      { headers, redirect: "follow" }
    );

    if (!upstream.ok && upstream.status !== 206) {
      return new Response("upstream error " + upstream.status, { status: 502 });
    }

    const out = new Headers();
    out.set("Content-Type", MIME[ext] || "video/mp4");
    out.set("Accept-Ranges", "bytes");
    const passthrough = ["content-length", "content-range", "etag", "last-modified"];
    passthrough.forEach(h => {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    });
  } catch (e) {
    return new Response("proxy error", { status: 502 });
  }
}
