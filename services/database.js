const Database = require('better-sqlite3');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'webcams.db');

function createDatabase(dbPath = DEFAULT_DB_PATH) {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webcams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  return db;
}

class DatabaseService {
  constructor(db) {
    this.db = db;
  }

  fetchWebcams(username) {
    const stmt = this.db.prepare(`
      SELECT w.name, w.url
      FROM webcams w
      JOIN users u ON w.user_id = u.id
      WHERE u.username = ?
      ORDER BY w.id
    `);
    return stmt.all(username);
  }

  close() {
    this.db.close();
  }
}

module.exports = { createDatabase, DatabaseService, DEFAULT_DB_PATH };
