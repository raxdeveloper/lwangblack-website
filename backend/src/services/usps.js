// ── USPS Web Tools Service ────────────────────────────────────────────────────
// Handles rate calculation, shipment tracking, and label generation via the
// USPS Web Tools API (XML-based). Register at:
//   https://registration.shippingapis.com/
//
// Required env / DB settings:
//   USPS_USER_ID   — your USPS Web Tools user ID
//   USPS_PASSWORD  — your USPS Web Tools password (some endpoints)
//   USPS_TEST_MODE — 'true' for sandbox (default in development)

const fetch = require('node-fetch');

const USPS_BASE_URL = 'https://secure.shippingapis.com/ShippingAPI.dll';
const USPS_TEST_URL = 'https://stg-secure.shippingapis.com/ShippingAPI.dll'; // staging

function getConfig() {
  return {
    userId:   process.env.USPS_USER_ID   || '',
    password: process.env.USPS_PASSWORD  || '',
    isLive:   process.env.USPS_TEST_MODE !== 'true' && process.env.NODE_ENV === 'production',
  };
}

function isConfigured() {
  const { userId } = getConfig();
  return !!userId && userId !== '';
}

// Escape XML special chars
function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Parse XML response (lightweight, no external deps)
function parseXml(xml) {
  const errors = xml.match(/<Error>([\s\S]*?)<\/Error>/i);
  if (errors) {
    const code = (xml.match(/<Number>([\s\S]*?)<\/Number>/i) || [])[1] || '';
    const desc = (xml.match(/<Description>([\s\S]*?)<\/Description>/i) || [])[1] || 'USPS error';
    throw new Error(`USPS ${code}: ${desc}`);
  }
  return xml;
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function extractAllTags(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

async function callUsps(apiName, xmlBody) {
  const cfg = getConfig();
  const url = cfg.isLive ? USPS_BASE_URL : USPS_TEST_URL;
  const response = await fetch(`${url}?API=${apiName}&XML=${encodeURIComponent(xmlBody)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/xml' },
    timeout: 10000,
  });
  if (!response.ok) throw new Error(`USPS HTTP ${response.status}`);
  const text = await response.text();
  parseXml(text); // throws on <Error>
  return text;
}

// ── Rate Calculation ─────────────────────────────────────────────────────────
// Returns USPS domestic rate options for a US-to-US shipment.
// For international, use RateV4 with international params.
async function getRates({ fromZip, toZip, weightLbs = 1, weightOz = 0, lengthIn = 12, widthIn = 8, heightIn = 4 }) {
  if (!isConfigured()) return getDemoRates();

  const cfg = getConfig();
  const ozTotal = Math.round(weightLbs * 16 + weightOz);
  const lbs = Math.floor(ozTotal / 16);
  const oz  = ozTotal % 16;

  const xml = `
<RateV4Request USERID="${xmlEscape(cfg.userId)}">
  <Revision>2</Revision>
  <Package ID="1">
    <Service>ALL</Service>
    <FirstClassMailType>PARCEL</FirstClassMailType>
    <ZipOrigination>${xmlEscape(fromZip || '10001')}</ZipOrigination>
    <ZipDestination>${xmlEscape(toZip)}</ZipDestination>
    <Pounds>${lbs}</Pounds>
    <Ounces>${oz}</Ounces>
    <Container/>
    <Width>${widthIn}</Width>
    <Length>${lengthIn}</Length>
    <Height>${heightIn}</Height>
    <Machinable>true</Machinable>
  </Package>
</RateV4Request>`.trim();

  try {
    const responseXml = await callUsps('RateV4', xml);
    const postageBlocks = extractAllTags(responseXml, 'Postage');

    const rates = postageBlocks.map(block => {
      const classId  = extractTag(block, 'MailService') || '';
      const rate     = parseFloat(extractTag(block, 'Rate') || '0');
      const commitment = extractTag(block, 'CommitmentName') || '';
      return { classId, rate, commitment };
    }).filter(r => r.rate > 0).map(r => ({
      carrierId:   'usps',
      carrier:     'USPS',
      service:     formatServiceName(r.classId),
      serviceCode: r.classId,
      price:       r.rate,
      currency:    'USD',
      days:        extractDays(r.classId, r.commitment),
    })).sort((a, b) => a.price - b.price);

    if (!rates.length) return getDemoRates();
    return rates;
  } catch (err) {
    console.error('[USPS] getRates error:', err.message);
    return getDemoRates();
  }
}

function formatServiceName(classId = '') {
  if (/PRIORITY_EXPRESS/i.test(classId) || /PRIORITY MAIL EXPRESS/i.test(classId)) return 'Priority Mail Express';
  if (/PRIORITY/i.test(classId)) return 'Priority Mail';
  if (/FIRST.CLASS/i.test(classId)) return 'First-Class Mail';
  if (/RETAIL.GROUND|PARCEL/i.test(classId)) return 'USPS Retail Ground';
  if (/MEDIA/i.test(classId)) return 'Media Mail';
  return classId.replace(/<[^>]+>/g, '').trim() || 'USPS Standard';
}

function extractDays(classId = '', commitment = '') {
  if (/EXPRESS/i.test(classId)) return '1-2 days';
  if (/PRIORITY/i.test(classId)) return '2-3 days';
  if (/FIRST.CLASS/i.test(classId)) return '1-5 days';
  return '2-8 days';
}

function getDemoRates() {
  return [
    { carrierId: 'usps', carrier: 'USPS', service: 'Priority Mail',         serviceCode: 'PRIORITY',         price: 8.70,  currency: 'USD', days: '2-3 days', demo: true },
    { carrierId: 'usps', carrier: 'USPS', service: 'Priority Mail Express', serviceCode: 'PRIORITY_EXPRESS', price: 26.35, currency: 'USD', days: '1-2 days', demo: true },
    { carrierId: 'usps', carrier: 'USPS', service: 'First-Class Mail',      serviceCode: 'FIRST_CLASS',      price: 4.50,  currency: 'USD', days: '1-5 days', demo: true },
    { carrierId: 'usps', carrier: 'USPS', service: 'USPS Retail Ground',    serviceCode: 'RETAIL_GROUND',    price: 7.25,  currency: 'USD', days: '2-8 days', demo: true },
  ];
}

// ── Tracking ─────────────────────────────────────────────────────────────────
async function trackShipment(trackingNumber) {
  if (!isConfigured()) {
    return getDemoTracking(trackingNumber);
  }

  const cfg = getConfig();
  const xml = `
<TrackFieldRequest USERID="${xmlEscape(cfg.userId)}">
  <Revision>1</Revision>
  <ClientIp>127.0.0.1</ClientIp>
  <TrackID ID="${xmlEscape(trackingNumber)}"/>
</TrackFieldRequest>`.trim();

  try {
    const responseXml = await callUsps('TrackV2', xml);

    const statusCategory = extractTag(responseXml, 'StatusCategory') || '';
    const status         = extractTag(responseXml, 'Status')         || 'Unknown';
    const statusSummary  = extractTag(responseXml, 'StatusSummary')  || '';
    const city           = extractTag(responseXml, 'EventCity')       || '';
    const state          = extractTag(responseXml, 'EventState')      || '';
    const eta            = extractTag(responseXml, 'PredictedDeliveryDate');

    // Extract event history
    const detailBlocks = extractAllTags(responseXml, 'TrackDetail');
    const events = detailBlocks.slice(0, 10).map(block => ({
      time:        extractTag(block, 'EventTime') || '',
      date:        extractTag(block, 'EventDate') || '',
      description: extractTag(block, 'Event')     || '',
      location:    [extractTag(block, 'EventCity'), extractTag(block, 'EventState')].filter(Boolean).join(', '),
    }));

    return {
      number:            trackingNumber,
      carrier:           'USPS',
      status:            mapStatus(statusCategory),
      description:       status || statusSummary,
      location:          [city, state].filter(Boolean).join(', '),
      estimatedDelivery: eta ? new Date(eta).toISOString() : null,
      events,
      demo: false,
    };
  } catch (err) {
    console.error('[USPS] trackShipment error:', err.message);
    return getDemoTracking(trackingNumber);
  }
}

function mapStatus(cat = '') {
  const c = cat.toUpperCase();
  if (c.includes('DELIVERED')) return 'delivered';
  if (c.includes('TRANSIT') || c.includes('IN TRANSIT')) return 'in_transit';
  if (c.includes('OUT FOR DELIVERY')) return 'out_for_delivery';
  if (c.includes('EXCEPTION') || c.includes('ALERT')) return 'exception';
  if (c.includes('ACCEPTANCE') || c.includes('PICKED')) return 'picked_up';
  return 'pending';
}

function getDemoTracking(trackingNumber) {
  return {
    number:            trackingNumber,
    carrier:           'USPS',
    status:            'in_transit',
    description:       'Your package is on its way',
    location:          'USPS Sort Facility, Los Angeles, CA',
    estimatedDelivery: new Date(Date.now() + 2 * 86400000).toISOString(),
    demo:              true,
    events: [
      { time: new Date().toISOString(),                    description: 'In Transit to Destination',        location: 'Los Angeles, CA' },
      { time: new Date(Date.now() - 86400000).toISOString(), description: 'Accepted at USPS Origin Facility', location: 'New York, NY' },
    ],
  };
}

// ── Label Generation (eVS domestic) ─────────────────────────────────────────
// Returns base64-encoded PDF label and assigned tracking number.
async function generateLabel({ fromAddress, toAddress, weightLbs = 1, weightOz = 0, serviceType = 'PRIORITY', orderId }) {
  if (!isConfigured()) {
    return getDemoLabel(orderId);
  }

  const cfg = getConfig();
  const ozTotal = Math.round(weightLbs * 16 + weightOz);
  const lbs = Math.floor(ozTotal / 16);
  const oz  = ozTotal % 16;

  const xml = `
<eVSRequest USERID="${xmlEscape(cfg.userId)}" PASSWORD="${xmlEscape(cfg.password)}">
  <Option/>
  <Revision>1</Revision>
  <ImageParameters/>
  <FromName>${xmlEscape(fromAddress.name || 'Lwang Black')}</FromName>
  <FromFirm/>
  <FromAddress1/>
  <FromAddress2>${xmlEscape(fromAddress.street || '')}</FromAddress2>
  <FromCity>${xmlEscape(fromAddress.city || '')}</FromCity>
  <FromState>${xmlEscape(fromAddress.state || '')}</FromState>
  <FromZip5>${xmlEscape((fromAddress.zip || '').substring(0, 5))}</FromZip5>
  <FromZip4/>
  <FromPhone>${xmlEscape((fromAddress.phone || '').replace(/\D/g, ''))}</FromPhone>
  <ToName>${xmlEscape(toAddress.name || '')}</ToName>
  <ToFirm/>
  <ToAddress1/>
  <ToAddress2>${xmlEscape(toAddress.street || '')}</ToAddress2>
  <ToCity>${xmlEscape(toAddress.city || '')}</ToCity>
  <ToState>${xmlEscape(toAddress.state || '')}</ToState>
  <ToZip5>${xmlEscape((toAddress.zip || '').substring(0, 5))}</ToZip5>
  <ToZip4/>
  <ToPhone>${xmlEscape((toAddress.phone || '').replace(/\D/g, ''))}</ToPhone>
  <WeightInOunces>${ozTotal}</WeightInOunces>
  <ServiceType>${xmlEscape(serviceType)}</ServiceType>
  <WaiverOfSignature/>
  <SeparateReceiptPage>false</SeparateReceiptPage>
  <POZipCode/>
  <ImageType>PDF</ImageType>
  <LabelDate/>
  <CustomerRefNo>${xmlEscape(orderId || '')}</CustomerRefNo>
  <SenderName>${xmlEscape(fromAddress.name || 'Lwang Black')}</SenderName>
  <SenderEMail/>
  <RecipientName>${xmlEscape(toAddress.name || '')}</RecipientName>
  <RecipientEMail/>
</eVSRequest>`.trim();

  try {
    const responseXml = await callUsps('eVS', xml);
    const trackingNumber = extractTag(responseXml, 'BarcodeNumber') || extractTag(responseXml, 'TrackingNumber');
    const labelB64       = extractTag(responseXml, 'LabelImage');
    const postage        = parseFloat(extractTag(responseXml, 'Postage') || '0');

    if (!trackingNumber) throw new Error('No tracking number in USPS label response');

    return {
      trackingNumber,
      labelBase64: labelB64,
      labelUrl:    null, // served from /invoices/labels/<trackingNumber>.pdf after save
      postage,
      serviceType,
      carrier: 'USPS',
      demo: false,
    };
  } catch (err) {
    console.error('[USPS] generateLabel error:', err.message);
    return getDemoLabel(orderId);
  }
}

function getDemoLabel(orderId) {
  const fakeTracking = `9400111899223${Date.now().toString().slice(-7)}`;
  return {
    trackingNumber: fakeTracking,
    labelBase64:    null,
    labelUrl:       null,
    postage:        8.70,
    serviceType:    'PRIORITY',
    carrier:        'USPS',
    demo:           true,
    message:        'Demo label — configure USPS_USER_ID in .env to generate real labels',
  };
}

// ── Address Validation ────────────────────────────────────────────────────────
async function validateAddress({ street, city, state, zip }) {
  if (!isConfigured()) return { valid: true, demo: true };

  const cfg = getConfig();
  const xml = `
<AddressValidateRequest USERID="${xmlEscape(cfg.userId)}">
  <Revision>1</Revision>
  <Address ID="0">
    <Address1/>
    <Address2>${xmlEscape(street)}</Address2>
    <City>${xmlEscape(city)}</City>
    <State>${xmlEscape(state)}</State>
    <Zip5>${xmlEscape((zip || '').substring(0, 5))}</Zip5>
    <Zip4/>
  </Address>
</AddressValidateRequest>`.trim();

  try {
    const responseXml = await callUsps('Verify', xml);
    const correctedCity   = extractTag(responseXml, 'City');
    const correctedState  = extractTag(responseXml, 'State');
    const correctedZip    = extractTag(responseXml, 'Zip5');
    const correctedStreet = extractTag(responseXml, 'Address2');
    const dpv             = extractTag(responseXml, 'DPVConfirmation');

    return {
      valid:    dpv === 'Y' || dpv === 'S',
      corrected: { street: correctedStreet, city: correctedCity, state: correctedState, zip: correctedZip },
      dpvCode:  dpv,
    };
  } catch (err) {
    return { valid: true, demo: true, error: err.message };
  }
}

module.exports = {
  isConfigured,
  getRates,
  trackShipment,
  generateLabel,
  validateAddress,
  getDemoRates,
  getDemoTracking,
};
