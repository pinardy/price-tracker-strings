CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  instrument      TEXT NOT NULL CHECK (instrument IN ('violin','viola','cello','bass')),
  brand           TEXT,
  variant_desc    TEXT,
  target_price    REAL,
  target_currency TEXT NOT NULL DEFAULT 'USD',
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_links (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  external_id TEXT,
  variant_id  TEXT,
  query       TEXT,
  url         TEXT NOT NULL,
  title       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, provider_id, external_id, variant_id)
);

CREATE TABLE IF NOT EXISTS fetch_runs (
  id          INTEGER PRIMARY KEY,
  trigger     TEXT NOT NULL CHECK (trigger IN ('startup','cron','manual')),
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  ok_count    INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_log   TEXT
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id         INTEGER PRIMARY KEY,
  link_id    INTEGER NOT NULL REFERENCES product_links(id) ON DELETE CASCADE,
  run_id     INTEGER REFERENCES fetch_runs(id),
  price      REAL NOT NULL,
  currency   TEXT NOT NULL,
  in_stock   INTEGER,
  scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_link_time ON price_snapshots(link_id, scraped_at);

CREATE TABLE IF NOT EXISTS alerts (
  id           INTEGER PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  link_id      INTEGER REFERENCES product_links(id) ON DELETE SET NULL,
  snapshot_id  INTEGER REFERENCES price_snapshots(id) ON DELETE SET NULL,
  price        REAL NOT NULL,
  currency     TEXT NOT NULL,
  target_price REAL NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
