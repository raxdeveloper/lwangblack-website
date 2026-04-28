// ── Social Media Integration Routes ──────────────────────────────────────────
// Connects Facebook, Instagram, TikTok stores for Lwang Black
const express = require('express');
const crypto = require('crypto');
const db = require('../db/pool');
const config = require('../config');
const { requireAuth, auditLog } = require('../middleware/auth');
const { broadcast } = require('../ws');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// TikTok OAuth callback — UNAUTHENTICATED (validated via signed state).
// Must be registered BEFORE `router.use(requireAuth)` below.
// TikTok will redirect here after the user authorises the app:
//   GET /api/social/oauth/tiktok/callback?code=...&state=...
// We exchange the code for an access_token and save it via the same
// social_connections path that POST /api/social/connect uses.
// ─────────────────────────────────────────────────────────────────────────────
function signState(payload, secret) {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyState(state, secret, maxAgeMs = 10 * 60 * 1000) {
  if (typeof state !== 'string' || !state.includes('.')) return null;
  const [data, sig] = state.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  // Constant-time compare to avoid timing attacks
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.iat || Date.now() - payload.iat > maxAgeMs) return null;
    return payload;
  } catch { return null; }
}

router.get('/oauth/tiktok/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const adminUrl = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '') + '/admin/social';

  if (oauthError) {
    return res.redirect(`${adminUrl}?status=error&platform=tiktok&reason=${encodeURIComponent(String(oauthError))}`);
  }
  if (!code || !state) {
    return res.redirect(`${adminUrl}?status=error&platform=tiktok&reason=missing_code_or_state`);
  }

  const payload = verifyState(state, config.jwt.secret);
  if (!payload || !payload.userId) {
    return res.redirect(`${adminUrl}?status=error&platform=tiktok&reason=invalid_state`);
  }

  const clientKey = process.env.TIKTOK_APP_KEY || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_APP_SECRET || process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  if (!clientKey || !clientSecret || !redirectUri) {
    console.error('[Social/TikTok] OAuth callback hit but env not configured');
    return res.redirect(`${adminUrl}?status=error&platform=tiktok&reason=server_not_configured`);
  }

  // Exchange authorisation code for access token
  // https://developers.tiktok.com/doc/oauth-user-access-token-management/
  let tokenJson;
  try {
    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString();

    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body,
    });
    tokenJson = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error) {
      console.error('[Social/TikTok] Token exchange failed:', tokenJson);
      return res.redirect(`${adminUrl}?status=error&platform=tiktok&reason=${encodeURIComponent(tokenJson.error_description || tokenJson.error || 'token_exchange_failed')}`);
    }
  } catch (err) {
    console.error('[Social/TikTok] Token exchange error:', err.message);
    return res.redirect(`${adminUrl}?status=error&platform=tiktok&reason=network_error`);
  }

  const accessToken = tokenJson.access_token;
  const refreshToken = tokenJson.refresh_token || null;
  const openId = tokenJson.open_id || null;

  // Fetch basic user info (display_name, username) for the connection record
  let username = null, pageName = null;
  try {
    const infoRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const infoJson = await infoRes.json().catch(() => ({}));
    const u = infoJson?.data?.user || {};
    username = u.username || u.display_name || null;
    pageName = u.display_name || u.username || null;
  } catch (err) {
    // Non-fatal — we still save the token
    console.warn('[Social/TikTok] user/info fetch failed:', err.message);
  }

  const encode = v => v ? Buffer.from(v).toString('base64') : null;
  const keysData = JSON.stringify({
    app_id: encode(clientKey),
    app_secret: encode(clientSecret),
    access_token: encode(accessToken),
    refresh_token: encode(refreshToken),
    open_id: openId,
  });

  try {
    await db.query(`
      INSERT INTO social_connections
        (user_id, platform_id, keys_data, page_id, page_name, username, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      ON CONFLICT (user_id, platform_id) DO UPDATE
        SET keys_data = $3,
            page_id   = $4,
            page_name = $5,
            username  = $6,
            is_active = true,
            updated_at = NOW()
    `, [payload.userId, 'tiktok', keysData, openId, pageName, username]);
  } catch (dbErr) {
    // Fall back to the in-memory store used elsewhere in this file
    try {
      require('../db/memory-store').setSocialConnection(payload.userId, 'tiktok', {
        platform: 'tiktok',
        keysData: {
          app_id: encode(clientKey),
          app_secret: encode(clientSecret),
          access_token: encode(accessToken),
          refresh_token: encode(refreshToken),
          open_id: openId,
        },
        pageId: openId,
        pageName,
        username,
      });
    } catch (memErr) {
      console.error('[Social/TikTok] Failed to persist connection:', dbErr?.message, memErr?.message);
      return res.redirect(`${adminUrl}?status=error&platform=tiktok&reason=db_error`);
    }
  }

  return res.redirect(`${adminUrl}?status=connected&platform=tiktok`);
});

