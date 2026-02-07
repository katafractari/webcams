require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const { engine } = require('express-handlebars');
const { OAuth2Client } = require('google-auth-library');
const { createDatabase, DatabaseService } = require('./services/database');

const PORT = process.env.PORT || 3000;

const createApp = (dbService) => {
  const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-secret';
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
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
  app.use(express.json());
  app.use(cookieParser(COOKIE_SECRET));
  app.use(express.static('public'));
  app.use('/htmx.min.js', express.static('node_modules/htmx.org/dist/htmx.min.js'));
  app.use('/Sortable.min.js', express.static('node_modules/sortablejs/Sortable.min.js'));

  // Auth routes (no auth required)
  app.get('/auth/google', (req, res) => {
    const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
    });
    res.redirect(authorizeUrl);
  });

  app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
    try {
      const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const email = payload.email;
      const username = email.split('@')[0];
      const resolvedUsername = dbService.ensureUserByEmail(email, username);
      res.cookie('username', resolvedUsername, {
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      res.redirect('/');
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/auth/logout', (req, res) => {
    res.clearCookie('username');
    res.redirect('/auth/google');
  });

  // Auth middleware for all routes below
  app.use((req, res, next) => {
    const username = req.signedCookies.username;
    if (!username) {
      return res.redirect('/auth/google');
    }
    req.username = username;
    next();
  });

  app.get('/', (req, res) => {
    res.render('index', { username: req.username });
  });

  app.get('/webcams', (req, res) => {
    try {
      if (req.query.edit === 'true') {
        const webcams = dbService.fetchWebcamsWithIds(req.username);
        return res.render('webcams-edit', { webcams });
      }
      const webcams = dbService.fetchWebcams(req.username);
      res.render('webcams', { webcams });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).send('Error loading webcams');
    }
  });

  // Inline edit routes
  app.put('/webcams/reorder', (req, res) => {
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).send('Invalid order data');
    }
    try {
      dbService.updatePositions(req.username, order);
      res.send('');
    } catch (error) {
      console.error('Error reordering webcams:', error);
      res.status(500).send('Error reordering webcams');
    }
  });

  app.get('/webcams/new', (req, res) => {
    res.render('webcams-form');
  });

  app.post('/webcams', (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).send('Name and URL are required');
    }
    try {
      dbService.createWebcam(req.username, name.trim(), url.trim());
      const webcams = dbService.fetchWebcamsWithIds(req.username);
      res.render('webcams-edit', { webcams });
    } catch (error) {
      console.error('Error creating webcam:', error);
      res.status(500).send('Error creating webcam');
    }
  });

  app.get('/webcams/:id/edit', (req, res) => {
    try {
      const webcam = dbService.fetchWebcamById(Number(req.params.id), req.username);
      if (!webcam) {
        return res.status(404).send('Webcam not found');
      }
      res.render('webcams-form', { webcam });
    } catch (error) {
      console.error('Error fetching webcam:', error);
      res.status(500).send('Error loading webcam');
    }
  });

  app.put('/webcams/:id', (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).send('Name and URL are required');
    }
    try {
      const updated = dbService.updateWebcam(Number(req.params.id), req.username, name.trim(), url.trim());
      if (!updated) {
        return res.status(404).send('Webcam not found');
      }
      const webcam = dbService.fetchWebcamById(Number(req.params.id), req.username);
      res.render('webcams-edit-card', webcam);
    } catch (error) {
      console.error('Error updating webcam:', error);
      res.status(500).send('Error updating webcam');
    }
  });

  app.delete('/webcams/:id', (req, res) => {
    try {
      const deleted = dbService.deleteWebcam(Number(req.params.id), req.username);
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
