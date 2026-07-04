/**
 * Clip Archive — video proxy
 *
 * GitHub serves release files as generic downloads, which iPhones refuse
 * to play. This worker streams them with a proper video MIME type and
 * passes Range requests through, so videos start instantly and seeking
 * works on every device.
 *
 * Setup (once):
 *  1. dash.cloudflare.com → Workers & Pages → Create → Worker
 *  2. Give it a name (e.g. clips-proxy), paste this whole file, Deploy
 *  3. Copy the worker URL (https://clips-proxy.XXXX.workers.dev)
 *  4. Put that URL into VIDEO_PROXY at the top of index.html
 */

// Only serve files from your own repo's releases:
const ALLOWED_PREFIX = "https://github.com/alpycens/gamevideos/releases/download/";

const MIME = {
  mp4:  "video/mp4",
  m4v:  "video/mp4",
  mov:  "video/quicktime",
  webm: "video/webm",
  ogg:  "video/ogg",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("u");

    if (!target || !target.startsWith(ALLOWED_PREFIX)) {
      return new Response("forbidden", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Range",
        },
      });
    }

    const upstreamHeaders = {};
    const range = request.headers.get("Range");
    if (range) upstreamHeaders["Range"] = range;

    const upstream = await fetch(target, {
      headers: upstreamHeaders,
      redirect: "follow",
    });

    const ext = target.split(".").pop().toLowerCase();
    const headers = new Headers(upstream.headers);
    headers.set("Content-Type", MIME[ext] || "video/mp4");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Accept-Ranges", "bytes");
    headers.delete("Content-Disposition");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
