const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const { db, getSetting, setSetting, getAllSettings } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { licenseProxy } = require('../middleware/license');
const { syncModules } = require('../services/sync');

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', '..', 'public', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage: storage });

// ==========================================
// 1. SETUP WIZARD (POST /admin/api/setup)
// ==========================================
router.post('/setup', upload.single('logo'), async (req, res) => {
  const { email, password, siteName, primaryColor, licenseKey } = req.body;
  const logoPath = req.file ? `/admin/public/uploads/${req.file.filename}` : null;

  if (!email || !password || !siteName || !primaryColor || !licenseKey) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const isSetup = await getSetting('isSetupComplete');
    if (isSetup === 'true') {
      return res.status(400).json({ error: 'Setup is already complete.' });
    }

    // 1. Hash Password and Create Admin User
    const hash = await bcrypt.hash(password, 10);
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash], function(err) {
        if (err) reject(err); else resolve();
      });
    });

    // 2. Generate Local JWT Secret
    const localJwtSecret = crypto.randomBytes(64).toString('hex');

    // 3. Save Settings
    await setSetting('siteName', siteName);
    await setSetting('primaryColor', primaryColor);
    await setSetting('licenseKey', licenseKey);
    await setSetting('localJwtSecret', localJwtSecret);
    if (logoPath) await setSetting('logoPath', logoPath);
    await setSetting('isSetupComplete', 'true');

    res.json({ message: 'Setup completed successfully!' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Internal server error during setup.' });
  }
});

// ==========================================
// 2. LOGIN (POST /admin/api/login)
// ==========================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials.' });

    const secret = await getSetting('localJwtSecret');
    const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '24h' });

    // Trigger background sync immediately on login
    syncModules();

    res.json({ token, redirect: '/admin/dashboard' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// 3. SETTINGS (GET & POST /admin/api/settings)
// ==========================================
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getAllSettings();
    // Don't send sensitive secrets
    delete settings.localJwtSecret;
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/settings', requireAuth, upload.single('logo'), async (req, res) => {
  const { siteName, primaryColor, licenseKey } = req.body;
  const logoPath = req.file ? `/admin/public/uploads/${req.file.filename}` : null;

  try {
    if (siteName) await setSetting('siteName', siteName);
    if (primaryColor) await setSetting('primaryColor', primaryColor);
    if (licenseKey) await setSetting('licenseKey', licenseKey);
    if (logoPath) await setSetting('logoPath', logoPath);

    res.json({ message: 'Settings updated successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// ==========================================
// 4. MY MODULES (GET /admin/api/my-modules)
// ==========================================
router.get('/my-modules', requireAuth, async (req, res) => {
  try {
    const modules = await new Promise((resolve, reject) => {
      db.all('SELECT name FROM active_modules', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      });
    });
    res.json(modules);
  } catch (error) {
    console.error('Failed to load local modules:', error.message);
    res.status(500).json({ error: 'Failed to load active modules' });
  }
});

// ==========================================
// 5. CENTRAL SERVER PROXY (POST /admin/api/proxy/module-core/data)
// ==========================================
router.post('/proxy/module-core/data', requireAuth, licenseProxy, async (req, res) => {
  const centralUrl = process.env.CENTRAL_SERVER_URL || 'https://api.hornpiper.site';
  const token = req.clientConfig.token;

  try {
    const response = await axios.post(
      `${centralUrl}/api/proxy/module-core/data`,
      {},
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      if (error.response.status === 403) {
        // Module access revoked on central server - update local DB
        console.warn('[Proxy] Module "module-core" revoked. Removing from local cache.');
        db.run('DELETE FROM active_modules WHERE name = ?', ['module-core']);
      }
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to reach central server.' });
  }
});

// ==========================================
// 6. WEBHOOK: Receive modules from central server (POST /admin/api/sync-modules)
// ==========================================
router.post('/sync-modules', async (req, res) => {
  const { modules, secretKey } = req.body;

  if (!modules || !Array.isArray(modules)) {
    return res.status(400).json({ error: 'modules array is required' });
  }

  try {
    // Verify client exists
    const clientKey = await getSetting('licenseKey');
    if (!clientKey || clientKey !== secretKey) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }

    // Update local active_modules table (atomic)
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM active_modules', (err) => {
          if (err) return reject(err);
        });

        const stmt = db.prepare('INSERT INTO active_modules (name) VALUES (?)');
        modules.forEach(name => stmt.run(name));
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    console.log(`[Webhook] Synced ${modules.length} modules.`);
    res.json({ success: true, modules });
  } catch (error) {
    console.error('[Webhook] Sync error:', error.message);
    res.status(500).json({ error: 'Failed to sync modules' });
  }
});

module.exports = router;
