# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Express.js + Handlebars webcam viewer displaying real-time views of Slovenian mountain areas. The project shows 31+ webcam feeds in a responsive grid layout, covering popular hiking destinations, mountain huts, and weather stations across the Alps.

## Architecture

### Core Components
- **`server.js`**: Express 5 server with Handlebars templating (no layouts), loads `.env` file
- **`views/index.hbs`**: Single Handlebars template with complete HTML structure
- **`services/googleSheets.js`**: Google Sheets API v4 service for dynamic webcam data fetching
- **`functions/api/panoramicam.js`**: Cloudflare Functions proxy for handling CORS-restricted panoramicam.eu sources
- **`public/`**: Static assets (favicon, etc.)
- **`tests/`**: Jest test suite with comprehensive coverage

### Data Flow
1. **Google Sheets Only**: Fetch webcam data from Google Sheets API v4 on each request
2. **Error Handling**: Return 500 error if Google Sheets fails (no fallback data)
3. **Template**: Handlebars renders data from Google Sheets

### Google Sheets Integration
- **API**: Google Sheets API v4 (not visualization API)
- **Authentication**: API key (stored in `GOOGLE_SHEETS_API_KEY`)
- **URL Format**: `https://sheets.googleapis.com/v4/spreadsheets/{ID}/values/{RANGE}?key={API_KEY}`
- **Expected Format**: Column A = webcam name, Column B = webcam URL, data starts row 2
- **Error Handling**: Returns HTTP 500 with error message if Google Sheets unavailable
- **Required Configuration**: Both `GOOGLE_SHEET_ID` and `GOOGLE_SHEETS_API_KEY` must be set

### Environment Variables
Required in `.env` file:
- `GOOGLE_SHEET_ID`: Google Sheets document ID
- `GOOGLE_SHEETS_API_KEY`: Google Cloud API key with Sheets API access
- `SHEET_RANGE`: Data range (defaults to A2:B)
- `PORT`: Server port (defaults to 3000)

### Template System
- Single template approach (no layouts)
- Handlebars renders complete HTML document
- Uses `{{#each webcams}}` to iterate through webcam data
- Preserves original CSS styling and responsive design

## Development Commands

### Running the Server
```bash
npm start        # Production mode
npm run dev      # Development with nodemon (install nodemon first)
```

### Adding New Panoramicam URLs
To add a new panoramicam.eu webcam, encode the target URL:
```bash
node -p "encodeURIComponent('https://liveimage.panoramicam.eu/thumbnail?application=NAME&streamname=NAME.stream&size=858x480&fitmode=letterbox&format=jpg')"
```

Then construct the proxied URL:
```
https://webcams.parabola.si/api/panoramicam?targetUrl=ENCODED_URL&referer=https%3A%2F%2Fpanoramicam.eu%2F
```

### Testing
```bash
npm test         # Run all tests (Jest + Supertest)
npm run test:watch  # Run tests in watch mode
```

**Note**: Test console output includes expected error messages from error handling scenarios - all tests should pass.

### Local Development
```bash
nvm use          # Switch to Node v22.17.1
npm run dev      # User will always start this themselves
```

**Note**: The user prefers to start the development server themselves using `npm run dev`.

### GCP Project Details
- **Project ID**: `webcams-sheets-api`
- **API Key**: Available in `.env.example`
- **APIs Enabled**: Google Sheets API v4

## Adding New Webcams

Add webcams directly to the Google Sheet:
- Column A: Webcam name
- Column B: Webcam URL
- Changes appear immediately on next page load

No need to modify templates - Handlebars automatically renders new webcams.

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

## Development Guidelines

### Testing
- **ALWAYS run `npm test` after making any code changes**
- All tests must pass before committing changes
- Tests include expected error messages from error handling scenarios

## Git
- Create short "one liner" commit messages and prepend "ask claude to..." without appending "Generated with"
