# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Dockerized Express.js + Handlebars webcam viewer displaying real-time views of Slovenian mountain areas. The project shows webcam feeds in a responsive grid layout, covering popular hiking destinations, mountain huts, and weather stations across the Alps.

## Architecture

### Core Components
- **`server.js`**: Express server with Handlebars templating (no layouts), loads `.env` file, serves HTMX, includes `/api/panoramicam` proxy endpoint and backoffice CRUD routes
- **`views/index.hbs`**: Main Handlebars template with HTMX auto-refresh
- **`views/webcams.hbs`**: Partial template for HTMX content updates
- **`views/backoffice.hbs`**: Full HTML page for backoffice (Tailwind CSS via CDN)
- **`views/backoffice-webcams.hbs`**: Partial template for webcam table list
- **`views/backoffice-webcam-row.hbs`**: Partial template for single table row (used after PUT update)
- **`views/backoffice-form.hbs`**: Dual-purpose create/edit form partial
- **`services/database.js`**: SQLite database service using `better-sqlite3` for webcam data with multi-tenancy support and CRUD operations
- **`scripts/seed.js`**: Migration script to seed SQLite from Google Sheets
- **`public/`**: Static assets (favicon, placeholder.svg, etc.)
- **`tests/`**: Node.js native test runner suite with comprehensive coverage
- **`data/`**: SQLite database storage directory (gitignored)

### Data Flow
1. **Initial Load**: Full page render with HTMX container
2. **Auto-Refresh**: HTMX updates webcam container every 60 seconds via `/webcams` endpoint
3. **Database**: Webcams are fetched from a local SQLite database (`data/webcams.db`)
4. **No Browser Flicker**: Content updates in-place without page reload or browser spinner
5. **Error Handling**: Return 500 error if database fails (no fallback data)
6. **Template**: Handlebars renders data from SQLite

### SQLite Database
- **Library**: `better-sqlite3` (synchronous, fast SQLite3 binding)
- **Database File**: `data/webcams.db` (created automatically on first run)
- **Multi-tenancy**: Users table with webcams linked via `user_id` foreign key
- **Default User**: `rok` (configurable via `DEFAULT_USER` env var)

#### Schema
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE webcams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Environment Variables
In `.env` file:
- `PORT`: Server port (defaults to 3000)
- `DEFAULT_USER`: Username for webcam fetching (defaults to `rok`)

For migration only (seed script):
- `GOOGLE_SHEET_ID`: Google Sheets document ID
- `GOOGLE_SHEETS_API_KEY`: Google Cloud API key with Sheets API access
- `SHEET_RANGE`: Data range (defaults to A2:B)

### Template System
- **Main Template** (`index.hbs`): Complete HTML document with HTMX integration, inline CSS
- **Partial Template** (`webcams.hbs`): Webcam grid for HTMX updates
- **Backoffice Templates**: `backoffice.hbs` (full page), `backoffice-webcams.hbs` (table list), `backoffice-webcam-row.hbs` (single row), `backoffice-form.hbs` (create/edit form)
- **HTMX Attributes**: `hx-get="/webcams"`, `hx-trigger="every 60s"`, `hx-swap="innerHTML"`
- **No Layouts**: Single template approach
- Uses `{{#each webcams}}` to iterate through webcam data
- **Styling**: Public viewer uses inline CSS; backoffice uses Tailwind CSS via CDN

## Development Commands

### Running the Server
```bash
npm start        # Production mode
npm run dev      # Development with nodemon (install nodemon first)
```

### Seeding the Database
```bash
npm run seed     # Fetch webcams from Google Sheets and populate SQLite
```

Requires `GOOGLE_SHEET_ID` and `GOOGLE_SHEETS_API_KEY` to be set in `.env`.

### Adding New Panoramicam URLs
To add a new panoramicam.eu webcam, encode the target URL:
```bash
node -p "encodeURIComponent('https://liveimage.panoramicam.eu/thumbnail?application=NAME&streamname=NAME.stream&size=858x480&fitmode=letterbox&format=jpg')"
```

Then use the relative URL in the database:
```
/api/panoramicam?targetUrl=ENCODED_URL&referer=https%3A%2F%2Fpanoramicam.eu%2F
```

The relative URL will work in both local development and production environments.

### Testing

- Omit running tests with `2>&1` in order to see error logs

