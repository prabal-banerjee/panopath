# PanoPath — 360 Photo to Video Converter

PanoPath is a free, private browser application for converting an existing 2:1 equirectangular 360-degree photo into a conventional flat video with a controlled camera path.

## What it does

- Imports local JPG, PNG, or WebP panorama files without uploading them.
- Animates camera pan, tilt, field of view, waypoint timing, and easing.
- Previews the exact camera path before export.
- Exports landscape, portrait, or square VP9 WebM video at up to 4K and 60 frames per second.
- Uses frame-locked WebCodecs rendering in supported browsers to preserve camera timing.
- Offers optional four-sample motion blur.

## Use PanoPath when

Use PanoPath for real-estate panoramas, architectural renders, travel photos, virtual environments, social media clips, and cinematic reveals made from an existing 360-degree still image. It is designed for people who need more control than a fixed automatic rotation.

## Do not use PanoPath when

PanoPath does not generate a 360-degree environment from a normal photograph, edit moving 360 video, create interactive spherical video, add audio, or upload media through an API.

## Workflow

1. Open [PanoPath](https://panopath.prabalbanerjee.xyz/).
2. Choose a 2:1 equirectangular panorama or try the generated demo.
3. Drag to pan and tilt; scroll to change the field of view.
4. Capture two or more camera waypoints and set their times.
5. Preview the movement, choose output dimensions and export.

### Changing rotation direction

To make the camera travel the opposite way between waypoint A and waypoint B, select destination waypoint B and change its **Pan** value by one full turn. Subtract 360 degrees to force one direction or add 360 degrees to force the other. For example, `90°` and `-270°` end at the same visual direction but take opposite rotational paths. **Reverse path** instead swaps the complete waypoint sequence.

## Privacy and ownership

All image decoding, WebGL rendering and video encoding happen locally in the browser. PanoPath does not provide an upload endpoint, user account, analytics tracker, or cloud media store. Closing the page discards the imported image. PanoPath is an open-source project by [Prabal Banerjee](https://prabalbanerjee.xyz/); its source is available on [GitHub](https://github.com/prabal-banerjee/panopath).

## Site index

- [About PanoPath](https://panopath.prabalbanerjee.xyz/about)
- [Privacy](https://panopath.prabalbanerjee.xyz/privacy)
- [Contact](https://panopath.prabalbanerjee.xyz/contact)
- [Agent instructions](https://panopath.prabalbanerjee.xyz/llms.txt)
- [XML sitemap](https://panopath.prabalbanerjee.xyz/sitemap.xml)
