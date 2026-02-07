require('dotenv').config();
const express = require('express');
const { engine } = require('express-handlebars');
const { createDatabase, DatabaseService } = require('./services/database');

const PORT = process.env.PORT || 3000;
const DEFAULT_USER = process.env.DEFAULT_USER || 'rok';

const createApp = (dbService) => {
  if (!dbService) {
    const db = createDatabase();
    dbService = new DatabaseService(db);
  }

  const app = express();

  app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: false
  }));
  app.set('view engine', 'hbs');
  app.set('views', './views');

  app.use(express.urlencoded({ extended: true }));
  app.use(express.static('public'));
  app.use('/htmx.min.js', express.static('node_modules/htmx.org/dist/htmx.min.js'));

  app.get('/', (req, res) => {
    res.render('index');
  });

  app.get('/webcams', (req, res) => {
    try {
      const webcams = dbService.fetchWebcams(DEFAULT_USER);
      res.render('webcams', { webcams });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).send('Error loading webcams');
    }
  });

  // Backoffice routes
  app.get('/backoffice', (req, res) => {
    res.render('backoffice');
  });

  app.get('/backoffice/webcams', (req, res) => {
    try {
      const webcams = dbService.fetchWebcamsWithIds(DEFAULT_USER);
      res.render('backoffice-webcams', { webcams });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).send('Error loading webcams');
    }
  });

  app.get('/backoffice/webcams/new', (req, res) => {
    res.render('backoffice-form');
  });

  app.post('/backoffice/webcams', (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).send('Name and URL are required');
    }
    try {
      dbService.createWebcam(DEFAULT_USER, name.trim(), url.trim());
      const webcams = dbService.fetchWebcamsWithIds(DEFAULT_USER);
      res.render('backoffice-webcams', { webcams });
    } catch (error) {
      console.error('Error creating webcam:', error);
      res.status(500).send('Error creating webcam');
    }
  });

  app.get('/backoffice/webcams/:id/edit', (req, res) => {
    try {
      const webcam = dbService.fetchWebcamById(Number(req.params.id), DEFAULT_USER);
      if (!webcam) {
        return res.status(404).send('Webcam not found');
      }
      res.render('backoffice-form', { webcam });
    } catch (error) {
      console.error('Error fetching webcam:', error);
      res.status(500).send('Error loading webcam');
    }
  });

  app.put('/backoffice/webcams/:id', (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).send('Name and URL are required');
    }
    try {
      const updated = dbService.updateWebcam(Number(req.params.id), DEFAULT_USER, name.trim(), url.trim());
      if (!updated) {
        return res.status(404).send('Webcam not found');
      }
      const webcam = dbService.fetchWebcamById(Number(req.params.id), DEFAULT_USER);
      res.render('backoffice-webcam-row', webcam);
    } catch (error) {
      console.error('Error updating webcam:', error);
      res.status(500).send('Error updating webcam');
    }
  });

  app.delete('/backoffice/webcams/:id', (req, res) => {
    try {
      const deleted = dbService.deleteWebcam(Number(req.params.id), DEFAULT_USER);
      if (!deleted) {
        return res.status(404).send('Webcam not found');
      }
      res.send('');
    } catch (error) {
      console.error('Error deleting webcam:', error);
      res.status(500).send('Error deleting webcam');
    }
  });

  app.get('/api/panoramicam', async (req, res) => {
    const { targetUrl, referer } = req.query;

    if (!targetUrl || !referer) {
      return res.status(400).send('Missing "targetUrl" or "referer" parameter');
    }

    try {
      const imageResponse = await fetch(targetUrl, {
        headers: {
          'Referer': referer,
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        },
      });

      if (!imageResponse.ok) {
        return res.status(imageResponse.status).send('Failed to fetch the target image');
      }

      // Set CORS headers
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Content-Type', imageResponse.headers.get('Content-Type'));

      // Pipe the image response to the client
      const buffer = await imageResponse.arrayBuffer();
      res.send(Buffer.from(buffer));

    } catch (err) {
      res.status(500).send(`Error fetching image: ${err.message}`);
    }
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = createApp;
