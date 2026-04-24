// ── Australia Post PAC API Service ───────────────────────────────────────────
// Postage Assessment Calculator for domestic AU + international parcels.
// Register: https://developers.auspost.com.au/
//
// Required env:
//   AUSPOST_API_KEY — your AusPost developer API key

const fetch = require('node-fetch');
const dynConfig = require('./dynamic-config');

const AUSPOST_BASE = 'https://digitalapi.auspost.com.au';

async function getConfig() {
  const c = await dynConfig.getGatewayConfig('auspost');
  return {
    apiKey: c.apiKey || process.env.AUSPOST_API_KEY || '',
    // MyPost Business (Shipping & Tracking API) — required for real labels.
    accountNumber: c.accountNumber || process.env.AUSPOST_ACCOUNT_NUMBER || '',
    password: c.password || process.env.AUSPOST_PASSWORD || '',
  };
}

async function isConfigured() {
  const { apiKey } = await getConfig();
  return !!apiKey;
}

async function isLabelConfigured() {
  const { apiKey, accountNumber, password } = await getConfig();
  return !!(apiKey && accountNumber && password);
}

// ── Rate Calculation ─────────────────────────────────────────────────────────
async function getRates({ fromPostcode = '3000', toPostcode, toCountry, weightKg = 0.5, lengthCm = 22, widthCm = 15, heightCm = 8 }) {
  const cfg = await getConfig();
  if (!cfg.apiKey) return getDemoRates(toCountry);
  const isDomestic = !toCountry || toCountry === 'AU';

  try {
    let url;
    if (isDomestic) {
      url = `${AUSPOST_BASE}/postage/parcel/domestic/service.json?from_postcode=${fromPostcode}&to_postcode=${toPostcode || '2000'}&length=${lengthCm}&width=${widthCm}&height=${heightCm}&weight=${weightKg}`;
    } else {
      url = `${AUSPOST_BASE}/postage/parcel/international/service.json?country_code=${toCountry}&weight=${weightKg}`;
    }

    const res = await fetch(url, {
      headers: { 'AUTH-KEY': cfg.apiKey, 'Accept': 'application/json' },
      timeout: 10000,
    });

    if (!res.ok) throw new Error(`AusPost HTTP ${res.status}`);
    const data = await res.json();

    const services = data.services?.service || [];
    const rates = services.map(s => ({
      carrierId: 'auspost',
      carrier: 'Australia Post',
      service: s.name || 'Standard',
      serviceCode: s.code || '',
      price: parseFloat(s.price || '0'),
      currency: 'AUD',
      days: extractDays(s.delivery_time || s.name || ''),
      maxWeight: s.max_extra_cover ? `${weightKg}kg` : undefined,
    })).filter(r => r.price > 0).sort((a, b) => a.price - b.price);

    return rates.length ? rates : getDemoRates(toCountry);
  } catch (err) {
    console.error('[AusPost] getRates error:', err.message);
    return getDemoRates(toCountry);
  }
}

function extractDays(deliveryTime) {
  if (/express/i.test(deliveryTime)) return '1-3 days';
  if (/regular|standard/i.test(deliveryTime)) return '3-7 days';
  if (/economy/i.test(deliveryTime)) return '6-10 days';
  const m = deliveryTime.match(/(\d+)\s*-?\s*(\d+)?\s*(?:business\s+)?days?/i);
  if (m) return m[2] ? `${m[1]}-${m[2]} days` : `${m[1]} days`;
  return '5-8 days';
}

function getDemoRates(toCountry) {
  const isDomestic = !toCountry || toCountry === 'AU';
  if (isDomestic) {
    return [
      { carrierId: 'auspost', carrier: 'Australia Post', service: 'Regular Parcel', serviceCode: 'AUS_PARCEL_REGULAR', price: 9.95, currency: 'AUD', days: '3-7 days', demo: true },
      { carrierId: 'auspost', carrier: 'Australia Post', service: 'Express Post', serviceCode: 'AUS_PARCEL_EXPRESS', price: 16.50, currency: 'AUD', days: '1-3 days', demo: true },
    ];
  }
  return [
    { carrierId: 'auspost', carrier: 'Australia Post', service: 'International Standard', serviceCode: 'INT_PARCEL_STD_OWN_PACKAGING', price: 24.95, currency: 'AUD', days: '6-10 days', demo: true },
    { carrierId: 'auspost', carrier: 'Australia Post', service: 'International Express', serviceCode: 'INT_PARCEL_EXP_OWN_PACKAGING', price: 42.50, currency: 'AUD', days: '2-4 days', demo: true },
  ];
}

