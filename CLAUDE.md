# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static HTML webcam viewer displaying real-time views of Slovenian mountain areas. The project shows 31+ webcam feeds in a responsive grid layout, covering popular hiking destinations, mountain huts, and weather stations across the Alps.

## Architecture

### Core Components
- **`index.html`**: Main page with responsive CSS grid layout displaying webcam feeds
- **`functions/api/panoramicam.js`**: Cloudflare Functions proxy for handling CORS-restricted panoramicam.eu sources
- **Auto-refresh**: Page refreshes every 60 seconds via meta tag

### Webcam Sources
The project integrates two types of webcam sources:
1. **Direct URLs**: Accessible sources like arso.gov.si, hribi.net, meteo.arso.gov.si
2. **Proxied URLs**: panoramicam.eu sources that require referer headers, accessed via `/api/panoramicam`

## Development Commands

### Adding New Panoramicam URLs
To add a new panoramicam.eu webcam, encode the target URL:
```bash
node -p "encodeURIComponent('https://liveimage.panoramicam.eu/thumbnail?application=NAME&streamname=NAME.stream&size=858x480&fitmode=letterbox&format=jpg')"
```

Then construct the proxied URL:
```
https://webcams.parabola.si/api/panoramicam?targetUrl=ENCODED_URL&referer=https%3A%2F%2Fpanoramicam.eu%2F
```

### Local Development
No build process required. Serve with any HTTP server:
```bash
python -m http.server 8000
# or
npx serve .
```

## Adding New Webcams

### For Direct Sources
Add a new `.image` div to `index.html`:
```html
<div class="image">
    <img src="DIRECT_URL" alt="LOCATION_NAME">
</div>
```

### For Panoramicam Sources
1. Encode the panoramicam URL using the command above
2. Add the proxied URL format to `index.html`
3. Use descriptive alt text with elevation if available

## Proxy Function (`functions/api/panoramicam.js`)

The Cloudflare Function handles:
- CORS headers for cross-origin requests
- Proper referer header forwarding for panoramicam.eu
- Error handling for failed image fetches
- User-Agent preservation

Query parameters:
- `targetUrl`: URL-encoded panoramicam image URL
- `referer`: Required referer header (usually `https://panoramicam.eu/`)

## Layout Structure

- **Desktop**: 3-column grid (`flex: 0 1 calc(33.333%)`)
- **Mobile**: Single column (`flex: 1 1 100%` under 600px)
- **Images**: Fill container with `width: 100%; height: 100%`
- **Container**: Full viewport dimensions with flexbox

## Git
- Create short "one liner" commit messages and prepend "ask claude to..." without appending "Generated with"