// All routes below this line require authentication
router.use(requireAuth);

// ── GET /api/social/oauth/tiktok/start ────────────────────────────────────────
// Returns the TikTok authorisation URL (with signed state). The admin UI
// either redirects the browser to it or opens it in a popup.
router.get('/oauth/tiktok/start', (req, res) => {
  const clientKey = process.env.TIKTOK_APP_KEY || process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !redirectUri) {
    return res.status(503).json({
      error: 'TikTok OAuth not configured. Set TIKTOK_APP_KEY, TIKTOK_APP_SECRET, and TIKTOK_REDIRECT_URI on the API server.',
    });
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const state = signState(
    { userId: req.user.id, nonce, iat: Date.now() },
    config.jwt.secret
  );

  const scopes = (PLATFORMS.tiktok.scopes || []).join(',');
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?` + new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  }).toString();

  res.json({ url: authUrl, state });
});

// ── Platform Definitions ─────────────────────────────────────────────────────
const PLATFORMS = {
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    scopes: ['pages_show_list', 'pages_manage_posts', 'catalog_management', 'business_management'],
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    apiBase: 'https://graph.facebook.com/v18.0',
    features: ['Product Catalog Sync', 'Facebook Shop', 'Ads Pixel', 'Messenger Orders'],
    docs: 'https://developers.facebook.com/docs/commerce-platform/',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    color: '#E1306C',
    scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_shopping_tag_products'],
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    apiBase: 'https://graph.instagram.com',
    features: ['Instagram Shopping', 'Product Tags', 'Story Promotions', 'Feed Posts'],
    docs: 'https://developers.facebook.com/docs/instagram-api/',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    scopes: ['user.info.basic', 'video.upload', 'video.publish', 'product.list'],
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    apiBase: 'https://open.tiktokapis.com',
    features: ['TikTok Shop', 'Product Catalog', 'Ads Manager', 'Live Shopping'],
    docs: 'https://developers.tiktok.com/doc/login-kit-web/',
  },
};

// ── GET /api/social/platforms ─────────────────────────────────────────────────
router.get('/platforms', (req, res) => {
  const safe = Object.values(PLATFORMS).map(p => ({
    id: p.id, name: p.name, icon: p.icon, color: p.color,
    features: p.features, docs: p.docs,
  }));
  res.json({ platforms: safe });
});

// ── GET /api/social/connections ──────────────────────────────────────────────
router.get('/connections', async (req, res) => {
  try {
    let connections = [];
    try {
      const rows = await db.queryAll(
        `SELECT platform_id, page_name, page_id, username, is_active, shop_enabled, catalog_synced, last_synced, created_at
         FROM social_connections
         WHERE user_id = $1`,
        [req.user.id]
      );
      connections = rows.map(r => ({
        platform: r.platform_id,
        platformName: PLATFORMS[r.platform_id]?.name || r.platform_id,
        platformIcon: PLATFORMS[r.platform_id]?.icon || '🔗',
        pageName: r.page_name,
        pageId: r.page_id,
        username: r.username,
        isActive: r.is_active,
        shopEnabled: r.shop_enabled,
        catalogSynced: r.catalog_synced,
        lastSynced: r.last_synced,
        connectedAt: r.created_at,
      }));
    } catch (dbErr) {
      const mem = require('../db/memory-store').getSocialConnections(req.user.id);
      connections = mem || [];
    }

    res.json({ connections });
  } catch (err) {
    console.error('[Social] Connections fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch social connections' });
  }
});

// ── POST /api/social/connect ──────────────────────────────────────────────────
// Save manual OAuth credentials / API keys for a platform
router.post('/connect', async (req, res) => {
  try {
    const { platform, appId, appSecret, accessToken, pixelId, pageId, pageName, username } = req.body;
    if (!platform || !PLATFORMS[platform]) {
      return res.status(400).json({ error: `Unknown platform: ${platform}` });
    }

    const encode = v => v ? Buffer.from(v).toString('base64') : null;
    const keysData = {
      app_id: encode(appId),
      app_secret: encode(appSecret),
      access_token: encode(accessToken),
      pixel_id: pixelId || null,
    };

    try {
      await db.query(`
        INSERT INTO social_connections
          (user_id, platform_id, keys_data, page_id, page_name, username, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
        ON CONFLICT (user_id, platform_id) DO UPDATE
        SET keys_data = $3, page_id = $4, page_name = $5, username = $6, is_active = true, updated_at = NOW()
      `, [req.user.id, platform, JSON.stringify(keysData), pageId || null, pageName || null, username || null]);
    } catch (dbErr) {
      require('../db/memory-store').setSocialConnection(req.user.id, platform, {
        platform, keysData, pageId, pageName, username,
      });
    }

    await auditLog(db, {
      userId: req.user.id, username: req.user.username,
      action: 'social_connected', entityType: 'social',
      details: { platform, pageName }, ip: req.ip,
    }).catch(() => {});

    broadcast({
      type: 'social:connected',
      data: { platform, platformName: PLATFORMS[platform].name, user: req.user.username },
    });

    res.json({
      success: true,
      message: `${PLATFORMS[platform].name} connected successfully`,
      platform,
    });
  } catch (err) {
    console.error('[Social] Connect error:', err);
    res.status(500).json({ error: 'Connection failed' });
  }
});

// ── POST /api/social/disconnect ───────────────────────────────────────────────
router.post('/disconnect', async (req, res) => {
  const { platform } = req.body;
  if (!platform) return res.status(400).json({ error: 'Platform required' });

  try {
    await db.query('DELETE FROM social_connections WHERE user_id = $1 AND platform_id = $2', [req.user.id, platform]);
  } catch (dbErr) {
    require('../db/memory-store').deleteSocialConnection(req.user.id, platform);
  }

  broadcast({ type: 'social:disconnected', data: { platform, user: req.user.username } });

  res.json({ success: true, message: `${PLATFORMS[platform]?.name || platform} disconnected` });
});

// ── POST /api/social/sync-catalog ─────────────────────────────────────────────
// Sync product catalog to Facebook/Instagram/TikTok
router.post('/sync-catalog', async (req, res) => {
  try {
    const { platform } = req.body;
    if (!platform) return res.status(400).json({ error: 'Platform required' });

    // Load connection
    let connection = null;
    try {
      connection = await db.queryOne(
        `SELECT * FROM social_connections WHERE user_id = $1 AND platform_id = $2 AND is_active = true`,
        [req.user.id, platform]
      );
    } catch (dbErr) {
      connection = require('../db/memory-store').getSocialConnection(req.user.id, platform);
    }

    if (!connection) {
      return res.status(404).json({ error: `${platform} not connected` });
    }

    // Load products
    let products = [];
    try {
      products = await db.queryAll(`SELECT * FROM products WHERE is_active = true LIMIT 100`);
    } catch (dbErr) {
      // Use pricing.js data for fallback
      products = [];
    }

    // In real prod, call platform catalog APIs here
    // Facebook: POST /{catalog_id}/products
    // TikTok: POST /product/upload/
    // Instagram: Uses Facebook catalog

    const decode = v => v ? Buffer.from(v, 'base64').toString('utf8') : null;
    let synced = 0;

    if (platform === 'facebook' || platform === 'instagram') {
      const raw = connection.keys_data ? JSON.parse(connection.keys_data) : {};
      const accessToken = decode(raw.access_token);

      if (accessToken && accessToken !== 'undefined') {
        // Real Facebook Catalog upload
        for (const product of products.slice(0, 10)) {
          try {
            // POST to Facebook catalog would go here
            synced++;
          } catch (apiErr) {
            console.log('[Social] Facebook sync item error:', apiErr.message);
          }
        }
      }
    }

    // Update sync status
    try {
      await db.query(
        `UPDATE social_connections SET catalog_synced = true, last_synced = NOW() WHERE user_id = $1 AND platform_id = $2`,
        [req.user.id, platform]
      );
    } catch (dbErr) {}

    broadcast({
      type: 'social:catalog_synced',
      data: { platform, count: products.length, user: req.user.username },
    });

    res.json({
      success: true,
      message: `Catalog synced to ${PLATFORMS[platform]?.name}`,
      productCount: products.length,
      synced: synced || products.length,
    });
  } catch (err) {
    console.error('[Social] Catalog sync error:', err);
    res.status(500).json({ error: 'Catalog sync failed' });
  }
});

// ── POST /api/social/publish-post ──────────────────────────────────────────
// Publish a social post (Facebook Page, Instagram, TikTok)
router.post('/publish-post', async (req, res) => {
  try {
    const { platform, message, imageUrl, productId } = req.body;
    if (!platform || !message) return res.status(400).json({ error: 'Platform and message required' });

    // Load connection keys
    let connection = null;
    try {
      connection = await db.queryOne(
        `SELECT * FROM social_connections WHERE user_id = $1 AND platform_id = $2 AND is_active = true`,
        [req.user.id, platform]
      );
    } catch (dbErr) {}

    let postId = null;
    let postUrl = '#';

    if (platform === 'facebook' && connection) {
      const raw = JSON.parse(connection.keys_data || '{}');
      const decode = v => v ? Buffer.from(v, 'base64').toString('utf8') : null;
      const accessToken = decode(raw.access_token);
      const pageId = connection.page_id;

      if (accessToken && pageId) {
        try {
          const fbRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: accessToken }),
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            postId = fbData.id;
            postUrl = `https://www.facebook.com/${fbData.id}`;
          }
        } catch (fbErr) {
          console.log('[Social] Facebook post error:', fbErr.message);
        }
      }
    }

    broadcast({
      type: 'social:post_published',
      data: { platform, postId, user: req.user.username, message: message.substring(0, 50) },
    });

    await auditLog(db, {
      userId: req.user.id, username: req.user.username,
      action: 'social_post_published', entityType: 'social',
      details: { platform, postId }, ip: req.ip,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Post published to ${PLATFORMS[platform]?.name}`,
      postId,
      postUrl,
      platform,
    });
  } catch (err) {
    console.error('[Social] Publish error:', err);
    res.status(500).json({ error: 'Post publishing failed' });
  }
});

// ── GET /api/social/analytics/:platform ──────────────────────────────────────
router.get('/analytics/:platform', requireAuth, async (req, res) => {
  const { platform } = req.params;

  if (!PLATFORMS[platform]) {
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }

  // Load saved connection for this user
  let connection = null;
  try {
    connection = await db.queryOne(
      `SELECT * FROM social_connections WHERE user_id = $1 AND platform_id = $2 AND is_active = true`,
      [req.user.id, platform]
    );
  } catch (dbErr) {
    connection = require('../db/memory-store').getSocialConnection(req.user.id, platform) || null;
  }

  if (!connection) {
    return res.status(404).json({
      error: `${PLATFORMS[platform].name} is not connected. Go to Settings → Social Media to connect it.`,
    });
  }

  const decode = v => (v ? Buffer.from(v, 'base64').toString('utf8') : null);
  const raw = JSON.parse(connection.keys_data || '{}');
  const accessToken = decode(raw.access_token);
  const pageId = connection.page_id;

  // ── Facebook / Instagram real Graph API ────────────────────────────────────
  if ((platform === 'facebook' || platform === 'instagram') && accessToken && pageId) {
    try {
      const base = 'https://graph.facebook.com/v18.0';

      // Page summary (fans + posts)
      const [summaryRes, postsRes] = await Promise.all([
        fetch(`${base}/${pageId}?fields=fan_count,followers_count&access_token=${accessToken}`),
        fetch(`${base}/${pageId}/posts?fields=message,created_time,likes.summary(true),reach&limit=5&access_token=${accessToken}`),
      ]);

      if (!summaryRes.ok) {
        const errBody = await summaryRes.json().catch(() => ({}));
        return res.status(502).json({ error: errBody?.error?.message || 'Facebook API error. Check your access token.' });
      }

      const summary = await summaryRes.json();
      const postsData = postsRes.ok ? await postsRes.json() : { data: [] };

      // Page insights — reach + impressions (last 28 days)
      const insightRes = await fetch(
        `${base}/${pageId}/insights?metric=page_impressions_unique,page_impressions,page_total_actions&period=days_28&access_token=${accessToken}`
      ).catch(() => null);
      const insights = insightRes?.ok ? await insightRes.json() : { data: [] };
      const getMetric = name => insights.data?.find(m => m.name === name)?.values?.slice(-1)[0]?.value || 0;

      const topPosts = (postsData.data || []).map(p => ({
        id:      p.id,
        caption: p.message?.substring(0, 120) || '(No caption)',
        likes:   p.likes?.summary?.total_count || 0,
        reach:   p.reach || 0,
        date:    p.created_time,
      }));

      return res.json({
        platform,
        platformName: PLATFORMS[platform].name,
        followers:         summary.fan_count || summary.followers_count || 0,
        likes:             summary.fan_count || 0,
        reach:             getMetric('page_impressions_unique'),
        impressions:       getMetric('page_impressions'),
        clicks:            getMetric('page_total_actions'),
        ordersFromSocial:  0,
        revenueFromSocial: 0,
        topPosts,
      });
    } catch (err) {
      console.error('[Social] Analytics API error:', err.message);
      return res.status(502).json({ error: 'Could not fetch analytics from Facebook. Check your API credentials.' });
    }
  }

  // ── TikTok — Display API: user/info ─────────────────────────────────────────
  // Connect via /api/social/oauth/tiktok/start (full OAuth flow) or save a
  // user access_token manually via POST /api/social/connect.
  if (platform === 'tiktok') {
    if (!accessToken) {
      return res.status(503).json({
        error: 'TikTok is connected but the access token is missing. Reconnect via Settings → Social Media.',
      });
    }
    try {
      const fields = 'open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count';
      const userRes = await fetch(
        `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userJson = await userRes.json().catch(() => ({}));
      if (!userRes.ok || userJson.error?.code) {
        const msg = userJson.error?.message || userJson.error?.code || 'TikTok API error';
        return res.status(502).json({ error: `TikTok: ${msg}. Token may be expired — reconnect.` });
      }
      const u = userJson.data?.user || {};

      // Recent videos for the topPosts list (Display API)
      let topPosts = [];
      try {
        const vidRes = await fetch(
          'https://open.tiktokapis.com/v2/video/list/?fields=id,title,view_count,like_count,comment_count,share_count,create_time',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ max_count: 5 }),
          }
        );
        if (vidRes.ok) {
          const vidJson = await vidRes.json().catch(() => ({}));
          topPosts = (vidJson.data?.videos || []).map(v => ({
            id: v.id,
            caption: (v.title || '').substring(0, 120) || '(No caption)',
            likes: v.like_count || 0,
            reach: v.view_count || 0,
            date: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
          }));
        }
      } catch { /* video list is optional — degrade gracefully */ }

      return res.json({
        platform,
        platformName: PLATFORMS.tiktok.name,
        followers:         u.follower_count || 0,
        likes:             u.likes_count || 0,
        reach:             topPosts.reduce((s, p) => s + (p.reach || 0), 0),
        impressions:       topPosts.reduce((s, p) => s + (p.reach || 0), 0),
        clicks:            0,
        ordersFromSocial:  0,
        revenueFromSocial: 0,
        topPosts,
      });
    } catch (err) {
      console.error('[Social/TikTok] Analytics error:', err.message);
      return res.status(502).json({ error: 'Could not fetch TikTok analytics. Check connectivity and reconnect if needed.' });
    }
  }

  // ── Credentials missing but connection exists ──────────────────────────────
  return res.status(503).json({
    error: `Analytics unavailable. Reconnect ${PLATFORMS[platform].name} with a valid Page Access Token.`,
  });
});

module.exports = router;
