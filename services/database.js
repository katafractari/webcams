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
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrate: add position column if missing (existing databases)
  const columns = db.pragma('table_info(webcams)');
  const hasPosition = columns.some(col => col.name === 'position');
  if (!hasPosition) {
    db.exec('ALTER TABLE webcams ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
    // Backfill positions based on id order per user
    const users = db.prepare('SELECT DISTINCT user_id FROM webcams').all();
    for (const { user_id } of users) {
      const webcams = db.prepare('SELECT id FROM webcams WHERE user_id = ? ORDER BY id').all(user_id);
      const update = db.prepare('UPDATE webcams SET position = ? WHERE id = ?');
      webcams.forEach((w, i) => update.run(i, w.id));
    }
  }

  // Migrate: add email column to users if missing
  const userColumns = db.pragma('table_info(users)');
  const hasEmail = userColumns.some(col => col.name === 'email');
  if (!hasEmail) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');

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
      ORDER BY w.position
    `);
    return stmt.all(username);
  }

  fetchWebcamsWithIds(username) {
    const stmt = this.db.prepare(`
      SELECT w.id, w.name, w.url
      FROM webcams w
      JOIN users u ON w.user_id = u.id
      WHERE u.username = ?
      ORDER BY w.position
    `);
    return stmt.all(username);
  }

  fetchWebcamById(webcamId, username) {
    const stmt = this.db.prepare(`
      SELECT w.id, w.name, w.url
      FROM webcams w
      JOIN users u ON w.user_id = u.id
      WHERE w.id = ? AND u.username = ?
    `);
    return stmt.get(webcamId, username) || null;
  }

  ensureUser(username) {
    this.db.prepare('INSERT OR IGNORE INTO users (username) VALUES (?)').run(username);
    return this.db.prepare('SELECT id FROM users WHERE username = ?').get(username).id;
  }

  ensureUserByEmail(email, username) {
    // Look up existing user by email
    const byEmail = this.db.prepare('SELECT username FROM users WHERE email = ?').get(email);
    if (byEmail) return byEmail.username;

    // Check if username already exists (e.g. seeded user with no email)
    const byUsername = this.db.prepare('SELECT id, email FROM users WHERE username = ?').get(username);
    if (byUsername && !byUsername.email) {
      // Link email to existing user
      this.db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, byUsername.id);
      return username;
    }

    // Create new user with email
    this.db.prepare('INSERT OR IGNORE INTO users (username, email) VALUES (?, ?)').run(username, email);
    return username;
  }

  createWebcam(username, name, url) {
    const userId = this.ensureUser(username);
    const max = this.db.prepare('SELECT COALESCE(MAX(position), -1) as maxPos FROM webcams WHERE user_id = ?').get(userId);
    const position = max.maxPos + 1;
    const result = this.db.prepare('INSERT INTO webcams (user_id, name, url, position) VALUES (?, ?, ?, ?)').run(userId, name, url, position);
    return result.lastInsertRowid;
  }

  updateWebcam(webcamId, username, name, url) {
    const result = this.db.prepare(`
      UPDATE webcams SET name = ?, url = ?
      WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)
    `).run(name, url, webcamId, username);
    return result.changes > 0;
  }

  deleteWebcam(webcamId, username) {
    const result = this.db.prepare(`
      DELETE FROM webcams
      WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)
    `).run(webcamId, username);
    return result.changes > 0;
  }

  updatePositions(username, orderedIds) {
    const userId = this.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!userId) return false;
    const update = this.db.prepare('UPDATE webcams SET position = ? WHERE id = ? AND user_id = ?');
    const transaction = this.db.transaction((ids) => {
      for (let i = 0; i < ids.length; i++) {
        update.run(i, ids[i], userId.id);
      }
    });
    transaction(orderedIds);
    return true;
  }

  close() {
    this.db.close();
  }
}

module.exports = { createDatabase, DatabaseService, DEFAULT_DB_PATH };
