import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Tag, X, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';

/**
 * Unified shipping-label modal.
 *
 * Used from two places:
 *   1. Orders page → "Ship / Generate Label" on a specific order.
 *        Pass `orderId` + `defaultCountry`; the backend patches the order
 *        with tracking + status=shipped via /logistics/create-shipment.
 *   2. Logistics page → ad-hoc label runs (no order attached).
 *        Pass `orderId={null}` and the backend returns the label without
 *        touching any order row.
 *
 * Carriers wired:
 *   usps, auspost, nzpost, japanpost, chitchats, pathao
 *
 * Japan Post has no public label API — the admin pastes a tracking number
 * obtained from the counter, and the backend produces a printable PDF.
 *
 * "Manual shipment" mode is also exposed per-carrier: if the carrier's
 * label API fails (e.g. credentials missing) the admin can switch to
 * manual and enter the tracking number by hand.
 */

const CARRIER_OPTIONS = [
  { id: 'usps',      label: 'USPS',           flag: '🇺🇸', defaultCountry: 'US' },
  { id: 'auspost',   label: 'Australia Post', flag: '🇦🇺', defaultCountry: 'AU' },
  { id: 'nzpost',    label: 'NZ Post',        flag: '🇳🇿', defaultCountry: 'NZ' },
  { id: 'japanpost', label: 'Japan Post',     flag: '🇯🇵', defaultCountry: 'JP' },
  { id: 'chitchats', label: 'Chit Chats',     flag: '🇨🇦', defaultCountry: 'CA' },
  { id: 'pathao',    label: 'Pathao',         flag: '🇳🇵', defaultCountry: 'NP' },
];

const COUNTRY_TO_CARRIER = CARRIER_OPTIONS.reduce((acc, c) => {
  acc[c.defaultCountry] = c.id;
  return acc;
}, {});

const DEFAULT_SERVICE = {
  usps:      'PRIORITY',
  auspost:   'AUS_PARCEL_REGULAR',
  nzpost:    'CPOLP',
  japanpost: 'EMS',
  chitchats: 'chit_chats_us_select',
  pathao:    'Regular',
};

// Country → default weight units used by the label API.
const USES_IMPERIAL = new Set(['usps']);
const USES_GRAMS = new Set(['japanpost']);

function trackUrl(carrierId, tn) {
  if (!tn) return null;
  const t = encodeURIComponent(String(tn).trim());
  switch (carrierId) {
    case 'usps':      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'auspost':   return `https://auspost.com.au/mypost/track/#/details/${t}`;
    case 'nzpost':    return `https://www.nzpost.co.nz/tools/tracking?trackid=${t}`;
    case 'japanpost': return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${t}`;
    case 'chitchats': return `https://chitchats.com/tracking/${t}`;
    case 'pathao':    return `https://merchant.pathao.com/tracking?consignment_id=${t}`;
    default:          return `https://www.google.com/search?q=track+${t}`;
  }
}