// ── Tracking ─────────────────────────────────────────────────────────────────
async function trackShipment(trackingNumber) {
  const cfg = await getConfig();
  if (!cfg.apiKey) return getDemoTracking(trackingNumber);
  try {
    const res = await fetch(`${AUSPOST_BASE}/shipping/v1/track?tracking_ids=${trackingNumber}`, {
      headers: { 'AUTH-KEY': cfg.apiKey, 'Accept': 'application/json' },
      timeout: 10000,
    });

    if (!res.ok) throw new Error(`AusPost track HTTP ${res.status}`);
    const data = await res.json();

    const item = data.tracking_results?.[0];
    if (!item || item.errors?.length) return getDemoTracking(trackingNumber);

    const events = (item.trackable_items?.[0]?.events || []).map(e => ({
      time: e.date || '',
      description: e.description || '',
      location: e.location || '',
    }));

    const latest = events[0] || {};
    return {
      number: trackingNumber,
      carrier: 'Australia Post',
      status: mapStatus(item.trackable_items?.[0]?.status || ''),
      description: latest.description || 'Tracking in progress',
      location: latest.location || '',
      estimatedDelivery: null,
      events,
      demo: false,
    };
  } catch (err) {
    console.error('[AusPost] trackShipment error:', err.message);
    return getDemoTracking(trackingNumber);
  }
}

function mapStatus(status) {
  const s = (status || '').toUpperCase();
  if (s.includes('DELIVERED')) return 'delivered';
  if (s.includes('TRANSIT') || s.includes('IN TRANSIT')) return 'in_transit';
  if (s.includes('ARRIVED')) return 'in_transit';
  if (s.includes('COLLECTED') || s.includes('PICKED')) return 'picked_up';
  return 'pending';
}

function getDemoTracking(trackingNumber) {
  return {
    number: trackingNumber,
    carrier: 'Australia Post',
    status: 'in_transit',
    description: 'Your parcel is in transit',
    location: 'Melbourne VIC',
    estimatedDelivery: new Date(Date.now() + 4 * 86400000).toISOString(),
    demo: true,
    events: [
      { time: new Date().toISOString(), description: 'In transit', location: 'Melbourne VIC' },
      { time: new Date(Date.now() - 86400000).toISOString(), description: 'Departed facility', location: 'Sydney NSW' },
      { time: new Date(Date.now() - 2 * 86400000).toISOString(), description: 'Shipment lodged', location: 'Lwang Black Warehouse' },
    ],
  };
}

