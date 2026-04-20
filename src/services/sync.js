const axios = require('axios');
const { db, getSetting } = require('../db/database');

async function syncModules() {
  try {
    const licenseKey = await getSetting('licenseKey');
    if (!licenseKey) {
      console.log('[Sync] No license key found, skipping sync.');
      return;
    }

    const centralUrl = process.env.CENTRAL_SERVER_URL || 'https://api.hornpiper.site';
    console.log('[Sync] Synchronizing modules with central server...');

    const response = await axios.post(`${centralUrl}/api/v1/client-sync/modules`, {}, {
      headers: { 'Authorization': `Bearer ${licenseKey}` }
    });

    const activeModules = response.data; // Expecting array of names

    // Atomic update of active_modules
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM active_modules', (err) => {
          if (err) return reject(err);
        });

        const stmt = db.prepare('INSERT INTO active_modules (name) VALUES (?)');
        activeModules.forEach(name => {
          stmt.run(name);
        });
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    console.log(`[Sync] Successfully synchronized ${activeModules.length} modules.`);
  } catch (error) {
    console.error('[Sync] Error synchronizing modules:', error.message);
  }
}

function startBackgroundSync() {
  // Run once immediately on startup
  syncModules();

  // Run every 5 minutes
  setInterval(syncModules, 5 * 60 * 1000);
}

module.exports = { syncModules, startBackgroundSync };