export default function ShipModal({ orderId = null, defaultCountry = 'US', prefill = {}, onClose, onShipped }) {
  // Pick carrier from country hint (falls back to USPS).
  const initialCarrier = COUNTRY_TO_CARRIER[(defaultCountry || '').toUpperCase()] || 'usps';
  const [carrierId, setCarrierId] = useState(initialCarrier);
  const [manualMode, setManualMode] = useState(false);

  const [serviceCode, setServiceCode] = useState(DEFAULT_SERVICE[initialCarrier]);
  const [toName, setToName]     = useState(prefill.name     || '');
  const [toStreet, setToStreet] = useState(prefill.street   || '');
  const [toCity, setToCity]     = useState(prefill.city     || '');
  const [toState, setToState]   = useState(prefill.state    || '');
  const [toPostal, setToPostal] = useState(prefill.postal   || '');
  const [toCountry, setToCountry] = useState((prefill.country || defaultCountry || 'US').toUpperCase());
  const [toPhone, setToPhone]   = useState(prefill.phone    || '');

  // Weights — keep both unit sets so we can flip carriers without re-typing.
  const [weightLbs, setWeightLbs]     = useState('1');
  const [weightKg, setWeightKg]       = useState('0.5');
  const [weightGrams, setWeightGrams] = useState('500');

  // Manual-mode fields.
  const [manualTracking, setManualTracking] = useState('');
  const [manualService, setManualService]   = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  const pickedCarrier = useMemo(() => CARRIER_OPTIONS.find(c => c.id === carrierId), [carrierId]);

  // When carrier changes, reset service code + weight defaults.
  const switchCarrier = (id) => {
    setCarrierId(id);
    setServiceCode(DEFAULT_SERVICE[id]);
    setError(null);
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      let data;
      if (manualMode) {
        // /logistics/manual-shipment — no carrier API call, admin-entered tracking.
        if (!orderId) throw new Error('Manual shipment requires an order — open from the Orders page.');
        if (!manualTracking.trim()) throw new Error('Tracking number is required.');
        data = await apiFetch('/logistics/manual-shipment', {
          method: 'POST',
          body: {
            orderId,
            carrierId,
            trackingNumber: manualTracking.trim(),
            serviceLabel: manualService || serviceCode,
          },
        });
      } else {
        // /logistics/create-shipment — calls the real carrier API.
        const body = {
          orderId,
          carrierId,
          serviceCode,
          toAddress: {
            name: toName, street: toStreet, line1: toStreet,
            city: toCity, state: toState,
            postal: toPostal, postcode: toPostal, zip: toPostal,
            country: toCountry, phone: toPhone,
          },
          fromAddress: prefill.fromAddress || {},
        };
        if (USES_IMPERIAL.has(carrierId)) {
          body.weightLbs = parseFloat(weightLbs) || 1;
          body.weightOz = 0;
        } else if (USES_GRAMS.has(carrierId)) {
          body.weightGrams = parseFloat(weightGrams) || 500;
        } else {
          body.weightKg = parseFloat(weightKg) || 0.5;
        }
        // Japan Post: admin must supply tracking number up front.
        if (carrierId === 'japanpost') {
          if (!manualTracking.trim()) {
            throw new Error('Japan Post requires a tracking number from the JP Post counter.');
          }
          body.trackingNumber = manualTracking.trim();
        }

        const endpoint = carrierId === 'usps' && orderId
          ? '/logistics/usps/label' // already patches order; kept for backward compatibility
          : '/logistics/create-shipment';
        data = await apiFetch(endpoint, { method: 'POST', body });
      }
      setResult(data);
      onShipped?.(data);
    } catch (e) {
      setError(e.message || 'Shipment failed');
    } finally {
      setSubmitting(false);
    }
  }

  const labelUrl = result?.labelUrl || null;
  const labelBase64 = result?.labelBase64 || null;
  const trackingNumber = result?.trackingNumber || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-amber-400" />
            <h2 className="font-semibold">Ship Order</h2>
            {orderId && <span className="text-xs text-zinc-500 font-mono">#{orderId}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400"><X size={16} /></button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-green-400">
              <CheckCircle size={16} />
              {result.demo
                ? 'Demo label generated — configure carrier credentials for real labels.'
                : 'Label generated and order marked as shipped.'}
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Carrier</span>
                <span className="font-medium">{result.carrier || pickedCarrier?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Tracking #</span>
                <span className="font-mono font-medium">{trackingNumber}</span>
              </div>
              {result.postage != null && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Postage</span>
                  <span className="text-amber-400">${Number(result.postage).toFixed(2)}</span>
                </div>
              )}
            </div>
            {trackUrl(carrierId, trackingNumber) && (
              <a href={trackUrl(carrierId, trackingNumber)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
                <ExternalLink size={13} /> Track on carrier site
              </a>
            )}
            {(labelBase64 || labelUrl) && (
              <button
                onClick={() => {
                  if (labelBase64) {
                    const bin = atob(labelBase64);
                    const blob = new Blob([Uint8Array.from(bin, c => c.charCodeAt(0))], { type: 'application/pdf' });
                    window.open(URL.createObjectURL(blob));
                  } else {
                    window.open(labelUrl, '_blank');
                  }
                }}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm rounded-lg font-semibold">
                Open Label PDF
              </button>
            )}
            <button onClick={onClose} className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-lg">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Carrier picker */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Carrier</label>
              <div className="grid grid-cols-3 gap-2">
                {CARRIER_OPTIONS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => switchCarrier(c.id)}
                    className={`px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors
                      ${carrierId === c.id ? 'bg-amber-500 text-black font-semibold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                  >
                    <span>{c.flag}</span>{c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode toggle (real API vs manual tracking entry) */}
            {orderId && (
              <div className="flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={!manualMode} onChange={() => setManualMode(false)} />
                  <span className={!manualMode ? 'text-zinc-200' : 'text-zinc-500'}>Call carrier API</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={manualMode} onChange={() => setManualMode(true)} />
                  <span className={manualMode ? 'text-zinc-200' : 'text-zinc-500'}>Enter tracking manually</span>
                </label>
              </div>
            )}

            {manualMode ? (
              <>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Tracking Number</label>
                  <input value={manualTracking} onChange={e => setManualTracking(e.target.value)}
                    placeholder="Paste carrier tracking number"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Service (optional)</label>
                  <input value={manualService} onChange={e => setManualService(e.target.value)}
                    placeholder="e.g. Priority Mail, Express"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <p className="text-xs text-zinc-500">
                  No carrier API call is made. Use this when you already have a tracking number
                  from the carrier's own portal (AusPost eParcel receipt, NZ Post ticket, JP Post counter, etc.).
                </p>
              </>
            ) : (
              <>
                {/* Service code */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Service</label>
                  <input value={serviceCode} onChange={e => setServiceCode(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500" />
                </div>

                {/* Japan Post tracking pre-fill */}
                {carrierId === 'japanpost' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-amber-200">
                      Japan Post has no public label API. Obtain the tracking number from the JP Post
                      counter (or Click Post), paste it here, and the server will generate a companion
                      PDF to affix alongside the official slip.
                    </p>
                    <input value={manualTracking} onChange={e => setManualTracking(e.target.value)}
                      placeholder="JP Post tracking number"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                )}

                {/* Address */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Recipient name</label>
                  <input value={toName} onChange={e => setToName(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Street address</label>
                  <input value={toStreet} onChange={e => setToStreet(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">City</label>
                    <input value={toCity} onChange={e => setToCity(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">State</label>
                    <input value={toState} onChange={e => setToState(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Postal</label>
                    <input value={toPostal} onChange={e => setToPostal(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Country (ISO)</label>
                    <input value={toCountry} onChange={e => setToCountry(e.target.value.toUpperCase())} maxLength={2}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Phone</label>
                    <input value={toPhone} onChange={e => setToPhone(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                </div>

                {/* Weight */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Weight</label>
                  {USES_IMPERIAL.has(carrierId) ? (
                    <div className="flex items-center gap-2">
                      <input type="number" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} min="0.1" step="0.1"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                      <span className="text-xs text-zinc-500">lbs</span>
                    </div>
                  ) : USES_GRAMS.has(carrierId) ? (
                    <div className="flex items-center gap-2">
                      <input type="number" value={weightGrams} onChange={e => setWeightGrams(e.target.value)} min="10" step="10"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                      <span className="text-xs text-zinc-500">g</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} min="0.05" step="0.05"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                      <span className="text-xs text-zinc-500">kg</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-lg">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Tag size={13} />}
                {submitting ? 'Shipping…' : 'Generate Label'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
