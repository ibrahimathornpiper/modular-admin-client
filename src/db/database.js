const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('[SQLite] Connected to local database.');
  }
});

// Initialize Tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS active_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);
});

// Utility functions for Settings
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
};

const setSetting = (key, value) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};

const getAllSettings = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
      if (err) reject(err);
      else {
        const config = {};
        rows.forEach(row => { config[row.key] = row.value; });
        resolve(config);
      }
    });
  });
};

module.exports = {
  db,
  getSetting,
  setSetting,
  getAllSettings
};
