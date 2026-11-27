-- Cloudflare D1 Schema untuk Auvori (Lisensi Pro via Webhook Lynk.id)
-- Jalankan: wrangler d1 execute auvori-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  license_code TEXT NOT NULL UNIQUE,
  ref_id TEXT UNIQUE,
  buyer_name TEXT,
  plan TEXT NOT NULL DEFAULT 'Auvori Pro Lifetime',
  status TEXT NOT NULL DEFAULT 'active',
  max_devices INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_licenses_code ON licenses(UPPER(license_code));

CREATE TABLE IF NOT EXISTS device_activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(license_id, device_id),
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_id TEXT,
  event_type TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
