const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../server');
const { createDatabase, DatabaseService } = require('../services/database');

describe('Express App', () => {
  let app;
  let db;
  let dbService;

  beforeEach(() => {
    // Create an in-memory database for testing
    db = createDatabase(':memory:');

    // Seed test data
    db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');
    const insert = db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)');
    insert.run(user.id, 'Test Webcam 1', 'https://example.com/cam1.jpg');
    insert.run(user.id, 'Test Webcam 2', 'https://example.com/cam2.jpg');

    dbService = new DatabaseService(db);
    app = createApp(dbService);
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /', () => {
    it('should render main page with HTMX container', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('hx-get="/webcams"'));
      assert.ok(response.text.includes('hx-trigger="load, every 60s"'));
      assert.ok(response.text.includes('<script src="/htmx.min.js"></script>'));
    });

    it('should render empty container ready for HTMX', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('<div class="container"'));
      assert.ok(response.text.includes('hx-get="/webcams"'));
    });

    it('should render proper HTML structure with HTMX', async () => {
      const response = await request(app)
        .get('/')
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
        .expect(200);

      assert.ok(response.text.includes('<div class="container"'));
      assert.ok(response.text.includes('hx-get="/webcams"'));

      const imageDivMatches = response.text.match(/<div class="image">/g);
      assert.strictEqual(imageDivMatches, null);

      const imgMatches = response.text.match(/<img src=/g);
      assert.strictEqual(imgMatches.length, 1);
      assert.ok(response.text.includes('<img src="" alt="Maximized webcam">'));
    });
  });

  describe('GET /webcams', () => {
    it('should render webcam partial with data from database', async () => {
      const response = await request(app)
        .get('/webcams')
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

      const response = await request(brokenApp)
        .get('/webcams')
        .expect(500);

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
        .expect(200);

      assert.strictEqual(response.text.trim(), '');
      emptyDb.close();
    });
  });

  describe('GET /htmx.min.js', () => {
    it('should serve HTMX library', async () => {
      const response = await request(app)
        .get('/htmx.min.js')
        .expect(200);

      assert.ok(response.headers['content-type'].match(/javascript/));
    });
  });

  describe('GET /api/panoramicam', () => {
    it('should proxy image with correct headers', async () => {
      const testImageUrl = 'https://httpbin.org/image/png';
      const referer = 'https://panoramicam.eu/';

      const response = await request(app)
        .get('/api/panoramicam')
        .query({
          targetUrl: testImageUrl,
          referer: referer
        })
        .expect(200);

      assert.strictEqual(response.headers['access-control-allow-origin'], '*');
      assert.ok(response.headers['content-type']);
    });
  });
});
