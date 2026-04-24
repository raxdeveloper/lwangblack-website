// ── NZ Post Shipping API Service ─────────────────────────────────────────────
// NZ Post Parcel & Tracking API integration.
// Register: https://www.nzpost.co.nz/business/developer-centre
//
// Required env:
//   NZPOST_API_KEY   — NZ Post developer API key
//   NZPOST_CLIENT_ID — OAuth2 client ID (for shipping API)

const fetch = require('node-fetch');
const dynConfig = require('./dynamic-config');

const NZPOST_BASE = 'https://api.nzpost.co.nz';

async function getConfig() {
  const c = await dynConfig.getGatewayConfig('nzpost');
  return {
    apiKey:       c.apiKey       || process.env.NZPOST_API_KEY || '',
    clientId:     c.clientId     || process.env.NZPOST_CLIENT_ID || '',
    clientSecret: c.clientSecret || process.env.NZPOST_CLIENT_SECRET || '',
    siteCode:     c.siteCode     || process.env.NZPOST_SITE_CODE || '',
  };
}

async function isConfigured() {
  const { apiKey } = await getConfig();
  return !!apiKey;
}

async function isLabelConfigured() {
  const { clientId, clientSecret, siteCode } = await getConfig();
  return !!(clientId && clientSecret && siteCode);
}

