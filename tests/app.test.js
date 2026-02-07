const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const request = require('supertest');
const createApp = require('../server');
const { createDatabase, DatabaseService } = require('../services/database');

const TEST_COOKIE_SECRET = 'test-secret';

function signCookie(val, secret) {
  const sig = crypto.createHmac('sha256', secret).update(val).digest('base64').replace(/=+$/, '');
  return 's:' + val + '.' + sig;
}

function authCookie(username = 'rok') {
  return 'username=' + signCookie(username, TEST_COOKIE_SECRET);
}

describe('Express App', () => {
  let app;
  let db;
  let dbService;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.COOKIE_SECRET = TEST_COOKIE_SECRET;

    // Create an in-memory database for testing
    db = createDatabase(':memory:');

    // Seed test data
    db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');
    const insert = db.prepare('INSERT INTO webcams (user_id, name, url, position) VALUES (?, ?, ?, ?)');
    insert.run(user.id, 'Test Webcam 1', 'https://example.com/cam1.jpg', 0);
    insert.run(user.id, 'Test Webcam 2', 'https://example.com/cam2.jpg', 1);

    dbService = new DatabaseService(db);
    app = createApp(dbService);
  });

  afterEach(() => {
    db.close();
    process.env = originalEnv;
  });

  describe('Auth protection', () => {
    it('should redirect unauthenticated requests to /auth/google', async () => {
      const response = await request(app)
        .get('/')
        .expect(302);

      assert.ok(response.headers.location.includes('/auth/google'));
    });

    it('should redirect unauthenticated /webcams to /auth/google', async () => {
      const response = await request(app)
        .get('/webcams')
        .expect(302);

      assert.ok(response.headers.location.includes('/auth/google'));
    });
  });

  describe('Auth routes', () => {
    it('GET /auth/google should redirect to Google consent screen', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      const testApp = createApp(dbService);

      const response = await request(testApp)
        .get('/auth/google')
        .expect(302);

      assert.ok(response.headers.location.includes('accounts.google.com'));
      assert.ok(response.headers.location.includes('test-client-id'));
    });

    it('GET /auth/google/callback should return 400 without code', async () => {
      const response = await request(app)
        .get('/auth/google/callback')
        .expect(400);

      assert.strictEqual(response.text, 'Missing authorization code');
    });

    it('GET /auth/logout should clear cookie and redirect', async () => {
      const response = await request(app)
        .get('/auth/logout')
        .set('Cookie', authCookie())
        .expect(302);

      assert.ok(response.headers.location.includes('/auth/google'));
      const setCookie = response.headers['set-cookie'];
      assert.ok(setCookie.some(c => c.includes('username=;')));
    });
  });

  describe('GET /', () => {
    it('should render main page with HTMX container', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('hx-get="/webcams"'));
      assert.ok(response.text.includes('hx-trigger="load, every 60s"'));
      assert.ok(response.text.includes('<script src="/htmx.min.js"></script>'));
    });

    it('should render empty container ready for HTMX', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('<div class="container"'));
      assert.ok(response.text.includes('hx-get="/webcams"'));
    });

    it('should render proper HTML structure with HTMX', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('<!DOCTYPE html>'));
      assert.ok(response.text.includes('<html lang="en">'));
      assert.ok(response.text.includes('<meta charset="UTF-8">'));
      assert.ok(response.text.includes('<meta name="viewport"'));
      assert.ok(response.text.includes('<script src="/htmx.min.js"></script>'));
      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('<link rel="icon" href="favicon.ico"'));

      assert.ok(response.text.includes('body {'));
      assert.ok(response.text.includes('.container {'));
      assert.ok(response.text.includes('.image {'));
      assert.ok(response.text.includes('@media (max-width: 600px)'));

      assert.ok(response.text.includes('hx-get="/webcams"'));
      assert.ok(response.text.includes('hx-trigger="load, every 60s"'));
      assert.ok(response.text.includes('hx-swap="innerHTML"'));

      assert.ok(!response.text.includes('<div class="image">'));
    });

    it('should render empty container for HTMX to populate', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('<div class="container"'));
      assert.ok(response.text.includes('hx-get="/webcams"'));

      const imageDivMatches = response.text.match(/<div class="image">/g);
      assert.strictEqual(imageDivMatches, null);

      const imgMatches = response.text.match(/<img src=/g);
      assert.strictEqual(imgMatches.length, 1);
      assert.ok(response.text.includes('<img src="" alt="Maximized webcam">'));
    });

    it('should show username in toolbar', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('rok'));
      assert.ok(response.text.includes('/auth/logout'));
    });
  });

  describe('GET /webcams', () => {
    it('should render webcam partial with data from database', async () => {
      const response = await request(app)
        .get('/webcams')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('Test Webcam 1'));
      assert.ok(response.text.includes('Test Webcam 2'));
      assert.ok(response.text.includes('https://example.com/cam1.jpg'));
      assert.ok(response.text.includes('https://example.com/cam2.jpg'));
      assert.ok(response.text.includes('<div class="image">'));
      assert.ok(!response.text.includes('<html>'));
    });

    it('should handle database errors', async () => {
      db.close();
      // Create a broken service that throws on fetchWebcams
      const brokenService = {
        fetchWebcams: () => { throw new Error('Database error'); }
      };
      const brokenApp = createApp(brokenService);

      const mockError = mock.method(console, 'error', () => {});
      const response = await request(brokenApp)
        .get('/webcams')
        .set('Cookie', authCookie())
        .expect(500);
      mockError.mock.restore();

      assert.strictEqual(response.text, 'Error loading webcams');

      // Reopen db for afterEach cleanup
      db = createDatabase(':memory:');
    });

    it('should render empty partial for no webcams', async () => {
      // Create a fresh db with no webcam data
      const emptyDb = createDatabase(':memory:');
      emptyDb.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
      const emptyService = new DatabaseService(emptyDb);
      const emptyApp = createApp(emptyService);

      const response = await request(emptyApp)
        .get('/webcams')
        .set('Cookie', authCookie())
        .expect(200);

      assert.strictEqual(response.text.trim(), '');
      emptyDb.close();
    });
  });

  describe('GET /webcams?edit=true', () => {
    it('should render edit partial with data-id attributes', async () => {
      const response = await request(app)
        .get('/webcams?edit=true')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('data-id='));
      assert.ok(response.text.includes('edit-controls'));
      assert.ok(response.text.includes('drag-handle'));
      assert.ok(response.text.includes('Test Webcam 1'));
      assert.ok(response.text.includes('Test Webcam 2'));
    });
  });

  describe('GET /webcams/new', () => {
    it('should render create form', async () => {
      const response = await request(app)
        .get('/webcams/new')
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('New Webcam'));
      assert.ok(response.text.includes('hx-post="/webcams"'));
      assert.ok(response.text.includes('name="name"'));
      assert.ok(response.text.includes('name="url"'));
    });
  });

  describe('POST /webcams', () => {
    it('should create a webcam and return edit grid', async () => {
      const response = await request(app)
        .post('/webcams')
        .set('Cookie', authCookie())
        .type('form')
        .send({ name: 'New Cam', url: 'https://example.com/new.jpg' })
        .expect(200);

      assert.ok(response.text.includes('New Cam'));
      assert.ok(response.text.includes('data-id='));
    });

    it('should reject missing name', async () => {
      await request(app)
        .post('/webcams')
        .set('Cookie', authCookie())
        .type('form')
        .send({ url: 'https://example.com/new.jpg' })
        .expect(400);
    });

    it('should reject missing url', async () => {
      await request(app)
        .post('/webcams')
        .set('Cookie', authCookie())
        .type('form')
        .send({ name: 'New Cam' })
        .expect(400);
    });
  });

  describe('GET /webcams/:id/edit', () => {
    it('should render edit form with webcam data', async () => {
      const webcams = dbService.fetchWebcamsWithIds('rok');
      const webcamId = webcams[0].id;

      const response = await request(app)
        .get(`/webcams/${webcamId}/edit`)
        .set('Cookie', authCookie())
        .expect(200);

      assert.ok(response.text.includes('Edit Webcam'));
      assert.ok(response.text.includes('Test Webcam 1'));
      assert.ok(response.text.includes(`hx-put="/webcams/${webcamId}"`));
    });

    it('should return 404 for non-existent webcam', async () => {
      const response = await request(app)
        .get('/webcams/99999/edit')
        .set('Cookie', authCookie())
        .expect(404);

      assert.strictEqual(response.text, 'Webcam not found');
    });
  });

  describe('PUT /webcams/:id', () => {
    it('should update a webcam and return edit card', async () => {
      const webcams = dbService.fetchWebcamsWithIds('rok');
      const webcamId = webcams[0].id;

      const response = await request(app)
        .put(`/webcams/${webcamId}`)
        .set('Cookie', authCookie())
        .type('form')
        .send({ name: 'Updated Cam', url: 'https://example.com/updated.jpg' })
        .expect(200);

      assert.ok(response.text.includes('Updated Cam'));
      assert.ok(response.text.includes(`webcam-card-${webcamId}`));
    });

    it('should return 404 for non-existent webcam', async () => {
      const response = await request(app)
        .put('/webcams/99999')
        .set('Cookie', authCookie())
        .type('form')
        .send({ name: 'Name', url: 'https://example.com/url.jpg' })
        .expect(404);

      assert.strictEqual(response.text, 'Webcam not found');
    });

    it('should reject missing fields', async () => {
      const webcams = dbService.fetchWebcamsWithIds('rok');
      const webcamId = webcams[0].id;

      await request(app)
        .put(`/webcams/${webcamId}`)
        .set('Cookie', authCookie())
        .type('form')
        .send({ name: 'Only Name' })
        .expect(400);
    });
  });

  describe('DELETE /webcams/:id', () => {
    it('should delete a webcam and return empty response', async () => {
      const webcams = dbService.fetchWebcamsWithIds('rok');
      const webcamId = webcams[0].id;

      const response = await request(app)
        .delete(`/webcams/${webcamId}`)
        .set('Cookie', authCookie())
        .expect(200);

      assert.strictEqual(response.text, '');
    });

    it('should return 404 for non-existent webcam', async () => {
      const response = await request(app)
        .delete('/webcams/99999')
        .set('Cookie', authCookie())
        .expect(404);

      assert.strictEqual(response.text, 'Webcam not found');
    });
  });

  describe('GET /api/panoramicam', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should proxy image with CORS headers', async () => {
      const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      globalThis.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([['Content-Type', 'image/png']]),
        arrayBuffer: () => Promise.resolve(imageBytes.buffer),
      }));

      const response = await request(app)
        .get('/api/panoramicam')
        .set('Cookie', authCookie())
        .query({ targetUrl: 'https://example.com/image.png', referer: 'https://panoramicam.eu/' })
        .expect(200);

      assert.strictEqual(response.headers['access-control-allow-origin'], '*');
      assert.strictEqual(response.headers['content-type'], 'image/png');
      assert.deepStrictEqual(new Uint8Array(response.body), imageBytes);

      const call = globalThis.fetch.mock.calls[0];
      assert.strictEqual(call.arguments[0], 'https://example.com/image.png');
      assert.strictEqual(call.arguments[1].headers['Referer'], 'https://panoramicam.eu/');
    });

    it('should return 400 when targetUrl is missing', async () => {
      const response = await request(app)
        .get('/api/panoramicam')
        .set('Cookie', authCookie())
        .query({ referer: 'https://panoramicam.eu/' })
        .expect(400);

      assert.ok(response.text.includes('Missing'));
    });

    it('should return 400 when referer is missing', async () => {
      const response = await request(app)
        .get('/api/panoramicam')
        .set('Cookie', authCookie())
        .query({ targetUrl: 'https://example.com/image.png' })
        .expect(400);

      assert.ok(response.text.includes('Missing'));
    });

    it('should forward upstream error status', async () => {
      globalThis.fetch = mock.fn(() => Promise.resolve({
        ok: false,
        status: 403,
      }));

      const response = await request(app)
        .get('/api/panoramicam')
        .set('Cookie', authCookie())
        .query({ targetUrl: 'https://example.com/image.png', referer: 'https://panoramicam.eu/' })
        .expect(403);

      assert.strictEqual(response.text, 'Failed to fetch the target image');
    });

    it('should return 500 when fetch throws', async () => {
      globalThis.fetch = mock.fn(() => Promise.reject(new Error('Network error')));

      const response = await request(app)
        .get('/api/panoramicam')
        .set('Cookie', authCookie())
        .query({ targetUrl: 'https://example.com/image.png', referer: 'https://panoramicam.eu/' })
        .expect(500);

      assert.ok(response.text.includes('Network error'));
    });
  });

  describe('PUT /webcams/reorder', () => {
    it('should reorder webcams', async () => {
      const webcams = dbService.fetchWebcamsWithIds('rok');
      const reversedIds = webcams.map(w => w.id).reverse();

      const response = await request(app)
        .put('/webcams/reorder')
        .set('Cookie', authCookie())
        .send({ order: reversedIds })
        .expect(200);

      assert.strictEqual(response.text, '');

      const reordered = dbService.fetchWebcams('rok');
      assert.strictEqual(reordered[0].name, 'Test Webcam 2');
      assert.strictEqual(reordered[1].name, 'Test Webcam 1');
    });

    it('should reject invalid order data', async () => {
      await request(app)
        .put('/webcams/reorder')
        .set('Cookie', authCookie())
        .send({ order: [] })
        .expect(400);
    });

    it('should reject missing order', async () => {
      await request(app)
        .put('/webcams/reorder')
        .set('Cookie', authCookie())
        .send({})
        .expect(400);
    });
  });

});
