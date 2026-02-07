# Webcams Grid

Express.js + Handlebars webcam viewer displaying real-time views of Slovenian mountain areas. Uses SQLite for local webcam data storage with multi-tenancy support. Includes an HTMX-powered backoffice for managing webcams.

## Setup

```bash
npm install
npm run seed     # Migrate webcams from Google Sheets to SQLite (requires API keys in .env)
npm start        # Start the server
```

## Backoffice

Visit `/backoffice` to manage webcams through a web UI. Supports creating, editing, and deleting webcams. Styled with Tailwind CSS.

## Adding a Proxied Image

```bash
node -p "encodeURIComponent('https://liveimage.panoramicam.eu/thumbnail?application=SvetiJakob&streamname=SvetiJakob.stream&size=858x480&fitmode=letterbox&format=jpg')"
```

## Deployment

Deployed via Coolify using the Dockerfile.

### Deploy

- **Automatic**: Push to `master` branch
- **Manual**: GitHub Actions → "Run workflow"

### Environment Variables

- `PORT`: Server port (defaults to 3000)
- `DEFAULT_USER`: Username for webcam display (defaults to `rok`)

For the seed/migration script only:
- `GOOGLE_SHEET_ID`: Google Sheets document ID
- `GOOGLE_SHEETS_API_KEY`: Google Cloud API key