// OAuth2 client_credentials token — cached in memory for its TTL.
let _cachedToken = null;
let _tokenExpiresAt = 0;
async function getOAuthToken() {
  const { clientId, clientSecret } = await getConfig();
  if (!clientId || !clientSecret) {
    const err = new Error('NZ Post OAuth not configured — set NZPOST_CLIENT_ID, NZPOST_CLIENT_SECRET');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  if (_cachedToken && Date.now() < _tokenExpiresAt - 30000) return _cachedToken;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'parceladdress parcellabel',
  });
  const res = await fetch(`${NZPOST_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: body.toString(),
    timeout: 10000,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`NZ Post OAuth failed: ${data.error_description || JSON.stringify(data)}`);
  }
  _cachedToken = data.access_token;
  _tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
  return _cachedToken;
}

// ── Rate Calculation ─────────────────────────────────────────────────────────
async function getRates({ toCountry, toPostcode, fromPostcode = '1010', weightKg = 0.5, lengthCm = 22, widthCm = 15, heightCm = 8 }) {
  const cfg = await getConfig();
  if (!cfg.apiKey) return getDemoRates(toCountry);
  const isDomestic = !toCountry || toCountry === 'NZ';

  try {
    let url;
    if (isDomestic) {
      url = `${NZPOST_BASE}/parcelrate/v2/domestic/rate?weight=${weightKg}&length=${lengthCm}&width=${widthCm}&height=${heightCm}`;
    } else {
      url = `${NZPOST_BASE}/parcelrate/v2/international/rate?country_code=${toCountry}&weight=${weightKg}&length=${lengthCm}&width=${widthCm}&height=${heightCm}`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Accept': 'application/json' },
      timeout: 10000,
    });

    if (!res.ok) throw new Error(`NZ Post HTTP ${res.status}`);
    const data = await res.json();

    const services = data.services || data.rates || [];
    const rates = services.map(s => ({
      carrierId: 'nzpost',
      carrier: 'NZ Post',
      service: s.service_name || s.name || 'Standard',
      serviceCode: s.service_code || '',
      price: parseFloat(s.price_including_gst || s.price || '0'),
      currency: 'NZD',
      days: s.delivery_days || extractDays(s.service_name || ''),
    })).filter(r => r.price > 0).sort((a, b) => a.price - b.price);

    return rates.length ? rates : getDemoRates(toCountry);
  } catch (err) {
    console.error('[NZPost] getRates error:', err.message);
    return getDemoRates(toCountry);
  }
}

function extractDays(name) {
  if (/express|overnight/i.test(name)) return '1-2 days';
  if (/fast|courier/i.test(name)) return '2-3 days';
  if (/economy/i.test(name)) return '7-14 days';
  return '3-7 days';
}

function getDemoRates(toCountry) {
  const isDomestic = !toCountry || toCountry === 'NZ';
  if (isDomestic) {
    return [
      { carrierId: 'nzpost', carrier: 'NZ Post', service: 'ParcelPost Standard', serviceCode: 'PPOST_STD', price: 7.50, currency: 'NZD', days: '3-5 days', demo: true },
      { carrierId: 'nzpost', carrier: 'NZ Post', service: 'CourierPost', serviceCode: 'CPOST', price: 12.99, currency: 'NZD', days: '1-2 days', demo: true },
    ];
  }
  return [
    { carrierId: 'nzpost', carrier: 'NZ Post', service: 'International Air', serviceCode: 'INT_AIR', price: 22.50, currency: 'NZD', days: '5-10 days', demo: true },
    { carrierId: 'nzpost', carrier: 'NZ Post', service: 'International Express', serviceCode: 'INT_EXP', price: 38.99, currency: 'NZD', days: '3-5 days', demo: true },
    { carrierId: 'nzpost', carrier: 'NZ Post', service: 'International Economy', serviceCode: 'INT_ECO', price: 14.50, currency: 'NZD', days: '10-25 days', demo: true },
  ];
}

// ── Tracking ─────────────────────────────────────────────────────────────────
async function trackShipment(trackingNumber) {
  const cfg = await getConfig();
  if (!cfg.apiKey) return getDemoTracking(trackingNumber);
  try {
    const res = await fetch(`${NZPOST_BASE}/tracking/v2/parcels/${trackingNumber}`, {
      headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Accept': 'application/json' },
      timeout: 10000,
    });

    if (!res.ok) throw new Error(`NZ Post track HTTP ${res.status}`);
    const data = await res.json();

    const parcel = data.results?.[0] || data;
    const events = (parcel.tracking_events || parcel.events || []).map(e => ({
      time: e.event_datetime || e.date || '',
      description: e.event_description || e.description || '',
      location: e.event_location || e.location || '',
    }));

    return {
      number: trackingNumber,
      carrier: 'NZ Post',
      status: mapStatus(parcel.status || events[0]?.description || ''),
      description: events[0]?.description || 'Tracking in progress',
      location: events[0]?.location || '',
      estimatedDelivery: parcel.estimated_delivery || null,
      events,
      demo: false,
    };
  } catch (err) {
    console.error('[NZPost] trackShipment error:', err.message);
    return getDemoTracking(trackingNumber);
  }
}

function mapStatus(status) {
  const s = (status || '').toUpperCase();
  if (s.includes('DELIVERED')) return 'delivered';
  if (s.includes('TRANSIT') || s.includes('PROCESSING')) return 'in_transit';
  if (s.includes('OUT FOR DELIVERY')) return 'out_for_delivery';
  if (s.includes('PICKED') || s.includes('COLLECTED')) return 'picked_up';
  return 'pending';
}

function getDemoTracking(trackingNumber) {
  return {
    number: trackingNumber,
    carrier: 'NZ Post',
    status: 'in_transit',
    description: 'Your parcel is in transit',
    location: 'Auckland Sorting Centre',
    estimatedDelivery: new Date(Date.now() + 4 * 86400000).toISOString(),
    demo: true,
    events: [
      { time: new Date().toISOString(), description: 'In transit to destination', location: 'Auckland Sort Centre' },
      { time: new Date(Date.now() - 86400000).toISOString(), description: 'Processed at facility', location: 'Wellington Hub' },
      { time: new Date(Date.now() - 2 * 86400000).toISOString(), description: 'Shipment collected', location: 'Lwang Black Warehouse' },
    ],
  };
}

// ── Label Generation (eShip / Parcel Label API) ─────────────────────────────
// Docs: https://anypost.nzpost.co.nz/docs/parcellabel/v4
// Flow:
//   POST /parcellabel/v4/labels  with sender, receiver, parcel
//   Response contains consignment_number (tracking), ticket_number, label (base64 PDF).
async function generateLabel({
  orderId,
  fromAddress = {},
  toAddress = {},
  weightKg = 0.5,
  lengthCm = 22,
  widthCm = 15,
  heightCm = 8,
  serviceCode = 'CPOLP', // CourierPost Overnight Local Parcel (common default)
}) {
  const cfg = await getConfig();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.siteCode) {
    const err = new Error('NZ Post labels not configured — set NZPOST_CLIENT_ID, NZPOST_CLIENT_SECRET, NZPOST_SITE_CODE');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const token = await getOAuthToken();

  const body = {
    carrier: 'CourierPost',
    service_code: serviceCode,
    site_code: cfg.siteCode,
    sender: {
      name: fromAddress.name || 'Lwang Black',
      address1: fromAddress.line1 || fromAddress.street || '',
      address2: fromAddress.line2 || '',
      suburb: fromAddress.suburb || fromAddress.city || '',
      city: fromAddress.city || '',
      postcode: fromAddress.postcode || fromAddress.postal || '1010',
      country_code: (fromAddress.country || 'NZ').toUpperCase(),
      phone: fromAddress.phone || '',
      email: fromAddress.email || '',
    },
    receiver: {
      name: toAddress.name || '',
      address1: toAddress.line1 || toAddress.street || '',
      address2: toAddress.line2 || '',
      suburb: toAddress.suburb || toAddress.city || '',
      city: toAddress.city || '',
      postcode: toAddress.postcode || toAddress.postal || '',
      country_code: (toAddress.country || 'NZ').toUpperCase(),
      phone: toAddress.phone || '',
      email: toAddress.email || '',
    },
    parcels: [{
      weight: weightKg,
      length: lengthCm,
      width: widthCm,
      height: heightCm,
    }],
    references: { customer_reference: orderId || `ORD-${Date.now()}` },
  };

  let labelRes, labelData;
  try {
    labelRes = await fetch(`${NZPOST_BASE}/parcellabel/v4/labels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      timeout: 15000,
    });
    labelData = await labelRes.json();
  } catch (err) {
    throw new Error(`NZ Post label network error: ${err.message}`);
  }
  if (!labelRes.ok) {
    const detail = labelData.error_description || labelData.message || JSON.stringify(labelData).slice(0, 300);
    throw new Error(`NZ Post label failed: ${detail}`);
  }

  // Response shape varies across versions — pull the common fields.
  const consignment = labelData.consignment_number
    || labelData.tracking_reference
    || labelData.parcels?.[0]?.tracking_reference
    || labelData.ticket_number;
  const labelBase64 = labelData.label
    || labelData.labels?.[0]
    || labelData.parcels?.[0]?.label
    || null;

  if (!consignment) {
    throw new Error('NZ Post label response missing tracking / consignment number');
  }

  return {
    trackingNumber: consignment,
    labelBase64,
    labelUrl: labelData.label_url || null,
    postage: parseFloat(labelData.total_price || labelData.price || 0) || null,
    serviceType: serviceCode,
    carrier: 'NZ Post',
    ticketNumber: labelData.ticket_number || null,
    demo: false,
  };
}

module.exports = { isConfigured, isLabelConfigured, getRates, trackShipment, generateLabel, getDemoRates, getDemoTracking };
