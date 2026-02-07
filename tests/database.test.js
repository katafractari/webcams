const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createDatabase, DatabaseService } = require('../services/database');

describe('DatabaseService', () => {
  let db;
  let service;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new DatabaseService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('schema', () => {
    it('should create users table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      ).all();
      assert.strictEqual(tables.length, 1);
    });

    it('should create webcams table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='webcams'"
      ).all();
      assert.strictEqual(tables.length, 1);
    });

    it('should enforce unique usernames', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('testuser');
      assert.throws(
        () => db.prepare('INSERT INTO users (username) VALUES (?)').run('testuser'),
        /UNIQUE constraint failed/
      );
    });

    it('should enforce foreign key on webcams', () => {
      assert.throws(
        () => db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(999, 'cam', 'http://example.com'),
        /FOREIGN KEY constraint failed/
      );
    });
  });

  describe('fetchWebcams', () => {
    it('should return webcams for a given user', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');
      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Cam 1', 'https://example.com/1.jpg');
      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Cam 2', 'https://example.com/2.jpg');

      const result = service.fetchWebcams('rok');

      assert.deepStrictEqual(result, [
        { name: 'Cam 1', url: 'https://example.com/1.jpg' },
        { name: 'Cam 2', url: 'https://example.com/2.jpg' }
      ]);
    });

    it('should return empty array for user with no webcams', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('empty');
      const result = service.fetchWebcams('empty');
      assert.deepStrictEqual(result, []);
    });

    it('should return empty array for non-existent user', () => {
      const result = service.fetchWebcams('nobody');
      assert.deepStrictEqual(result, []);
    });

    it('should only return webcams for the specified user', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user1');
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user2');
      const user1 = db.prepare('SELECT id FROM users WHERE username = ?').get('user1');
      const user2 = db.prepare('SELECT id FROM users WHERE username = ?').get('user2');

      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user1.id, 'User1 Cam', 'https://example.com/u1.jpg');
      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user2.id, 'User2 Cam', 'https://example.com/u2.jpg');

      const result = service.fetchWebcams('user1');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'User1 Cam');
    });

    it('should return webcams in insertion order', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');

      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Alpha', 'https://example.com/a.jpg');
      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Beta', 'https://example.com/b.jpg');
      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Gamma', 'https://example.com/g.jpg');

      const result = service.fetchWebcams('rok');
      assert.strictEqual(result[0].name, 'Alpha');
      assert.strictEqual(result[1].name, 'Beta');
      assert.strictEqual(result[2].name, 'Gamma');
    });
  });

  describe('fetchWebcamsWithIds', () => {
    it('should return webcams with ids for a given user', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');
      db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Cam 1', 'https://example.com/1.jpg');

      const result = service.fetchWebcamsWithIds('rok');

      assert.strictEqual(result.length, 1);
      assert.ok(result[0].id);
      assert.strictEqual(result[0].name, 'Cam 1');
      assert.strictEqual(result[0].url, 'https://example.com/1.jpg');
    });

    it('should return empty array for non-existent user', () => {
      const result = service.fetchWebcamsWithIds('nobody');
      assert.deepStrictEqual(result, []);
    });
  });

  describe('fetchWebcamById', () => {
    it('should return a webcam by id and username', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');
      const { lastInsertRowid } = db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Cam 1', 'https://example.com/1.jpg');

      const result = service.fetchWebcamById(Number(lastInsertRowid), 'rok');

      assert.strictEqual(result.name, 'Cam 1');
      assert.strictEqual(result.url, 'https://example.com/1.jpg');
    });

    it('should return null for non-existent webcam', () => {
      const result = service.fetchWebcamById(999, 'rok');
      assert.strictEqual(result, null);
    });

    it('should return null for webcam belonging to different user', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user1');
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user2');
      const user1 = db.prepare('SELECT id FROM users WHERE username = ?').get('user1');
      const { lastInsertRowid } = db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user1.id, 'Cam', 'https://example.com/1.jpg');

      const result = service.fetchWebcamById(Number(lastInsertRowid), 'user2');
      assert.strictEqual(result, null);
    });
  });

  describe('ensureUser', () => {
    it('should create a new user and return id', () => {
      const id = service.ensureUser('newuser');
      assert.ok(id);
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('newuser');
      assert.strictEqual(user.username, 'newuser');
    });

    it('should return existing user id without error', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('existing');
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('existing');

      const id = service.ensureUser('existing');
      assert.strictEqual(id, existingUser.id);
    });
  });

  describe('createWebcam', () => {
    it('should create a webcam and return its id', () => {
      const id = service.createWebcam('rok', 'New Cam', 'https://example.com/new.jpg');
      assert.ok(id);

      const webcam = db.prepare('SELECT * FROM webcams WHERE id = ?').get(id);
      assert.strictEqual(webcam.name, 'New Cam');
      assert.strictEqual(webcam.url, 'https://example.com/new.jpg');
    });

    it('should auto-create user if not exists', () => {
      service.createWebcam('brandnew', 'Cam', 'https://example.com/cam.jpg');
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('brandnew');
      assert.ok(user);
    });
  });

  describe('updateWebcam', () => {
    it('should update a webcam and return true', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');
      const { lastInsertRowid } = db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'Old', 'https://example.com/old.jpg');

      const result = service.updateWebcam(Number(lastInsertRowid), 'rok', 'Updated', 'https://example.com/updated.jpg');
      assert.strictEqual(result, true);

      const webcam = db.prepare('SELECT * FROM webcams WHERE id = ?').get(Number(lastInsertRowid));
      assert.strictEqual(webcam.name, 'Updated');
      assert.strictEqual(webcam.url, 'https://example.com/updated.jpg');
    });

    it('should return false for non-existent webcam', () => {
      const result = service.updateWebcam(999, 'rok', 'Name', 'https://example.com/url.jpg');
      assert.strictEqual(result, false);
    });

    it('should return false for webcam belonging to different user', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user1');
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user2');
      const user1 = db.prepare('SELECT id FROM users WHERE username = ?').get('user1');
      const { lastInsertRowid } = db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user1.id, 'Cam', 'https://example.com/1.jpg');

      const result = service.updateWebcam(Number(lastInsertRowid), 'user2', 'Hacked', 'https://evil.com');
      assert.strictEqual(result, false);
    });
  });

  describe('deleteWebcam', () => {
    it('should delete a webcam and return true', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('rok');
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('rok');
      const { lastInsertRowid } = db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user.id, 'ToDelete', 'https://example.com/del.jpg');

      const result = service.deleteWebcam(Number(lastInsertRowid), 'rok');
      assert.strictEqual(result, true);

      const webcam = db.prepare('SELECT * FROM webcams WHERE id = ?').get(Number(lastInsertRowid));
      assert.strictEqual(webcam, undefined);
    });

    it('should return false for non-existent webcam', () => {
      const result = service.deleteWebcam(999, 'rok');
      assert.strictEqual(result, false);
    });

    it('should return false for webcam belonging to different user', () => {
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user1');
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user2');
      const user1 = db.prepare('SELECT id FROM users WHERE username = ?').get('user1');
      const { lastInsertRowid } = db.prepare('INSERT INTO webcams (user_id, name, url) VALUES (?, ?, ?)').run(user1.id, 'Cam', 'https://example.com/1.jpg');

      const result = service.deleteWebcam(Number(lastInsertRowid), 'user2');
      assert.strictEqual(result, false);
    });
  });

  describe('createDatabase', () => {
    it('should create tables idempotently', () => {
      // Creating database twice with same path should not error
      const db2 = createDatabase(':memory:');
      const tables = db2.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all();
      assert.ok(tables.some(t => t.name === 'users'));
      assert.ok(tables.some(t => t.name === 'webcams'));
      db2.close();
    });
  });
});
