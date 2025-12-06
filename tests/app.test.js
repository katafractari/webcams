const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const { engine } = require('express-handlebars');

// Load environment variables
require('./setup');

// Create test app with mock Google Sheets service
const createTestApp = () => {
  const app = express();
  
  app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: false
  }));
  app.set('view engine', 'hbs');
  app.set('views', './views');
  
  app.use(express.static('public'));
  app.use('/htmx.min.js', express.static('node_modules/htmx.org/dist/htmx.min.js'));
  
  app.get('/', (req, res) => {
    res.render('index');
  });

  // Mock Google Sheets service for testing
  const mockGoogleSheets = {
    fetchWebcams: null,
    _calls: 0,
    _reset() {
      this._calls = 0;
    }
  };

  app.get('/webcams', async (req, res) => {
    try {
      mockGoogleSheets._calls++;
      const webcams = await mockGoogleSheets.fetchWebcams();
      res.render('webcams', { webcams });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).send('Error loading webcams');
    }
  });
  
  // Expose mock for testing
  app._mockGoogleSheets = mockGoogleSheets;
  
  return app;
};

describe('Express App', () => {
  let app;
  let mockGoogleSheets;

  beforeEach(() => {
    app = createTestApp();
    mockGoogleSheets = app._mockGoogleSheets;
    mockGoogleSheets._reset();
    
    // Setup default mock function
    mockGoogleSheets.fetchWebcams = async () => [];
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
      assert.strictEqual(mockGoogleSheets._calls, 0);
    });

    it('should render empty container ready for HTMX', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('<div class="container"'));
      assert.ok(response.text.includes('hx-get="/webcams"'));
      assert.strictEqual(mockGoogleSheets._calls, 0);
    });

    it('should render page regardless of Google Sheets status', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('hx-get="/webcams"'));
      assert.strictEqual(mockGoogleSheets._calls, 0);
    });

    it('should render proper HTML structure with HTMX', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for proper HTML structure
      assert.ok(response.text.includes('<!DOCTYPE html>'));
      assert.ok(response.text.includes('<html lang="en">'));
      assert.ok(response.text.includes('<meta charset="UTF-8">'));
      assert.ok(response.text.includes('<meta name="viewport"'));
      assert.ok(response.text.includes('<script src="/htmx.min.js"></script>'));
      assert.ok(response.text.includes('<title>Webcams</title>'));
      assert.ok(response.text.includes('<link rel="icon" href="favicon.ico"'));
      
      // Check for CSS styles
      assert.ok(response.text.includes('body {'));
      assert.ok(response.text.includes('.container {'));
      assert.ok(response.text.includes('.image {'));
      assert.ok(response.text.includes('@media (max-width: 600px)'));
      
      // Check for HTMX attributes
      assert.ok(response.text.includes('hx-get="/webcams"'));
      assert.ok(response.text.includes('hx-trigger="load, every 60s"'));
      assert.ok(response.text.includes('hx-swap="innerHTML"'));
      
      // Should not contain webcam content initially
      assert.ok(!response.text.includes('<div class="image">'));
      assert.strictEqual(mockGoogleSheets._calls, 0);
    });

    it('should render empty container for HTMX to populate', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Should have empty container ready for HTMX
      assert.ok(response.text.includes('<div class="container"'));
      assert.ok(response.text.includes('hx-get="/webcams"'));
      
      // Should not have any image divs initially
      const imageDivMatches = response.text.match(/<div class="image">/g);
      assert.strictEqual(imageDivMatches, null);

      // Should not have any img tags initially
      const imgMatches = response.text.match(/<img src=/g);
      assert.strictEqual(imgMatches, null);
      
      assert.strictEqual(mockGoogleSheets._calls, 0);
    });
  });

  describe('GET /webcams', () => {
    it('should render webcam partial successfully', async () => {
      const mockWebcams = [
        { name: 'Test Webcam 1', url: 'https://example.com/cam1.jpg' },
        { name: 'Test Webcam 2', url: 'https://example.com/cam2.jpg' }
      ];

      mockGoogleSheets.fetchWebcams = async () => mockWebcams;

      const response = await request(app)
        .get('/webcams')
        .expect(200);

      assert.ok(response.text.includes('Test Webcam 1'));
      assert.ok(response.text.includes('Test Webcam 2'));
      assert.ok(response.text.includes('https://example.com/cam1.jpg'));
      assert.ok(response.text.includes('https://example.com/cam2.jpg'));
      assert.ok(response.text.includes('<div class="image">'));
      assert.ok(!response.text.includes('<html>')); // Should be partial, not full HTML
      assert.strictEqual(mockGoogleSheets._calls, 1);
    });

    it('should handle Google Sheets service errors', async () => {
      mockGoogleSheets.fetchWebcams = async () => {
        throw new Error('Service error');
      };

      const response = await request(app)
        .get('/webcams')
        .expect(500);

      assert.strictEqual(response.text, 'Error loading webcams');
      assert.strictEqual(mockGoogleSheets._calls, 1);
    });

    it('should render empty partial for no webcams', async () => {
      mockGoogleSheets.fetchWebcams = async () => [];

      const response = await request(app)
        .get('/webcams')
        .expect(200);

      assert.strictEqual(response.text.trim(), '');
      assert.strictEqual(mockGoogleSheets._calls, 1);
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
});