CREATE TABLE products (
 id UUID PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
 color TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents>0), photo_url TEXT NOT NULL,
 archived BOOLEAN NOT NULL DEFAULT FALSE, demo BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE variants (
 id UUID PRIMARY KEY, product_id UUID NOT NULL REFERENCES products(id), size TEXT NOT NULL,
 stock INTEGER NOT NULL CHECK(stock>=0), cost_cents INTEGER NOT NULL CHECK(cost_cents>=0),
 UNIQUE(product_id,size)
);
CREATE TABLE sales (
 id UUID PRIMARY KEY, variant_id UUID NOT NULL REFERENCES variants(id), product_name TEXT NOT NULL,
 size TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), price_cents INTEGER NOT NULL CHECK(price_cents>=0),
 cost_cents INTEGER NOT NULL CHECK(cost_cents>=0), label_cents INTEGER NOT NULL CHECK(label_cents>=0),
 bag_cents INTEGER NOT NULL CHECK(bag_cents>=0), sweet_cents INTEGER NOT NULL CHECK(sweet_cents>=0),
 other_cents INTEGER NOT NULL CHECK(other_cents>=0), reserve_percent INTEGER NOT NULL CHECK(reserve_percent BETWEEN 0 AND 100),
 note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), voided_at TIMESTAMPTZ,
 request_id UUID NOT NULL UNIQUE
);
CREATE TABLE movements (
 id UUID PRIMARY KEY, variant_id UUID NOT NULL REFERENCES variants(id), kind TEXT NOT NULL,
 quantity INTEGER NOT NULL, cost_cents INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), request_id UUID NOT NULL UNIQUE
);
CREATE TABLE expenses (
 id UUID PRIMARY KEY, description TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 expense_date DATE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), request_id UUID NOT NULL UNIQUE
);
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), label_cents INTEGER NOT NULL DEFAULT 50, bag_cents INTEGER NOT NULL DEFAULT 150, sweet_cents INTEGER NOT NULL DEFAULT 50, other_cents INTEGER NOT NULL DEFAULT 0, reserve_percent INTEGER NOT NULL DEFAULT 20);
INSERT INTO settings(id) VALUES(1);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE login_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_start TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE images (id UUID PRIMARY KEY, content BYTEA NOT NULL, mime TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX variants_product_idx ON variants(product_id);
CREATE INDEX sales_created_idx ON sales(created_at);
CREATE INDEX movements_created_idx ON movements(created_at);
