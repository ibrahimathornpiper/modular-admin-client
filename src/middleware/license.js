const jwt = require('jsonwebtoken');
const { getSetting } = require('../db/database');

async function licenseProxy(req, res, next) {
  try {
    const licenseKey = await getSetting('licenseKey');

    if (!licenseKey) {
      return res.status(401).json({ error: 'No license key found in database.' });
    }

    // Decode without verifying signature locally (Central Server verifies it)
    const decoded = jwt.decode(licenseKey);

    if (!decoded) {
      return res.status(403).json({ error: 'Invalid license format.' });
    }

    req.clientConfig = {
      clientId: decoded.clientId,
      token: licenseKey
    };

    next();
  } catch (err) {
    console.error('License Decode Error:', err);
    return res.status(500).json({ error: 'Failed to process license.' });
  }
}

module.exports = { licenseProxy };
