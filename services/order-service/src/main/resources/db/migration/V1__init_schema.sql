CREATE TABLE suppliers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    contact_name VARCHAR(120),
    email VARCHAR(255),
    phone VARCHAR(40),
    address VARCHAR(255),
    city VARCHAR(120),
    tax_id VARCHAR(40),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    contact_name VARCHAR(120),
    email VARCHAR(255),
    phone VARCHAR(40),
    address VARCHAR(255),
    city VARCHAR(120),
    tax_id VARCHAR(40),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE purchase_order_number_seq;
CREATE SEQUENCE sales_order_number_seq;

-- product_*/warehouse_* sont des références vers inventory-service (autre
-- base) : pas de clé étrangère possible, donc on garde un instantané du
-- nom/SKU au moment de la commande pour l'historique.
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(30) NOT NULL UNIQUE,
    order_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE RESTRICT,
    customer_id BIGINT REFERENCES customers(id) ON DELETE RESTRICT,
    warehouse_id BIGINT NOT NULL,
    warehouse_name VARCHAR(120) NOT NULL,
    order_date DATE NOT NULL,
    expected_date DATE,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 20,
    total_ht NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_ttc NUMERIC(14, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by VARCHAR(100) NOT NULL,
    completed_by VARCHAR(100),
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((order_type = 'PURCHASE' AND supplier_id IS NOT NULL) OR (order_type = 'SALE' AND customer_id IS NOT NULL))
);

CREATE INDEX idx_orders_type_status ON orders(order_type, status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_lines (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(14, 2) NOT NULL
);

CREATE INDEX idx_order_lines_order ON order_lines(order_id);
