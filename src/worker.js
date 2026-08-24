const MARKDOWN = "text/markdown; charset=utf-8";
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin"
};

function responseWithHeaders(response, additions = {}) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  for (const [name, value] of Object.entries(additions)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function acceptsMarkdown(request) {
  return (request.headers.get("Accept") || "").toLowerCase().includes("text/markdown");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isDocument = request.method === "GET" || request.method === "HEAD";

    if (isDocument && url.pathname === "/" && acceptsMarkdown(request)) {
      const markdownUrl = new URL("/index.md", url);
      const asset = await env.ASSETS.fetch(new Request(markdownUrl, request));
      return responseWithHeaders(asset, {
        "Content-Type": MARKDOWN,
        "Content-Location": "/",
        "Vary": "Accept, Accept-Encoding",
        "Link": '<https://panopath.prabalbanerjee.xyz/>; rel="canonical"',
        "Cache-Control": "public, max-age=300"
      });
    }

    const asset = await env.ASSETS.fetch(request);
    if (isDocument && asset.status === 404 && acceptsMarkdown(request)) {
      const body = request.method === "HEAD" ? null : `# 404 — Page not found\n\nThe requested PanoPath page does not exist.\n\n- [Open the 360 photo to video editor](/)\n- [Read the agent instructions](/llms.txt)\n- [View the sitemap](/sitemap.xml)\n- [Visit the project source](https://github.com/prabal-banerjee/panopath)\n`;
      return responseWithHeaders(new Response(body, { status: 404 }), { "Content-Type": MARKDOWN, "Vary": "Accept, Accept-Encoding" });
    }

    const extra = {};
    if (url.pathname === "/") extra.Vary = "Accept, Accept-Encoding";
    if (url.pathname === "/index.md") extra["X-Robots-Tag"] = "noindex";
    return responseWithHeaders(asset, extra);
  }
};
