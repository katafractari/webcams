# Webcams Grid

Express.js + Handlebars webcam viewer displaying real-time views of Slovenian mountain areas.

## Adding a Proxied Image

```bash
node -p "encodeURIComponent('https://liveimage.panoramicam.eu/thumbnail?application=SvetiJakob&streamname=SvetiJakob.stream&size=858x480&fitmode=letterbox&format=jpg')"
```

## Deployment

Production is deployed from `master` to `https://webcams.parabola.si` on Forge.
This repository owns the full `compose.forge.yaml` and `.doco-cd.yml`, including
builds, health checks, the Compose project name and public Traefik routing.
The private `katafractari/forge` repository owns shared infrastructure, public
DNS/tunnel ingress, repository watches and SOPS-encrypted credential delivery.
No generated Compose file or include adapter is required.

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

### Deployment verification

The readiness check uses `/`, which renders without a Google Sheets request.
Verify the configured data source separately with `/webcams`. Individual camera
feeds can be offline; the browser displays the placeholder image for failures.

Source changes belong in this repository's `master`. Hostnames, exposure,
runtime settings and encrypted credentials belong in `apps/webcams/` in Forge.
