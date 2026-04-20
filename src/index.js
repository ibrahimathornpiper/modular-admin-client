require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { checkSetup } = require('./middleware/setup');
const { requireAuth } = require('./middleware/auth');
const { startBackgroundSync } = require('./services/sync');

// Start background synchronization
startBackgroundSync();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// STATIC FILES
// ==========================================
// Mount all static assets (Logos, Uploads) under /admin/public
app.use('/admin/public', express.static(path.join(__dirname, '..', 'public')));

// ==========================================
// GLOBAL SETUP CHECK (Applies to all /admin routes)
// ==========================================
app.use('/admin', checkSetup);

// ==========================================
// API ROUTES
// ==========================================
app.use('/admin/api', require('./routes/admin'));

// ==========================================
// HTML VIEWS (Protected & Unprotected)
// ==========================================

// 1. Unprotected: Install & Login
app.get('/admin/install', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'install.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.get('/admin/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.get('/admin/settings', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'settings.html'));
});



// ==========================================
// 404 & REDIRECTS
// ==========================================

// Serve React app at root
app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

// Global 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/admin/api')) {
    return res.status(404).json({ error: 'API Endpoint Not Found' });
  }
  
  // Generic 404 HTML Page (or redirect to dashboard)
  if (req.path.startsWith('/admin')) {
    return res.status(404).send('<h1>404 - Admin Page Not Found</h1><a href="/admin/dashboard">Go to Dashboard</a>');
  }

  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`[Admin Proxy] Server running on port ${PORT}`);
});
