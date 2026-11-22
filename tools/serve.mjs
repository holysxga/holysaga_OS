/**
 * Development static server — no dependencies.
 *
 * Unlike `python3 -m http.server`, this answers HTTP Range requests. The real
 * 55 MB Sacred Digital master needs that: without `Accept-Ranges`, Chromium
 * cannot seek inside the WAV and restarts it at zero, which would look like a
 * broken progress bar. Any production static host supports ranges already.
 *
 * Usage: node tools/serve.mjs [port]   (defaults to 3000, PORT also works)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const port = Number(process.argv[2] || process.env.PORT || 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".woff2": "font/woff2",
};

function resolvePathname(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = path.join(root, path.normalize(pathname));
  return file.startsWith(root + path.sep) || file === root ? file : null;
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const file = resolvePathname(request.url);
  if (!file) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Content-Type", type);
    response.setHeader("Cache-Control", "no-cache");

    const range = request.headers.range;
    if (!range) {
      response.writeHead(200, { "Content-Length": stat.size });
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(file).pipe(response);
      return;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      response.end();
      return;
    }

    let start;
    let end;
    if (!match[1]) {
      // Suffix range: the last N bytes.
      const length = Math.min(Number(match[2]) || 0, stat.size);
      start = stat.size - length;
      end = stat.size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : stat.size - 1;
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
      response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      response.end();
      return;
    }
    end = Math.min(end, stat.size - 1);

    response.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Content-Length": end - start + 1,
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(file, { start, end }).pipe(response);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`holysaga_oS on http://localhost:${port} (Range requests enabled)`);
});