// ── Label (MyPost Business — Shipping & Tracking API) ───────────────────────
// Docs: https://developers.auspost.com.au/apis/shipping-and-tracking
// Flow:
//   1. POST /shipping/v1/shipments      — create shipment with items[]
//   2. POST /shipping/v1/labels         — request label PDF for shipment
//   3. GET  /shipping/v1/labels/{id}    — poll until status=COMPLETED
//   4. fetch label PDF URL, base64 encode for storage / rendering
// Auth is HTTP Basic (accountNumber:password) with the AUTH-KEY header.
async function generateLabel({
  orderId,
  fromAddress = {},
  toAddress = {},
  weightKg = 0.5,
  lengthCm = 22,
  widthCm = 15,
  heightCm = 8,
  serviceCode = 'AUS_PARCEL_REGULAR',
}) {
  const cfg = await getConfig();
  if (!cfg.apiKey || !cfg.accountNumber || !cfg.password) {
    // Without MyPost Business credentials we cannot call the real API.
    // Surface a clear, actionable error to the admin caller.
    const err = new Error('AusPost MyPost Business not configured — set AUSPOST_API_KEY, AUSPOST_ACCOUNT_NUMBER, AUSPOST_PASSWORD');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const basicAuth = 'Basic ' + Buffer.from(`${cfg.accountNumber}:${cfg.password}`).toString('base64');
  const authHeaders = {
    'AUTH-KEY': cfg.apiKey,
    'Authorization': basicAuth,
    'Account-Number': cfg.accountNumber,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const isDomestic = !toAddress.country || (toAddress.country || '').toUpperCase() === 'AU';

  // ── Step 1: create shipment ─────────────────────────────────────────────
  const shipmentBody = {
    shipments: [{
      shipment_reference: orderId || `ORD-${Date.now()}`,
      customer_reference_1: orderId || '',
      sender_references: [orderId || 'LwangBlack'],
      from: {
        name: fromAddress.name || 'Lwang Black',
        lines: [fromAddress.line1 || fromAddress.street || ''].concat(fromAddress.line2 ? [fromAddress.line2] : []),
        suburb: fromAddress.city || fromAddress.suburb || '',
        state: fromAddress.state || '',
        postcode: fromAddress.postcode || fromAddress.postal || '3000',
        country: (fromAddress.country || 'AU').toUpperCase(),
        phone: fromAddress.phone || '',
        email: fromAddress.email || '',
      },
      to: {
        name: toAddress.name || '',
        lines: [toAddress.line1 || toAddress.street || ''].concat(toAddress.line2 ? [toAddress.line2] : []),
        suburb: toAddress.city || toAddress.suburb || '',
        state: toAddress.state || '',
        postcode: toAddress.postcode || toAddress.postal || '',
        country: (toAddress.country || 'AU').toUpperCase(),
        phone: toAddress.phone || '',
        email: toAddress.email || '',
      },
      items: [{
        item_reference: orderId || '',
        product_id: serviceCode,
        length: lengthCm,
        width: widthCm,
        height: heightCm,
        weight: weightKg,
        authority_to_leave: false,
        allow_partial_delivery: true,
        features: {
          TRANSIT_COVER: { attributes: { cover_amount: 100 } },
        },
      }],
    }],
  };

  let shipmentRes, shipmentData;
  try {
    shipmentRes = await fetch(`${AUSPOST_BASE}/shipping/v1/shipments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(shipmentBody),
      timeout: 15000,
    });
    shipmentData = await shipmentRes.json();
  } catch (err) {
    throw new Error(`AusPost shipment create network error: ${err.message}`);
  }
  if (!shipmentRes.ok || !shipmentData.shipments?.length) {
    const detail = shipmentData.errors?.[0]?.message || JSON.stringify(shipmentData).slice(0, 300);
    throw new Error(`AusPost shipment create failed: ${detail}`);
  }
  const shipment = shipmentData.shipments[0];
  const shipmentId = shipment.shipment_id;
  const trackingNumber = shipment.items?.[0]?.tracking_details?.article_id
    || shipment.items?.[0]?.item_id
    || shipmentId;
  const postage = parseFloat(shipment.shipment_summary?.total_cost || shipment.items?.[0]?.item_summary?.total_cost || '0') || null;

  // ── Step 2: request label PDF ───────────────────────────────────────────
  const labelBody = {
    wait_for_label_url: true,
    preferences: [{
      type: 'PRINT',
      format: 'PDF',
      groups: [{ group: 'Parcel Post', layout: 'A4-1pp', branded: true, left_offset: 0, top_offset: 0 }],
    }],
    shipments: [{ shipment_id: shipmentId }],
  };

  let labelRes, labelData;
  try {
    labelRes = await fetch(`${AUSPOST_BASE}/shipping/v1/labels`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(labelBody),
      timeout: 15000,
    });
    labelData = await labelRes.json();
  } catch (err) {
    throw new Error(`AusPost label request network error: ${err.message}`);
  }
  if (!labelRes.ok || !labelData.labels?.length) {
    const detail = labelData.errors?.[0]?.message || JSON.stringify(labelData).slice(0, 300);
    throw new Error(`AusPost label request failed: ${detail}`);
  }
  const label = labelData.labels[0];
  const requestId = label.request_id;
  let labelUrl = label.url || null;

  // ── Step 3: poll if not immediately ready ───────────────────────────────
  if (!labelUrl && requestId) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const pollRes = await fetch(`${AUSPOST_BASE}/shipping/v1/labels/${requestId}`, {
          headers: authHeaders,
          timeout: 10000,
        });
        const pollData = await pollRes.json();
        const entry = (pollData.labels || [])[0];
        if (entry?.status === 'COMPLETED' && entry.url) {
          labelUrl = entry.url;
          break;
        }
        if (entry?.status === 'FAILED') {
          throw new Error(`AusPost label generation failed: ${entry.error_messages?.join(', ') || 'unknown'}`);
        }
      } catch (err) {
        // continue polling; final throw below if still no URL
        if (i === 9) throw err;
      }
    }
  }

  // ── Step 4: fetch PDF and base64 encode (best effort) ───────────────────
  let labelBase64 = null;
  if (labelUrl) {
    try {
      const pdfRes = await fetch(labelUrl, { timeout: 15000 });
      if (pdfRes.ok) {
        const buf = Buffer.from(await pdfRes.arrayBuffer());
        labelBase64 = buf.toString('base64');
      }
    } catch (err) {
      console.error('[AusPost] label PDF download failed:', err.message);
    }
  }

  return {
    trackingNumber,
    labelBase64,
    labelUrl,
    postage,
    serviceType: serviceCode,
    carrier: 'Australia Post',
    shipmentId,
    demo: false,
  };
}

module.exports = { isConfigured, isLabelConfigured, getRates, trackShipment, generateLabel, getDemoRates, getDemoTracking };
