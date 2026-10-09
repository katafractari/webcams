require('dotenv').config();
const express = require('express');
const { engine } = require('express-handlebars');
const googleSheets = require('./services/googleSheets');

const PORT = process.env.PORT || 3000;

const createApp = (googleSheetsService = googleSheets) => {
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
      const webcams = await googleSheetsService.fetchWebcams();
      res.render('webcams', { webcams });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).send('Error loading webcams');
    }
  });

  app.get('/api/panoramicam', async (req, res) => {
    const { targetUrl, referer } = req.query;

    if (!targetUrl || !referer) {
      return res.status(400).send('Missing "targetUrl" or "referer" parameter');
    }

    let target;
    try {
      target = new URL(targetUrl);
    } catch {
      return res.status(400).send('Invalid image URL');
    }
    if (target.protocol !== 'https:' || target.hostname !== 'liveimage.panoramicam.eu' ||
        target.port || target.username || target.password) {
      return res.status(403).send('Image provider is not allowed');
    }

    try {
      const imageResponse = await fetch(target.href, {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Referer': 'https://panoramicam.eu/',
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
      res.status(502).send('Failed to fetch the target image');
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
