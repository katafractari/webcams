const { describe, it, beforeEach, afterEach, mock } = require('node:test');
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

      const mockError = mock.method(console, 'error', () => {});
      const response = await request(brokenApp)
        .get('/webcams')
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

  describe('Backoffice', () => {
    describe('GET /backoffice', () => {
      it('should render backoffice page', async () => {
        const response = await request(app)
          .get('/backoffice')
          .expect(200);

        assert.ok(response.text.includes('<title>Backoffice - Webcams</title>'));
        assert.ok(response.text.includes('hx-get="/backoffice/webcams"'));
        assert.ok(response.text.includes('Add New Webcam'));
      });
    });

    describe('GET /backoffice/webcams', () => {
      it('should render webcam list with ids', async () => {
        const response = await request(app)
          .get('/backoffice/webcams')
          .expect(200);

        assert.ok(response.text.includes('Test Webcam 1'));
        assert.ok(response.text.includes('Test Webcam 2'));
        assert.ok(response.text.includes('<table'));
        assert.ok(response.text.includes('webcam-row-'));
      });

      it('should handle database errors', async () => {
        const brokenService = {
          fetchWebcamsWithIds: () => { throw new Error('Database error'); }
        };
        const brokenApp = createApp(brokenService);

        const mockError = mock.method(console, 'error', () => {});
        const response = await request(brokenApp)
          .get('/backoffice/webcams')
          .expect(500);
        mockError.mock.restore();

        assert.strictEqual(response.text, 'Error loading webcams');
      });
    });

    describe('GET /backoffice/webcams/new', () => {
      it('should render create form', async () => {
        const response = await request(app)
          .get('/backoffice/webcams/new')
          .expect(200);

        assert.ok(response.text.includes('New Webcam'));
        assert.ok(response.text.includes('hx-post="/backoffice/webcams"'));
        assert.ok(response.text.includes('name="name"'));
        assert.ok(response.text.includes('name="url"'));
      });
    });

    describe('POST /backoffice/webcams', () => {
      it('should create a webcam and return updated list', async () => {
        const response = await request(app)
          .post('/backoffice/webcams')
          .type('form')
          .send({ name: 'New Cam', url: 'https://example.com/new.jpg' })
          .expect(200);

        assert.ok(response.text.includes('New Cam'));
        assert.ok(response.text.includes('https://example.com/new.jpg'));
        assert.ok(response.text.includes('<table'));
      });

      it('should reject missing name', async () => {
        await request(app)
          .post('/backoffice/webcams')
          .type('form')
          .send({ url: 'https://example.com/new.jpg' })
          .expect(400);
      });

      it('should reject missing url', async () => {
        await request(app)
          .post('/backoffice/webcams')
          .type('form')
          .send({ name: 'New Cam' })
          .expect(400);
      });
    });

    describe('GET /backoffice/webcams/:id/edit', () => {
      it('should render edit form with webcam data', async () => {
        const webcams = dbService.fetchWebcamsWithIds('rok');
        const webcamId = webcams[0].id;

        const response = await request(app)
          .get(`/backoffice/webcams/${webcamId}/edit`)
          .expect(200);

        assert.ok(response.text.includes('Edit Webcam'));
        assert.ok(response.text.includes('Test Webcam 1'));
        assert.ok(response.text.includes('https://example.com/cam1.jpg'));
        assert.ok(response.text.includes(`hx-put="/backoffice/webcams/${webcamId}"`));
      });

      it('should return 404 for non-existent webcam', async () => {
        const response = await request(app)
          .get('/backoffice/webcams/99999/edit')
          .expect(404);

        assert.strictEqual(response.text, 'Webcam not found');
      });
    });

    describe('PUT /backoffice/webcams/:id', () => {
      it('should update a webcam and return updated row', async () => {
        const webcams = dbService.fetchWebcamsWithIds('rok');
        const webcamId = webcams[0].id;

        const response = await request(app)
          .put(`/backoffice/webcams/${webcamId}`)
          .type('form')
          .send({ name: 'Updated Cam', url: 'https://example.com/updated.jpg' })
          .expect(200);

        assert.ok(response.text.includes('Updated Cam'));
        assert.ok(response.text.includes('https://example.com/updated.jpg'));
        assert.ok(response.text.includes(`webcam-row-${webcamId}`));
      });

      it('should return 404 for non-existent webcam', async () => {
        const response = await request(app)
          .put('/backoffice/webcams/99999')
          .type('form')
          .send({ name: 'Name', url: 'https://example.com/url.jpg' })
          .expect(404);

        assert.strictEqual(response.text, 'Webcam not found');
      });

      it('should reject missing fields', async () => {
        const webcams = dbService.fetchWebcamsWithIds('rok');
        const webcamId = webcams[0].id;

        await request(app)
          .put(`/backoffice/webcams/${webcamId}`)
          .type('form')
          .send({ name: 'Only Name' })
          .expect(400);
      });
    });

    describe('DELETE /backoffice/webcams/:id', () => {
      it('should delete a webcam and return empty response', async () => {
        const webcams = dbService.fetchWebcamsWithIds('rok');
        const webcamId = webcams[0].id;

        const response = await request(app)
          .delete(`/backoffice/webcams/${webcamId}`)
          .expect(200);

        assert.strictEqual(response.text, '');
      });

      it('should return 404 for non-existent webcam', async () => {
        const response = await request(app)
          .delete('/backoffice/webcams/99999')
          .expect(404);

        assert.strictEqual(response.text, 'Webcam not found');
      });
    });
  });
});
