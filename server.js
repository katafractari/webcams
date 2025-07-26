require('dotenv').config();
const express = require('express');
const { engine } = require('express-handlebars');
const googleSheets = require('./services/googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;

app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: false
}));
app.set('view engine', 'hbs');
app.set('views', './views');

app.use(express.static('public'));

app.get('/', async (req, res) => {
  try {
    const webcams = await googleSheets.fetchWebcams();
    res.render('index', { webcams });
  } catch (error) {
    console.error('Error rendering page:', error);
    res.status(500).send('Google Sheets unavailable. Please check configuration.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});