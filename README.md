# PanoPath — 360 Photo Motion Studio

A dependency-free, client-side editor for turning an equirectangular 360° photo into a conventional flat video with a controlled camera path.

## Run it

Serve this directory with any static web server (modules and a build step are not required):

```bash
cd panorama-motion-studio
python3 -m http.server 4173
```

Then open `http://localhost:4173` in Chrome or Edge. The demo panorama is generated locally; uploaded photos never leave the browser.

## Why the export stays smooth

On browsers with WebCodecs, export is offline and frame-locked: every video frame is rendered from its exact timeline time, encoded as VP9, then muxed into WebM locally. Slow hardware can take longer to export, but it does not alter camera timing or skip requested timeline positions. A MediaRecorder compatibility path is included for browsers without WebCodecs.

For best quality, start with a 4096×2048 or larger equirectangular image. A 4K *reframed* export benefits from an 8K source panorama because the output camera sees only part of the sphere at once.

## Production deployment

The canonical deployment is [panopath.prabalbanerjee.xyz](https://panopath.prabalbanerjee.xyz/). The `main` branch deploys through Cloudflare Pages with no build command and the repository root (`.`) as its output directory.

The Pages `_worker.js` provides `Accept: text/markdown` content negotiation and agent-friendly Markdown 404 responses. Static application assets remain in the Pages asset binding. SEO and agent discovery resources include `sitemap.xml`, `robots.txt`, `llms.txt`, `index.md`, JSON-LD, visible FAQ content, and About, Privacy, and Contact trust pages.

After material public changes, update the sitemap `lastmod` date, push to `main`, and verify the live deployment before requesting a recrawl through Google Search Console and Bing Webmaster Tools.
