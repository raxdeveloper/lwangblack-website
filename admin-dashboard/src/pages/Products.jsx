import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import {
  Search, Plus, Package, AlertTriangle, Pencil, Trash2, X, Save, Image,
  BarChart2, RefreshCw, TrendingDown, AlertOctagon, CheckCircle, Layers, Hash
} from 'lucide-react';

function StockBadge({ stock, threshold = 10 }) {
  if (stock <= 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Out of stock</span>;
  if (stock < threshold) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{stock} left</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">{stock} in stock</span>;
}

const EMPTY_PRODUCT = {
  name: '', description: '', price: '', stock: '', category: '',
  image: '', weight: '', sku: '', low_stock_threshold: '10',
};

function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product
    ? { ...product, price: product.price || '', stock: product.stock ?? '', low_stock_threshold: product.low_stock_threshold || '10' }
    : EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const isEdit = !!product?.id;

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name || !form.price) return alert('Name and price are required.');
    setSaving(true);
    try {
      const body = {
        ...form,
        price:               parseFloat(form.price),
        stock:               parseInt(form.stock) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
        weight_g:            parseFloat(form.weight) || undefined,
      };
      const result = isEdit
        ? await apiFetch(`/products/${product.id}`, { method: 'PUT', body })
        : await apiFetch('/products', { method: 'POST', body });
      onSaved(result.product || { ...body, id: result.id || result.productId || Date.now() });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="font-semibold">{isEdit ? 'Edit product' : 'Add product'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          <div className="flex gap-4 items-start">
            <div className="w-20 h-20 bg-zinc-800 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
              {form.image
                ? <img src={form.image} alt="" className="w-full h-full object-cover" />
                : <Image size={24} className="text-zinc-600" />}
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">Image URL</label>
              <input value={form.image} onChange={e => setF('image', e.target.value)} placeholder="https://..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Product name *</label>
            <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Lwang Black Espresso 250g"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={3}
              placeholder="Product description..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Price (USD) *</label>
              <input type="number" value={form.price} onChange={e => setF('price', e.target.value)} placeholder="0.00" min="0" step="0.01"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Stock quantity</label>
              <input type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} placeholder="0" min="0"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Low-stock alert threshold</label>
              <input type="number" value={form.low_stock_threshold} onChange={e => setF('low_stock_threshold', e.target.value)} placeholder="10" min="1"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Category</label>
              <input value={form.category} onChange={e => setF('category', e.target.value)} placeholder="Coffee, Merch..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">SKU</label>
              <input value={form.sku} onChange={e => setF('sku', e.target.value)} placeholder="LB-ESP-250"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Weight (g)</label>
              <input type="number" value={form.weight} onChange={e => setF('weight', e.target.value)} placeholder="250"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50">
            <Save size={14} /> {isEdit ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stock Adjust modal ────────────────────────────────────────────────────────
function StockModal({ product, onClose, onUpdated }) {
  const [mode, setMode]       = useState('set'); // set | adjust
  const [value, setValue]     = useState(String(product.stock || 0));
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);

  const apply = async () => {
    setSaving(true);
    try {
      const body = mode === 'set'
        ? { set: parseInt(value), reason }
        : { adjustment: parseInt(value), reason };
      const res = await apiFetch(`/products/${product.id}/stock`, { method: 'PATCH', body });
      onUpdated(product.id, res.stock);
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const preview = mode === 'set'
    ? Math.max(0, parseInt(value) || 0)
    : Math.max(0, (product.stock || 0) + (parseInt(value) || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="font-semibold text-sm">Adjust Stock</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400"><X size={15} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Current:</span>
            <span className="font-mono font-medium text-zinc-200">{product.stock || 0}</span>
            <span className="text-zinc-600">→</span>
            <span className={`font-mono font-medium ${preview <= 0 ? 'text-red-400' : preview < (product.low_stock_threshold || 10) ? 'text-amber-400' : 'text-green-400'}`}>
              {preview}
            </span>
          </div>

          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {['set', 'adjust'].map(m => (
              <button key={m} onClick={() => { setMode(m); setValue(m === 'set' ? String(product.stock || 0) : '0'); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === m ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                {m === 'set' ? 'Set exact' : 'Adjust ±'}
              </button>
            ))}
          </div>

          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={mode === 'adjust' ? '+10 or -5' : 'New quantity'}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />

          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg">Cancel</button>
            <button onClick={apply} disabled={saving}
              className="flex-1 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-black rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inventory Summary Panel ───────────────────────────────────────────────────
function InventorySummary({ products }) {
  const total      = products.length;
  const outOfStock = products.filter(p => (p.stock || 0) <= 0).length;
  const lowStock   = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < (p.low_stock_threshold || 10)).length;
  const inStock    = total - outOfStock - lowStock;
  const totalUnits = products.reduce((s, p) => s + (p.stock || 0), 0);

  const stat = (icon, label, val, color) => (
    <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-zinc-700 ${color}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold">{val}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stat(<Layers size={16} />,         'Total Products',    total,      'text-zinc-300')}
      {stat(<CheckCircle size={16} />,    'In Stock',          inStock,    'text-green-400')}
      {stat(<TrendingDown size={16} />,   'Low Stock',         lowStock,   'text-amber-400')}
      {stat(<AlertOctagon size={16} />,   'Out of Stock',      outOfStock, 'text-red-400')}
    </div>
  );
}

// ── Inventory Alerts Panel ────────────────────────────────────────────────────
function AlertsPanel({ alerts, onResolve }) {
  if (!alerts.length) return null;
  return (
    <div className="bg-zinc-900 border border-amber-500/20 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-400" />
        <h3 className="text-sm font-medium text-amber-300">Inventory Alerts</h3>
        <span className="ml-auto text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">{alerts.length} active</span>
      </div>
      <div className="divide-y divide-zinc-800">
        {alerts.slice(0, 10).map(a => (
          <div key={a.id || a.product_id} className="flex items-center gap-3 px-4 py-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.alert_type === 'out_of_stock' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.product_name}</p>
              <p className="text-xs text-zinc-500">
                {a.alert_type === 'out_of_stock' ? 'Out of stock' : `Low stock: ${a.current_qty || a.current_stock} remaining`}
                {a.threshold && ` (alert threshold: ${a.threshold})`}
              </p>
            </div>
            <button onClick={() => onResolve(a.id || a.product_id)}
              className="flex-shrink-0 text-xs text-zinc-500 hover:text-green-400 flex items-center gap-1">
              <CheckCircle size={12} /> Resolve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Products component ───────────────────────────────────────────────────
export default function Products() {
  const [products, setProducts]     = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy]         = useState('name');
  const [modal, setModal]           = useState(null);   // null | {} (new) | product (edit)
  const [stockModal, setStockModal] = useState(null);   // product or null
  const [view, setView]             = useState('grid'); // grid | list

  const load = useCallback(async () => {
    try {
      const [data, alertData] = await Promise.all([
        apiFetch('/products').catch(() => ({ products: [] })),
        apiFetch('/products/inventory/alerts').catch(() => ({ alerts: [] })),
      ]);
      setProducts(data.products || []);
      setAlerts(alertData.alerts || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = [...products];
    if (stockFilter === 'low')  list = list.filter(p => (p.stock||0) > 0 && (p.stock||0) < (p.low_stock_threshold||10));
    if (stockFilter === 'out')  list = list.filter(p => (p.stock||0) <= 0);
    if (stockFilter === 'good') list = list.filter(p => (p.stock||0) >= (p.low_stock_threshold||10));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortBy === 'name')       return (a.name||'').localeCompare(b.name||'');
      if (sortBy === 'price_desc') return (b.price||0)-(a.price||0);
      if (sortBy === 'price_asc')  return (a.price||0)-(b.price||0);
      if (sortBy === 'stock_desc') return (b.stock||0)-(a.stock||0);
      if (sortBy === 'stock_asc')  return (a.stock||0)-(b.stock||0);
      return 0;
    });
    setFiltered(list);
  }, [products, search, stockFilter, sortBy]);

  const deleteProduct = async (id) => {
    if (!window.confirm('Archive this product? It will be hidden from the store.')) return;
    try {
      await apiFetch(`/products/${id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) { alert(err.message); }
  };

  const handleSaved = (product) => {
    setProducts(prev => {
      const exists = prev.find(p => p.id === product.id);
      return exists ? prev.map(p => p.id === product.id ? product : p) : [product, ...prev];
    });
    // Re-fetch alerts
    apiFetch('/products/inventory/alerts').then(d => setAlerts(d.alerts || [])).catch(() => {});
  };

  const handleStockUpdated = (productId, newStock) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    apiFetch('/products/inventory/alerts').then(d => setAlerts(d.alerts || [])).catch(() => {});
  };

  const resolveAlert = async (alertId) => {
    try {
      await apiFetch(`/products/inventory/alerts/${alertId}/resolve`, { method: 'PATCH' });
      setAlerts(prev => prev.filter(a => (a.id || a.product_id) !== alertId));
    } catch {}
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Products & Inventory</h1>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200" title="Refresh">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setView(v => v === 'grid' ? 'list' : 'grid')}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200" title="Toggle view">
              <BarChart2 size={15} />
            </button>
            <button onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm rounded-lg transition-colors">
              <Plus size={16} /> Add product
            </button>
          </div>
        </div>

        {/* Inventory summary stats */}
        {!loading && products.length > 0 && <InventorySummary products={products} />}

        {/* Alerts */}
        {alerts.length > 0 && <AlertsPanel alerts={alerts} onResolve={resolveAlert} />}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex-1 min-w-48 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, SKU, category..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-700" />
          </div>
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none">
            <option value="all">All stock</option>
            <option value="good">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none">
            <option value="name">Name A–Z</option>
            <option value="price_desc">Price high–low</option>
            <option value="price_asc">Price low–high</option>
            <option value="stock_desc">Most stock</option>
            <option value="stock_asc">Least stock</option>
          </select>
        </div>

        {/* Product list */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-52 bg-zinc-800/60 rounded-xl animate-pulse" />)}
          </div>
        ) : view === 'list' ? (
          /* List view */
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-zinc-800 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="text-zinc-600" />}
                        </div>
                        <span className="font-medium line-clamp-1">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-400">
                      <div className="flex items-center gap-1"><Hash size={10} />{p.sku || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{p.category || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-400">${(p.price||0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <StockBadge stock={p.stock || 0} threshold={p.low_stock_threshold || 10} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => setStockModal(p)} title="Adjust stock"
                          className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-amber-400">
                          <Layers size={13} />
                        </button>
                        <button onClick={() => setModal(p)} title="Edit"
                          className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteProduct(p.id)} title="Archive"
                          className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-zinc-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => (
              <div key={p.id}
                className={`bg-zinc-900 border rounded-xl overflow-hidden hover:border-zinc-600 transition-colors group
                  ${(p.stock||0) <= 0 ? 'border-red-500/30' : (p.stock||0) < (p.low_stock_threshold||10) ? 'border-amber-500/30' : 'border-zinc-800'}`}>
                <div className="aspect-square bg-zinc-800 flex items-center justify-center overflow-hidden relative">
                  {p.image
                    ? <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <Package size={32} className="text-zinc-600" />}
                  {(p.stock||0) <= 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-full border border-red-500/30">OUT OF STOCK</span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="font-medium text-sm leading-tight line-clamp-2">{p.name}</p>
                  {p.sku && <p className="text-xs text-zinc-600 font-mono flex items-center gap-1"><Hash size={9} />{p.sku}</p>}
                  {p.category && <p className="text-xs text-zinc-500">{p.category}</p>}
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-amber-400">${(p.price||0).toFixed(2)}</span>
                    <StockBadge stock={p.stock || 0} threshold={p.low_stock_threshold || 10} />
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button onClick={() => setStockModal(p)}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-amber-400" title="Adjust stock">
                      <Layers size={12} />
                    </button>
                    <button onClick={() => setModal(p)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors">
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => deleteProduct(p.id)}
                      className="p-1.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-zinc-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <Package size={40} className="mb-3" />
            <p className="text-sm">{search ? 'No products found' : 'No products yet'}</p>
            {!search && (
              <button onClick={() => setModal({})} className="mt-3 text-xs text-amber-400 hover:text-amber-300">
                + Add your first product
              </button>
            )}
          </div>
        )}
      </div>

      {modal !== null && (
        <ProductModal
          product={modal && modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {stockModal && (
        <StockModal
          product={stockModal}
          onClose={() => setStockModal(null)}
          onUpdated={handleStockUpdated}
        />
      )}
    </>
  );
}
