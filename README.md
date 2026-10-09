# Webcams Grid

Express.js + Handlebars webcam viewer displaying real-time views of Slovenian mountain areas.

## Adding a Proxied Image

```bash
node -p "encodeURIComponent('https://liveimage.panoramicam.eu/thumbnail?application=SvetiJakob&streamname=SvetiJakob.stream&size=858x480&fitmode=letterbox&format=jpg')"
```

## Deployment

Production is deployed from `master` to `https://webcams.parabola.si` on Forge.
The private `katafractari/forge` repository owns routing, encrypted runtime
credentials, and shared Compose settings. This repository's `compose.forge.yaml`
is a thin adapter to `/etc/forge/apps/webcams/compose.yaml`.

Doco-CD builds on Forge after signed GitHub push webhooks, with periodic polling
as a fallback. BuildKit retains dependency layers and npm downloads. The image
runs as a non-root user, publishes no application port, and requires no database
or persistent volume. Cloudflare Tunnel forwards public requests through
Traefik's internal public-app entrypoint.

Runtime credentials are supplied from `/etc/forge/apps/webcams/runtime.env`:
`GOOGLE_SHEET_ID`, `GOOGLE_SHEETS_API_KEY`, and `SHEET_RANGE`. They never enter
Git or the image in plaintext. Dockerfile builds do not use Nixpacks settings.

The image proxy accepts only HTTPS images from `liveimage.panoramicam.eu`,
uses a fixed Panoramicam referer, and rejects redirects. It cannot be used to
request arbitrary Forge, localhost, or Tailscale endpoints.
