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
app.use('/htmx.min.js', express.static('node_modules/htmx.org/dist/htmx.min.js'));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/webcams', async (req, res) => {
  try {
    const webcams = await googleSheets.fetchWebcams();
    res.render('webcams', { webcams });
  } catch (error) {
    console.error('Error fetching webcams:', error);
    res.status(500).send('Error loading webcams');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});