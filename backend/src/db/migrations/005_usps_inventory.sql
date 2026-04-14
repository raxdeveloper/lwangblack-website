-- ── Migration 005: USPS Integration + Inventory Alerts ──────────────────────

-- ── Orders: add shipping fields ───────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_service VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url        TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zip              VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city             VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS state            VARCHAR(64);

-- ── Logistics Labels ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logistics_labels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        VARCHAR(64) NOT NULL,
  carrier         VARCHAR(32) NOT NULL DEFAULT 'USPS',
  tracking_number VARCHAR(128),
  service_type    VARCHAR(64),
  label_base64    TEXT,
  label_url       TEXT,
  postage         NUMERIC(10,2),
  from_address    JSONB,
  to_address      JSONB,
  weight_oz       NUMERIC(8,2),
  voided          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT logistics_labels_order_id_unique UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_logistics_labels_order_id ON logistics_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_logistics_labels_tracking ON logistics_labels(tracking_number);

-- ── Inventory Alerts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   VARCHAR(64) NOT NULL,
  product_name VARCHAR(255),
  alert_type   VARCHAR(32) NOT NULL DEFAULT 'low_stock', -- low_stock | out_of_stock | restock
  threshold    INTEGER NOT NULL DEFAULT 10,
  current_qty  INTEGER NOT NULL DEFAULT 0,
  is_resolved  BOOLEAN DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product ON inventory_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_resolved ON inventory_alerts(is_resolved);

-- ── Products: add inventory tracking fields ───────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku                  VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_g             NUMERIC(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_inventory      BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock       INTEGER DEFAULT 0;

-- ── USPS settings ─────────────────────────────────────────────────────────────
INSERT INTO settings (key, value, updated_at) VALUES
  ('usps_user_id',   '', NOW()),
  ('usps_password',  '', NOW()),
  ('usps_test_mode', 'true', NOW()),
  ('usps_from_zip',  '10001', NOW()),
  ('usps_from_street', '', NOW()),
  ('usps_from_city', 'New York', NOW()),
  ('usps_from_state','NY', NOW())
ON CONFLICT (key) DO NOTHING;
