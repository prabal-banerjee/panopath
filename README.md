# PanoPath — 360 Photo Motion Studio

A dependency-free, client-side editor for turning an equirectangular 360° photo into a conventional flat video with a controlled camera path.

## Run it

Serve the `public` directory with any static web server (modules and a build step are not required):

```bash
cd panorama-motion-studio
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173` in Chrome or Edge. The demo panorama is generated locally; uploaded photos never leave the browser.

## Why the export stays smooth

On browsers with WebCodecs, export is offline and frame-locked: every video frame is rendered from its exact timeline time, encoded as VP9, then muxed into WebM locally. Slow hardware can take longer to export, but it does not alter camera timing or skip requested timeline positions. A MediaRecorder compatibility path is included for browsers without WebCodecs.

For best quality, start with a 4096×2048 or larger equirectangular image. A 4K *reframed* export benefits from an 8K source panorama because the output camera sees only part of the sphere at once.

## Production deployment

The canonical deployment is [panopath.prabalbanerjee.xyz](https://panopath.prabalbanerjee.xyz/). The `main` branch deploys automatically through Cloudflare Workers Builds using `wrangler.jsonc`.

The `src/worker.js` entry point provides security headers, `Accept: text/markdown` content negotiation, and agent-friendly Markdown 404 responses. Browser assets and crawler resources live in `public/`; Cloudflare exposes that directory through the `ASSETS` binding.

## Repository layout

```text
public/             Static site and crawler-facing files
  assets/css/       Browser styles
  assets/js/        Browser application code
src/worker.js       Cloudflare Worker request handling
config/             Maintenance templates not deployed publicly
tests/              Browser smoke tests
wrangler.jsonc      Cloudflare build and asset configuration
```

Run the aspect-ratio browser smoke test while the local server is listening on port 4173:

```bash
python3 tests/aspect_ratio_ui.py
```

After material public changes, update the sitemap `lastmod` date, push to `main`, and verify the live deployment before requesting a recrawl through Google Search Console and Bing Webmaster Tools.
