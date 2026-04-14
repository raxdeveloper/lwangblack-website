import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import {
  Truck, MapPin, Search, Package, Tag, CheckCircle, AlertTriangle,
  Edit2, X, Save, ExternalLink, Settings, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';

const CARRIER_META = {
  usps:      { label: 'USPS',           flag: '🇺🇸', country: 'United States',  color: 'text-blue-400',   website: 'https://www.usps.com/' },
  chitchats: { label: 'Chit Chats',     flag: '🇨🇦', country: 'Canada',         color: 'text-red-400',    website: 'https://chitchats.com/' },
  auspost:   { label: 'Australia Post', flag: '🇦🇺', country: 'AU + Intl',      color: 'text-amber-400',  website: 'https://auspost.com.au/' },
  nzpost:    { label: 'NZ Post',        flag: '🇳🇿', country: 'New Zealand',    color: 'text-green-400',  website: 'https://www.nzpost.co.nz/' },
  japanpost: { label: 'Japan Post',     flag: '🇯🇵', country: 'Japan',          color: 'text-pink-400',   website: 'https://www.post.japanpost.jp/' },
  pathao:    { label: 'Pathao',         flag: '🇳🇵', country: 'Nepal',          color: 'text-purple-400', website: 'https://pathao.com/' },
};

// ── Label Generator modal ─────────────────────────────────────────────────────
function LabelModal({ orderId, onClose }) {
  const [serviceType, setServiceType] = useState('PRIORITY');
  const [fromZip, setFromZip]       = useState('10001');
  const [toZip, setToZip]           = useState('');
  const [toName, setToName]         = useState('');
  const [toStreet, setToStreet]     = useState('');
  const [toCity, setToCity]         = useState('');
  const [toState, setToState]       = useState('');
  const [weight, setWeight]         = useState('1');
  const [rates, setRates]           = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);

  const fetchRates = async () => {
    if (!toZip) return;
    setLoadingRates(true);
    try {
      const data = await apiFetch('/logistics/usps/rates', {
        method: 'POST',
        body: { toZip, fromZip, weightLbs: parseFloat(weight) || 1 },
      });
      setRates(data.rates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRates(false);
    }
  };

  const generateLabel = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/logistics/usps/label', {
        method: 'POST',
        body: {
          orderId,
          serviceType,
          fromAddress: { zip: fromZip },
          toAddress:   { name: toName, street: toStreet, city: toCity, state: toState, zip: toZip },
          weightLbs:   parseFloat(weight) || 1,
        },
      });
      setResult(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-blue-400" />
            <h2 className="font-semibold">Generate USPS Label</h2>
            <span className="text-xs text-zinc-500">Order #{orderId}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400"><X size={16} /></button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className={`flex items-center gap-2 text-sm font-medium ${result.demo ? 'text-amber-400' : 'text-green-400'}`}>
              <CheckCircle size={16} />
              {result.demo ? 'Demo label generated (configure USPS_USER_ID for real labels)' : 'Label generated successfully'}
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Tracking #</span><span className="font-mono font-medium">{result.trackingNumber}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Service</span><span>{result.serviceType}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Postage</span><span className="text-amber-400">${(result.postage || 0).toFixed(2)}</span></div>
            </div>
            {result.trackingNumber && (
              <a href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${result.trackingNumber}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                <ExternalLink size={13} /> Track on USPS.com
              </a>
            )}
            {result.labelBase64 && (
              <button
                onClick={() => {
                  const b = atob(result.labelBase64);
                  const blob = new Blob([Uint8Array.from(b, c => c.charCodeAt(0))], { type: 'application/pdf' });
                  window.open(URL.createObjectURL(blob));
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium">
                Download Label PDF
              </button>
            )}
            <button onClick={onClose} className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-lg">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Service type */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Service Type</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="PRIORITY">USPS Priority Mail (2–3 days)</option>
                <option value="PRIORITY_EXPRESS">USPS Priority Mail Express (1–2 days)</option>
                <option value="FIRST_CLASS">USPS First-Class Mail (1–5 days)</option>
                <option value="RETAIL_GROUND">USPS Retail Ground (2–8 days)</option>
              </select>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">From ZIP</label>
                <input value={fromZip} onChange={e => setFromZip(e.target.value)} maxLength={5}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Weight (lbs)</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} min="0.1" step="0.1"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Recipient Name</label>
              <input value={toName} onChange={e => setToName(e.target.value)} placeholder="John Doe"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Street Address</label>
              <input value={toStreet} onChange={e => setToStreet(e.target.value)} placeholder="123 Main St"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">City</label>
                <input value={toCity} onChange={e => setToCity(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">State</label>
                <input value={toState} onChange={e => setToState(e.target.value)} maxLength={2} placeholder="NY"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ZIP</label>
                <input value={toZip} onChange={e => setToZip(e.target.value)} maxLength={5}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            {/* Live rate preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">Live Rate Preview</span>
                <button onClick={fetchRates} disabled={!toZip || loadingRates}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 flex items-center gap-1">
                  <RefreshCw size={11} className={loadingRates ? 'animate-spin' : ''} /> Fetch rates
                </button>
              </div>
              {rates.length > 0 && (
                <div className="space-y-1">
                  {rates.slice(0, 4).map(r => (
                    <div key={r.serviceCode}
                      onClick={() => setServiceType(r.serviceCode)}
                      className={`flex justify-between items-center text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors
                        ${serviceType === r.serviceCode ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300' : 'bg-zinc-800 hover:bg-zinc-700'}`}>
                      <span>{r.service} <span className="text-zinc-500">({r.days})</span></span>
                      <span className="font-mono">${r.price.toFixed(2)}{r.demo && ' ~'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-lg">Cancel</button>
              <button onClick={generateLabel} disabled={loading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                <Tag size={13} /> {loading ? 'Generating…' : 'Generate Label'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── USPS Config Panel ─────────────────────────────────────────────────────────
function USPSConfigPanel({ onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', password: '', fromZip: '10001', fromStreet: '', fromCity: 'New York', fromState: 'NY', testMode: true });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/logistics/config/usps', {
        method: 'PUT',
        body: { apiKey: form.userId, apiSecret: form.password, accountNumber: form.fromZip, isLive: !form.testMode },
      });
      alert('USPS configuration saved.');
      onSaved?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-blue-500/30 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/50 transition-colors">
        <div className="flex items-center gap-3">
          <Settings size={15} className="text-blue-400" />
          <span className="text-sm font-medium text-blue-300">USPS Web Tools Configuration</span>
          <span className="text-xs text-zinc-500">Register free at usps.com</span>
        </div>
        {open ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 pt-3">
            Register at <a href="https://registration.shippingapis.com/" target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">registration.shippingapis.com</a> (free) to get your User ID.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">USPS User ID</label>
              <input value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} placeholder="XXXXXX123"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">USPS Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">From ZIP</label>
              <input value={form.fromZip} onChange={e => setForm(f => ({ ...f, fromZip: e.target.value }))} maxLength={5}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">From State</label>
              <input value={form.fromState} onChange={e => setForm(f => ({ ...f, fromState: e.target.value }))} maxLength={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">From Street</label>
              <input value={form.fromStreet} onChange={e => setForm(f => ({ ...f, fromStreet: e.target.value }))} placeholder="135 King St"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
            <input type="checkbox" checked={form.testMode} onChange={e => setForm(f => ({ ...f, testMode: e.target.checked }))}
              className="rounded border-zinc-600 bg-zinc-800" />
            Test / Sandbox mode
          </label>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-50">
            <Save size={13} /> {saving ? 'Saving…' : 'Save USPS Config'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Logistics() {
  const [zones, setZones]             = useState([]);
  const [carriers, setCarriers]       = useState([]);
  const [trackInput, setTrackInput]   = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [tracking, setTracking]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [labelModal, setLabelModal]   = useState(null); // orderId or null
  const [testOrderId, setTestOrderId] = useState('');
  const [editZone, setEditZone]       = useState(null);
  const [savingZone, setSavingZone]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [z, c] = await Promise.all([
        apiFetch('/logistics/zones').catch(() => ({ zones: [] })),
        apiFetch('/logistics/carriers').catch(() => ({ carriers: [] })),
      ]);
      setZones(z.zones || []);
      setCarriers(c.carriers || []);
    } catch (err) {
      console.error('Logistics load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const track = async (e) => {
    e.preventDefault();
    if (!trackInput.trim()) return;
    setTracking(true);
    setTrackResult(null);
    try {
      const isUSPS = /^[0-9]{20,22}$/.test(trackInput.replace(/\s/g, ''));
      const data = await apiFetch('/logistics/track', {
        method: 'POST',
        body: { trackingNumber: trackInput.trim(), carrierId: isUSPS ? 'usps' : undefined },
      });
      setTrackResult(data.tracking);
    } catch (err) {
      alert(err.message);
    } finally {
      setTracking(false);
    }
  };

  const saveZone = async () => {
    if (!editZone) return;
    setSavingZone(true);
    try {
      await apiFetch(`/logistics/zones/${editZone.id}`, {
        method: 'PUT',
        body: {
          shipping_cost:  parseFloat(editZone.shipping_cost),
          free_above:     editZone.free_above ? parseFloat(editZone.free_above) : null,
          estimated_days: editZone.estimated_days,
          is_active:      editZone.is_active,
        },
      });
      setZones(prev => prev.map(z => z.id === editZone.id ? { ...z, ...editZone } : z));
      setEditZone(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingZone(false);
    }
  };

  const statusColor = (s) => {
    if (!s) return 'text-zinc-400';
    const l = s.toLowerCase();
    if (l.includes('delivered')) return 'text-green-400';
    if (l.includes('transit') || l.includes('delivery')) return 'text-blue-400';
    if (l.includes('exception') || l.includes('alert')) return 'text-red-400';
    return 'text-amber-400';
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-zinc-500">
      <Truck size={20} className="animate-bounce mr-2" /> Loading logistics…
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logistics</h1>
        <div className="text-xs text-zinc-500">{carriers.length} carriers · {zones.length} zones</div>
      </div>

      {/* ── USPS Section ──────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇺🇸</span>
            <h3 className="text-sm font-semibold text-blue-300">USPS — United States Shipping</h3>
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">Primary US Carrier</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Services grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'Priority Mail',         days: '2-3 days',  price: '$8.70+',  code: 'PRIORITY' },
              { name: 'Priority Mail Express', days: '1-2 days',  price: '$26.35+', code: 'PRIORITY_EXPRESS' },
              { name: 'First-Class Mail',      days: '1-5 days',  price: '$4.50+',  code: 'FIRST_CLASS' },
              { name: 'Retail Ground',         days: '2-8 days',  price: '$7.25+',  code: 'RETAIL_GROUND' },
            ].map(s => (
              <div key={s.code} className="bg-zinc-800 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-zinc-200">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.days}</p>
                <p className="text-xs font-mono text-amber-400">{s.price}</p>
              </div>
            ))}
          </div>

          {/* Label generator test */}
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
            <p className="text-xs text-zinc-400 font-medium flex items-center gap-2">
              <Tag size={13} className="text-blue-400" /> Generate USPS Label from Order
            </p>
            <div className="flex gap-2">
              <input
                value={testOrderId}
                onChange={e => setTestOrderId(e.target.value)}
                placeholder="Enter Order ID..."
                className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => testOrderId && setLabelModal(testOrderId)}
                disabled={!testOrderId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-40">
                Generate Label
              </button>
            </div>
            <p className="text-xs text-zinc-600">
              Labels are automatically generated when you click "Ship" on an order. Or enter an order ID above to generate manually.
            </p>
          </div>

          {/* USPS config */}
          <USPSConfigPanel onSaved={load} />
        </div>
      </div>

      {/* ── Track Shipment ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
          <Search size={14} /> Track Shipment
        </h3>
        <form onSubmit={track} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter tracking number (USPS, Pathao, AusPost…)"
            value={trackInput}
            onChange={e => setTrackInput(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <button type="submit" disabled={tracking}
            className="px-4 py-2 bg-amber-500 text-zinc-950 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">
            {tracking ? <RefreshCw size={14} className="animate-spin" /> : 'Track'}
          </button>
        </form>

        {trackResult && (
          <div className="mt-4 bg-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Truck size={20} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{trackResult.carrier} — <span className="font-mono">{trackResult.number}</span></p>
                <p className={`text-sm ${statusColor(trackResult.status)}`}>{trackResult.status?.replace(/_/g, ' ').toUpperCase()}</p>
              </div>
              {trackResult.demo && <span className="text-xs bg-zinc-700 px-2 py-1 rounded flex-shrink-0">Demo</span>}
              {trackResult.number && (
                <a href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackResult.number}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 flex-shrink-0 flex items-center gap-1 hover:underline">
                  <ExternalLink size={11} /> USPS
                </a>
              )}
            </div>
            <p className="text-sm text-zinc-400 mb-3">{trackResult.description}</p>
            {trackResult.location && <p className="text-xs text-zinc-500 mb-3">📍 {trackResult.location}</p>}
            {trackResult.events?.length > 0 && (
              <div className="space-y-2 border-t border-zinc-700 pt-3">
                {trackResult.events.map((ev, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-zinc-500 min-w-[140px] flex-shrink-0">
                      {ev.date ? `${ev.date} ${ev.time || ''}` : new Date(ev.time || ev.date).toLocaleString()}
                    </span>
                    <span className="text-zinc-300 flex-1">{ev.description}</span>
                    {ev.location && <span className="text-zinc-500 flex-shrink-0">{ev.location}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Carrier Overview ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <Truck size={16} className="text-amber-500" />
          <h3 className="text-sm font-medium text-zinc-300">All Carriers</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(CARRIER_META).map(([id, meta]) => (
            <div key={id} className={`bg-zinc-800 rounded-xl p-4 border ${id === 'usps' ? 'border-blue-500/30' : 'border-zinc-700/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.flag}</span>
                  <div>
                    <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
                    <p className="text-xs text-zinc-500">{meta.country}</p>
                  </div>
                </div>
                {id === 'usps' && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Active</span>
                )}
              </div>
              <a href={meta.website} target="_blank" rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 mt-1">
                <ExternalLink size={10} /> {meta.website.replace('https://', '')}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ── Delivery Zones ───────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <MapPin size={16} className="text-amber-500" />
          <h3 className="text-sm font-medium text-zinc-400">Delivery Zones</h3>
          <span className="text-xs text-zinc-600 ml-auto">Click Edit to update rates</span>
        </div>

        {/* Edit zone form */}
        {editZone && (
          <div className="p-4 bg-zinc-800/50 border-b border-zinc-700 space-y-3">
            <p className="text-xs font-medium text-amber-400">Editing: {editZone.name}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Shipping Cost</label>
                <input type="number" value={editZone.shipping_cost} onChange={e => setEditZone(z => ({ ...z, shipping_cost: e.target.value }))} min="0" step="0.01"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Free Above</label>
                <input type="number" value={editZone.free_above || ''} onChange={e => setEditZone(z => ({ ...z, free_above: e.target.value }))} min="0"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Estimated Delivery</label>
                <input value={editZone.estimated_days} onChange={e => setEditZone(z => ({ ...z, estimated_days: e.target.value }))}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditZone(null)} className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg">Cancel</button>
              <button onClick={saveZone} disabled={savingZone}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-medium disabled:opacity-50">
                <Save size={11} /> {savingZone ? 'Saving…' : 'Save Zone'}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Zone</th>
                <th className="px-4 py-3 text-left">Country</th>
                <th className="px-4 py-3 text-left">Carrier</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Free Above</th>
                <th className="px-4 py-3 text-left">Est. Delivery</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map(z => {
                const cMeta = Object.values(CARRIER_META).find(m =>
                  m.country.includes(z.country) || (z.country === 'US' && m.label === 'USPS')
                );
                return (
                  <tr key={z.id || z.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="px-4 py-3 font-medium text-zinc-200">{z.name}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="mr-1">{cMeta?.flag || '🌍'}</span>{z.country}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={cMeta?.color || 'text-zinc-400'}>{cMeta?.label || 'Australia Post'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {parseFloat(z.shipping_cost) === 0
                        ? <span className="text-green-400">FREE</span>
                        : `${z.currency} ${parseFloat(z.shipping_cost).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400 text-xs">
                      {z.free_above ? `${z.currency} ${parseFloat(z.free_above).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{z.estimated_days}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setEditZone({ ...z })}
                        className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-amber-400">
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Label modal */}
      {labelModal && <LabelModal orderId={labelModal} onClose={() => setLabelModal(null)} />}
    </div>
  );
}
