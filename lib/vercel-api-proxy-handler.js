'use strict';

/**
 * Shared Vercel serverless handler: forward `/api/*` to Render (BACKEND_URL).
 * Used by `api/index.js`, `api/__proxy.js`, and `vercel.json` rewrites (non-Next projects do not
 * expand `api/[...path].js` catch-alls; rewrites pass `:path*` as `?path=`).
 */
const { normalizeProxyTargetPath } = require('./vercel-proxy-path');
const { forwardToBackend } = require('./vercel-proxy-fetch');

function getMergedQuery(req) {
  const q = req.query && typeof req.query === 'object' ? { ...req.query } : {};
  try {
    const raw = req.url || '';
    const i = raw.indexOf('?');
    if (i >= 0) {
      const fromUrl = Object.fromEntries(new URLSearchParams(raw.slice(i + 1)));
      Object.assign(q, fromUrl);
    }
  } catch { /* ignore */ }
  return q;
}

/** @param {import('http').IncomingMessage & { query?: Record<string, unknown> }} req */
function resolveProxyUrlIn(req) {
  const q = getMergedQuery(req);
  const rawPath = q.path ?? q['path[]'];
  const hasPath = rawPath != null && rawPath !== '' && !(Array.isArray(rawPath) && rawPath.length === 0);
  if (hasPath) {
    const sub = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath);
    const clean = sub.replace(/^\/+/, '');
    if (!clean) {
      const fallback = req.url && req.url !== '/' ? req.url : '/api';
      return fallback;
    }
    const rest = { ...q };
    delete rest.path;
    const keys = Object.keys(rest);
    if (!keys.length) return `/${clean}`;
    const u = new URLSearchParams();
    for (const k of keys) {
      const v = rest[k];
      if (Array.isArray(v)) v.forEach((x) => u.append(k, String(x)));
      else if (v != null) u.append(k, String(v));
    }
    const s = u.toString();
    return `/${clean}${s ? `?${s}` : ''}`;
  }
  let u = req.url && req.url !== '/' ? req.url : '/api';
  const pathOnly = u.split('?')[0] || '';
  if (pathOnly === '/api/__proxy' || pathOnly.endsWith('/__proxy')) {
    return '/api';
  }
  return u;
}

function getBackendOrigin() {
  const raw = (process.env.BACKEND_URL || process.env.VITE_API_URL || 'https://api.lwangblack.co').replace(/\/$/, '');
  return raw.replace(/\/api\/?$/i, '');
}

module.exports = async function vercelApiProxyHandler(req, res) {
  const BACKEND_URL = getBackendOrigin();
  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

  const origin = req.headers.origin || '';
  const allowedOrigin =
    CORS_ORIGIN === '*'
      ? '*'
      : CORS_ORIGIN.split(',').map((s) => s.trim()).includes(origin)
        ? origin
        : CORS_ORIGIN.split(',')[0];

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (allowedOrigin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const urlIn = resolveProxyUrlIn(req);
    const targetPath = normalizeProxyTargetPath(urlIn);
    const targetUrl = targetPath.startsWith('http') ? targetPath : `${BACKEND_URL}${targetPath}`;

    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
      if (Buffer.isBuffer(req.body)) body = req.body;
      else if (typeof req.body === 'object') body = JSON.stringify(req.body);
      else body = String(req.body);
    }

    const upstream = await forwardToBackend(targetUrl, req, body);

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const text = await upstream.text();
    return res.send(text);
  } catch (err) {
    console.error('[API Proxy]', err.message, err.code || '');
    return res.status(502).json({
      error: 'Backend unavailable. Please try again.',
      hint: 'Set BACKEND_URL on Vercel to your Render API origin (e.g. https://xxx.onrender.com).',
    });
  }
};
