// ── api/[...path].js ─────────────────────────────────────────────────────────
// Runs the Express backend DIRECTLY as a Vercel serverless function.
// No separate backend deployment needed — everything runs on Vercel.
//
// How it works:
//   1. Import the Express app from backend/src/server.js
//   2. Strip the Vercel-injected query params from the URL
//   3. Prefix /api/ so Express router matches correctly
//   4. Let Express handle the request natively

'use strict';

// Load backend env from .env (Vercel injects env vars; dotenv is a no-op if already set)
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

// Lazy-load the Express app — cached across warm invocations
let _app = null;
function getApp() {
  if (!_app) {
    // Suppress WebSocket server init in serverless (no persistent TCP connections)
    process.env.DISABLE_WEBSOCKET = 'true';
    _app = require('../backend/src/server');
  }
  return _app;
}

// Strip Vercel-injected dynamic segment query params from URL
function cleanUrl(url) {
  if (!url) return '/';
  const idx = url.indexOf('?');
  if (idx === -1) return url;

  const pathname = url.slice(0, idx);
  const params   = new URLSearchParams(url.slice(idx + 1));

  // Vercel injects these for catch-all segments — remove them before forwarding
  ['path', 'path[]', 'slug', 'slug[]'].forEach(k => params.delete(k));

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// Ensure the path starts with /api so the Express router matches
function ensureApiPrefix(pathname) {
  if (pathname.startsWith('/api')) return pathname;
  return '/api' + (pathname === '/' ? '' : pathname);
}

module.exports = (req, res) => {
  try {
    // Reconstruct clean URL with /api prefix
    const clean   = cleanUrl(req.url || '/');
    const idx     = clean.indexOf('?');
    const pathname = idx >= 0 ? clean.slice(0, idx) : clean;
    const qs       = idx >= 0 ? clean.slice(idx) : '';
    req.url        = ensureApiPrefix(pathname) + qs;

    // Let Express handle it
    return getApp()(req, res);
  } catch (err) {
    console.error('[Serverless] Fatal:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
