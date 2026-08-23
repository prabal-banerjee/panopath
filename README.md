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

## Production hostname checklist

After choosing the final subdomain:

1. Add a static canonical `<link>` plus `og:url` to `index.html`.
2. Add the production URL to both JSON-LD objects in `index.html`.
3. Copy `sitemap.template.xml` to `sitemap.xml` and replace the placeholder hostname.
4. Add the absolute sitemap URL to `robots.txt`.
5. Submit the sitemap in Google Search Console and Bing Webmaster Tools.

Do not deploy `sitemap.template.xml` as `sitemap.xml` without replacing its placeholder.
