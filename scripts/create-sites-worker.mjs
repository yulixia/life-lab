import { mkdir, writeFile } from 'node:fs/promises'

const worker = `const INDEX_HTML = "/index.html";

function withHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchAsset(env, request) {
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const response = await fetchAsset(env, request);

    if (response.status !== 404) {
      return withHeaders(response);
    }

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (request.method === "GET" && acceptsHtml) {
      const indexUrl = new URL(INDEX_HTML, request.url);
      return withHeaders(await fetchAsset(env, new Request(indexUrl, request)));
    }

    return withHeaders(response);
  },
};
`

await mkdir('dist/server', { recursive: true })
await writeFile('dist/server/index.js', worker)
