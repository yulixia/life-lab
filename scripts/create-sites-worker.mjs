import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, posix, relative, sep } from 'node:path'

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

const distFiles = (await collectFiles('dist')).filter((file) => !file.includes(`${sep}server${sep}`))
const assets = {}

for (const file of distFiles) {
  const route = `/${relative('dist', file).split(sep).join(posix.sep)}`
  assets[route] = {
    body: (await readFile(file)).toString('base64'),
    contentType: mimeTypes[extname(file)] ?? 'application/octet-stream',
  }
}

const worker = `const INDEX_HTML = "/index.html";
const ASSETS = ${JSON.stringify(assets)};

function assetResponse(asset) {
  return new Response(Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0)), {
    headers: {
      "Content-Type": asset.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": asset.contentType.includes("text/html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? INDEX_HTML : url.pathname;
    const asset = ASSETS[pathname];

    if (asset) {
      return assetResponse(asset);
    }

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (request.method === "GET" && acceptsHtml) {
      return assetResponse(ASSETS[INDEX_HTML]);
    }

    return new Response("Not found", { status: 404 });
  },
};
`

await mkdir('dist/server', { recursive: true })
await writeFile('dist/server/index.js', worker)
