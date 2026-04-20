const { getSetting } = require('../db/database');

async function checkSetup(req, res, next) {
  // Since this middleware is mounted on "/admin" in index.js,
  // req.path will be relative to "/admin" (e.g., "/install", "/api/setup", "/public/...")

  // 1. IGNORE: Setup API, Install Page, and Static Assets
  if (
    req.path.startsWith('/api/setup') || 
    req.path === '/install' || 
    req.path.startsWith('/public/')
  ) {
    // If setup is ALREADY complete and user tries to hit /install, send them to dashboard
    if (req.path === '/install') {
      try {
        const isSetupComplete = await getSetting('isSetupComplete');
        if (isSetupComplete === 'true') {
          return res.redirect('/admin/dashboard');
        }
      } catch (e) { /* ignore */ }
    }
    return next();
  }

  try {
    const isSetupComplete = await getSetting('isSetupComplete');
    
    if (isSetupComplete !== 'true') {
      // 2. REDIRECT: If setup is NOT complete, force them to /install
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'Setup incomplete.', redirect: '/admin/install' });
      } else {
        return res.redirect('/admin/install');
      }
    }
    
    next();
  } catch (error) {
    console.error('CheckSetup Error:', error);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = { checkSetup };
