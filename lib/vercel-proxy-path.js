'use strict';

/**
 * Vercel rewrites (`/api/:path*` → `/api/__proxy`) or legacy handlers often pass `req.url` WITHOUT the
 * `/api` prefix (e.g. `/auth/login` instead of `/api/auth/login`). The Express
 * backend mounts everything under `/api/...`, so we must normalize before proxying.
 */
function normalizeProxyTargetPath(reqUrl) {
  let raw = reqUrl;
  if (raw == null || raw === '') raw = '/';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      raw = u.pathname + u.search;
    } catch {
      raw = '/';
    }
  }
  if (!raw.startsWith('/')) raw = '/' + raw;

  const qIndex = raw.indexOf('?');
  let pathname = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const queryStr = qIndex >= 0 ? raw.slice(qIndex + 1) : '';

  let search = '';
  if (queryStr) {
    const params = new URLSearchParams(queryStr);
    // Vercel may inject dynamic segment params; do not forward these upstream
    ['path', 'path[]', 'slug', 'slug[]', 'catchAll', 'catchAll[]'].forEach((k) => {
      params.delete(k);
    });
    const rest = params.toString();
    search = rest ? `?${rest}` : '';
  }

  if (!pathname.startsWith('/api')) {
    pathname = '/api' + (pathname === '/' ? '' : pathname);
  } else if (pathname === '/api/__proxy' || pathname.startsWith('/api/__proxy/')) {
    pathname = '/api';
  }

  return pathname + search;
}

module.exports = { normalizeProxyTargetPath };
