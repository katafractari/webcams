const request = require('supertest');
const express = require('express');
const { engine } = require('express-handlebars');

// Mock the Google Sheets service
jest.mock('../services/googleSheets');
const mockGoogleSheets = require('../services/googleSheets');

// Create test app
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

  app.get('/webcams', async (req, res) => {
    try {
      const webcams = await mockGoogleSheets.fetchWebcams();
      res.render('webcams', { webcams });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).send('Error loading webcams');
    }
  });
  
  return app;
};

describe('Express App', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /', () => {
    test('should render main page with HTMX container', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<title>Webcams</title>');
      expect(response.text).toContain('hx-get="/webcams"');
      expect(response.text).toContain('hx-trigger="load, every 60s"');
      expect(response.text).toContain('<script src="/htmx.min.js"></script>');
      expect(mockGoogleSheets.fetchWebcams).not.toHaveBeenCalled();
    });

    test('should render empty container ready for HTMX', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<title>Webcams</title>');
      expect(response.text).toContain('<div class="container"');
      expect(response.text).toContain('hx-get="/webcams"');
      expect(mockGoogleSheets.fetchWebcams).not.toHaveBeenCalled();
    });

    test('should render page regardless of Google Sheets status', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<title>Webcams</title>');
      expect(response.text).toContain('hx-get="/webcams"');
      expect(mockGoogleSheets.fetchWebcams).not.toHaveBeenCalled();
    });

    test('should render proper HTML structure with HTMX', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for proper HTML structure
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<html lang="en">');
      expect(response.text).toContain('<meta charset="UTF-8">');
      expect(response.text).toContain('<meta name="viewport"');
      expect(response.text).toContain('<script src="/htmx.min.js"></script>');
      expect(response.text).toContain('<title>Webcams</title>');
      expect(response.text).toContain('<link rel="icon" href="favicon.ico"');
      
      // Check for CSS styles
      expect(response.text).toContain('body {');
      expect(response.text).toContain('.container {');
      expect(response.text).toContain('.image {');
      expect(response.text).toContain('@media (max-width: 600px)');
      
      // Check for HTMX attributes
      expect(response.text).toContain('hx-get="/webcams"');
      expect(response.text).toContain('hx-trigger="load, every 60s"');
      expect(response.text).toContain('hx-swap="innerHTML"');
      
      // Should not contain webcam content initially
      expect(response.text).not.toContain('<div class="image">');
      expect(mockGoogleSheets.fetchWebcams).not.toHaveBeenCalled();
    });

    test('should render empty container for HTMX to populate', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Should have empty container ready for HTMX
      expect(response.text).toContain('<div class="container"');
      expect(response.text).toContain('hx-get="/webcams"');
      
      // Should not have any image divs initially
      const imageDivMatches = response.text.match(/<div class="image">/g);
      expect(imageDivMatches).toBeNull();

      // Should not have any img tags initially
      const imgMatches = response.text.match(/<img src=/g);
      expect(imgMatches).toBeNull();
      
      expect(mockGoogleSheets.fetchWebcams).not.toHaveBeenCalled();
    });
  });

  describe('GET /webcams', () => {
    test('should render webcam partial successfully', async () => {
      const mockWebcams = [
        { name: 'Test Webcam 1', url: 'https://example.com/cam1.jpg' },
        { name: 'Test Webcam 2', url: 'https://example.com/cam2.jpg' }
      ];

      mockGoogleSheets.fetchWebcams.mockResolvedValue(mockWebcams);

      const response = await request(app)
        .get('/webcams')
        .expect(200);

      expect(response.text).toContain('Test Webcam 1');
      expect(response.text).toContain('Test Webcam 2');
      expect(response.text).toContain('https://example.com/cam1.jpg');
      expect(response.text).toContain('https://example.com/cam2.jpg');
      expect(response.text).toContain('<div class="image">');
      expect(response.text).not.toContain('<html>'); // Should be partial, not full HTML
      expect(mockGoogleSheets.fetchWebcams).toHaveBeenCalledTimes(1);
    });

    test('should handle Google Sheets service errors', async () => {
      mockGoogleSheets.fetchWebcams.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/webcams')
        .expect(500);

      expect(response.text).toBe('Error loading webcams');
      expect(mockGoogleSheets.fetchWebcams).toHaveBeenCalledTimes(1);
    });

    test('should render empty partial for no webcams', async () => {
      mockGoogleSheets.fetchWebcams.mockResolvedValue([]);

      const response = await request(app)
        .get('/webcams')
        .expect(200);

      expect(response.text.trim()).toBe('');
      expect(mockGoogleSheets.fetchWebcams).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /htmx.min.js', () => {
    test('should serve HTMX library', async () => {
      const response = await request(app)
        .get('/htmx.min.js')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/javascript/);
    });
  });
});