```bash
npm test         # Run all tests (Node.js native test runner + Supertest)
npm run test:watch  # Run tests in watch mode
```

**Test Coverage**:
- Express routes: `/`, `/webcams`, `/htmx.min.js`, `/api/panoramicam`
- Backoffice routes: GET/POST/PUT/DELETE for `/backoffice/webcams`
- SQLite database service (schema, queries, multi-tenancy, CRUD operations)
- HTMX functionality and partial templates
- Panoramicam proxy endpoint with CORS handling
- Error handling scenarios

**Test Framework**: Uses Node.js native test runner (no external test framework dependencies) with Supertest for HTTP testing. Tests use in-memory SQLite databases seeded with test data.

**Note**: Test console output includes expected error messages from error handling scenarios - all tests should pass.

### Local Development
```bash
nvm use          # Switch to Node.js LTS version
npm run seed     # Seed the database (first time only)
npm run dev      # User will always start this themselves
```

**Note**: The user prefers to start the development server themselves using `npm run dev`.

## Adding New Webcams

Webcams are stored in the SQLite database. They can be managed by:
1. **Backoffice UI**: Visit `/backoffice` to create, edit, and delete webcams
2. Running the seed script to import from Google Sheets: `npm run seed`
3. Directly inserting into the database

## Panoramicam Proxy Endpoint

The `/api/panoramicam` Express endpoint handles:
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
- **Aspect Ratio**: Images maintain `858 / 480` aspect ratio for consistent layout
- **Container**: Full viewport dimensions with flexbox

### Fallback Placeholder
When a webcam image fails to load, a placeholder is displayed:
- **File**: `public/placeholder.svg` - 858x480 SVG with "Image unavailable" text
- **Behavior**: `onerror` handler replaces failed images with `/placeholder.svg`
- **Styling**: Failed images get `.error` class with `object-fit: contain`

## HTMX Integration

### Auto-Refresh Functionality
- **Refresh Interval**: 60 seconds
- **No Browser Flicker**: Content updates in-place without page reload
- **No Browser Spinner**: Page stays loaded, only webcam content refreshes
- **HTMX Library**: Served directly from `node_modules/htmx.org/dist/htmx.min.js`
- **Fallback**: Graceful degradation if JavaScript disabled

### Routes
- **`GET /`**: Main page with full HTML and HTMX
- **`GET /webcams`**: Partial template for HTMX content updates
- **`GET /htmx.min.js`**: HTMX library served from node_modules
- **`GET /api/panoramicam`**: Image proxy for CORS-restricted panoramicam.eu sources

### Backoffice Routes
- **`GET /backoffice`**: Full HTML page with Tailwind CSS
- **`GET /backoffice/webcams`**: Webcam table list (HTMX partial)
- **`GET /backoffice/webcams/new`**: Create form (HTMX partial)
- **`POST /backoffice/webcams`**: Create webcam, returns updated list
- **`GET /backoffice/webcams/:id/edit`**: Edit form (HTMX partial)
- **`PUT /backoffice/webcams/:id`**: Update webcam, returns updated row
- **`DELETE /backoffice/webcams/:id`**: Delete webcam, removes row via `hx-swap="delete"`

### Backoffice HTMX Flows
- **Create**: Button loads form into `#form-container` → POST → swap entire list + clear form
- **Edit**: Row edit button loads pre-populated form → PUT → swap just that `<tr>` + clear form
- **Delete**: Row delete button with `hx-confirm` → DELETE → remove `<tr>`
- No authentication (uses `DEFAULT_USER` env var, same as public viewer)

### Dependencies
- **htmx.org**: Installed via npm for easy upgrades
- **better-sqlite3**: SQLite3 binding for Node.js
- **Tailwind CSS**: Via CDN for backoffice styling
- **Express static middleware**: Serves HTMX directly from node_modules

## Development Guidelines

### Testing
- **ALWAYS run `npm test` after making any code changes**
- All tests must pass before committing changes
- Uses Node.js native test runner (no external test framework dependencies)
- Tests include expected error messages from error handling scenarios
- HTMX functionality covered by integration tests

## Git
- Create short "one liner" commit messages and prepend "ask claude to..." without appending "Generated with"

## Documentation
- **NEVER create additional markdown files** beyond README.md and CLAUDE.md
- All documentation should go into existing README.md or CLAUDE.md files
- Avoid creating files like DEPLOYMENT.md, CONTRIBUTING.md, etc.
