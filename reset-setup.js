const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("DELETE FROM settings WHERE key = 'isSetupComplete'", (err) => {
    if (err) {
      console.error('Error deleting isSetupComplete:', err.message);
    } else {
      console.log('Deleted isSetupComplete');
    }
  });

  db.run("DELETE FROM settings WHERE key = 'adminPassword'", (err) => {
    if (err) {
      console.error('Error deleting adminPassword:', err.message);
    } else {
      console.log('Deleted adminPassword');
    }
  });

  db.run("DELETE FROM settings WHERE key = 'adminEmail'", (err) => {
    if (err) {
      console.error('Error deleting adminEmail:', err.message);
    } else {
      console.log('Deleted adminEmail');
    }
  });
});

db.close(() => {
  console.log('Setup data has been reset. You can now run /admin/install again.');
});