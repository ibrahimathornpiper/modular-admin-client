const jwt = require('jsonwebtoken');
const { getSetting } = require('../db/database');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized. Token missing.', redirect: '/admin/login' });
    }

    const token = authHeader.split(' ')[1];
    const secret = await getSetting('localJwtSecret');

    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration. No JWT secret found.' });
    }

    const decoded = jwt.verify(token, secret);
    req.adminUser = decoded;
    next();
  } catch (error) {
    console.error('Auth Error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token.', redirect: '/admin/login' });
  }
}

module.exports = { requireAuth };
