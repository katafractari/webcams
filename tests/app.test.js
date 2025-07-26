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
  
  app.get('/', async (req, res) => {
    try {
      const webcams = await mockGoogleSheets.fetchWebcams();
      res.render('index', { webcams });
    } catch (error) {
      console.error('Error rendering page:', error);
      res.status(500).send('Google Sheets unavailable. Please check configuration.');
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
    test('should render webcam page successfully', async () => {
      const mockWebcams = [
        { name: 'Test Webcam 1', url: 'https://example.com/cam1.jpg' },
        { name: 'Test Webcam 2', url: 'https://example.com/cam2.jpg' }
      ];

      mockGoogleSheets.fetchWebcams.mockResolvedValue(mockWebcams);

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('Test Webcam 1');
      expect(response.text).toContain('Test Webcam 2');
      expect(response.text).toContain('https://example.com/cam1.jpg');
      expect(response.text).toContain('https://example.com/cam2.jpg');
      expect(response.text).toContain('<title>Webcams</title>');
      expect(mockGoogleSheets.fetchWebcams).toHaveBeenCalledTimes(1);
    });

    test('should handle empty webcam list', async () => {
      mockGoogleSheets.fetchWebcams.mockResolvedValue([]);

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<title>Webcams</title>');
      expect(response.text).toContain('<div class="container">');
      expect(mockGoogleSheets.fetchWebcams).toHaveBeenCalledTimes(1);
    });

    test('should handle Google Sheets service errors', async () => {
      mockGoogleSheets.fetchWebcams.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/')
        .expect(500);

      expect(response.text).toBe('Google Sheets unavailable. Please check configuration.');
      expect(mockGoogleSheets.fetchWebcams).toHaveBeenCalledTimes(1);
    });

    test('should render proper HTML structure', async () => {
      const mockWebcams = [
        { name: 'Mountain View', url: 'https://example.com/mountain.jpg' }
      ];

      mockGoogleSheets.fetchWebcams.mockResolvedValue(mockWebcams);

      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for proper HTML structure
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<html lang="en">');
      expect(response.text).toContain('<meta charset="UTF-8">');
      expect(response.text).toContain('<meta name="viewport"');
      expect(response.text).toContain('<meta http-equiv="refresh" content="60">');
      expect(response.text).toContain('<title>Webcams</title>');
      expect(response.text).toContain('<link rel="icon" href="favicon.ico"');
      
      // Check for CSS styles
      expect(response.text).toContain('body {');
      expect(response.text).toContain('.container {');
      expect(response.text).toContain('.image {');
      expect(response.text).toContain('@media (max-width: 600px)');
      
      // Check for webcam rendering
      expect(response.text).toContain('<div class="image">');
      expect(response.text).toContain('<img src="https://example.com/mountain.jpg" alt="Mountain View">');
    });

    test('should render multiple webcams correctly', async () => {
      const mockWebcams = [
        { name: 'Webcam 1', url: 'https://example.com/1.jpg' },
        { name: 'Webcam 2', url: 'https://example.com/2.jpg' },
        { name: 'Webcam 3', url: 'https://example.com/3.jpg' }
      ];

      mockGoogleSheets.fetchWebcams.mockResolvedValue(mockWebcams);

      const response = await request(app)
        .get('/')
        .expect(200);

      // Should have three image divs
      const imageDivMatches = response.text.match(/<div class="image">/g);
      expect(imageDivMatches).toHaveLength(3);

      // Should have three img tags
      const imgMatches = response.text.match(/<img src=/g);
      expect(imgMatches).toHaveLength(3);

      // Check each webcam is rendered
      mockWebcams.forEach(webcam => {
        expect(response.text).toContain(`alt="${webcam.name}"`);
        expect(response.text).toContain(`src="${webcam.url}"`);
      });
    });
  });
});