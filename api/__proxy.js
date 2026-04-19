// ── api/__proxy.js ───────────────────────────────────────────────────────────
// Target for vercel.json rewrite: `/api/:path*` → `/api/__proxy` (path in query).
// See lib/vercel-api-proxy-handler.js

module.exports = require('../lib/vercel-api-proxy-handler');
