#!/usr/bin/env node
// Migration script: fetches webcam data from Google Sheets and seeds the SQLite database
// Usage: GOOGLE_SHEET_ID=... GOOGLE_SHEETS_API_KEY=... node scripts/seed.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createDatabase } = require('../services/database');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function fetchWebcamsFromSheet() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const range = process.env.SHEET_RANGE || 'A2:B';

  if (!sheetId || !apiKey) {
    throw new Error('GOOGLE_SHEET_ID and GOOGLE_SHEETS_API_KEY must be set in environment');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Sheets API error: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('No values found in Google Sheets response');
  }

  return data.values
    .filter(row => Array.isArray(row) && row.length >= 2 && row[0] && row[1])
    .map(row => ({ name: row[0], url: row[1] }));
}

async function main() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('Fetching webcams from Google Sheets...');
  const webcams = await fetchWebcamsFromSheet();
  console.log(`Found ${webcams.length} webcams`);

  const db = createDatabase();

  // Create the default user
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username) VALUES (?)');
  insertUser.run('rok');

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');

  // Clear existing webcams for this user and re-seed
  db.prepare('DELETE FROM webcams WHERE user_id = ?').run(user.id);

  const insertWebcam = db.prepare('INSERT INTO webcams (user_id, name, url, position) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction((webcams) => {
    for (let i = 0; i < webcams.length; i++) {
      insertWebcam.run(user.id, webcams[i].name, webcams[i].url, i);
    }
  });

  insertMany(webcams);
  console.log(`Seeded ${webcams.length} webcams for user 'rok'`);

  db.close();
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
