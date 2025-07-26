# Webcams Grid

Express.js + Handlebars webcam viewer displaying real-time views of Slovenian mountain areas.

## Adding a Proxied Image

```bash
node -p "encodeURIComponent('https://liveimage.panoramicam.eu/thumbnail?application=SvetiJakob&streamname=SvetiJakob.stream&size=858x480&fitmode=letterbox&format=jpg')"
```

## Deployment

### GitHub Secrets Setup

Configure these repository secrets (Settings → Secrets and variables → Actions):

- **`KAMAL_REGISTRY_PASSWORD`**: Docker Hub access token
- **`SSH_PRIVATE_KEY`**: SSH private key for Pi access  
- **`GOOGLE_SHEET_ID`**: Google Sheets document ID
- **`GOOGLE_SHEETS_API_KEY`**: Google Cloud API key

### Deploy

- **Automatic**: Push to `master` branch
- **Manual**: GitHub Actions → "Run workflow"

### Local Deploy

```bash
export KAMAL_REGISTRY_PASSWORD="your_token"
export GOOGLE_SHEET_ID="your_sheet_id" 
export GOOGLE_SHEETS_API_KEY="your_api_key"
kamal deploy
```