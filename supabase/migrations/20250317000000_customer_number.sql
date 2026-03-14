-- Kundennummer: eindeutig pro user_id, fortlaufend (1, 2, 3, …).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_number integer;

-- Backfill: pro user_id fortlaufend 1, 2, 3, … (nach created_at, dann id)
WITH ordered AS (
  SELECT id, user_id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at NULLS LAST, id) AS rn
  FROM customers
)
UPDATE customers c
SET customer_number = ordered.rn
FROM ordered
WHERE c.id = ordered.id AND c.user_id = ordered.user_id;

ALTER TABLE customers
  ALTER COLUMN customer_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_user_customer_number_key
  ON customers (user_id, customer_number);

COMMENT ON COLUMN customers.customer_number IS 'Fortlaufende Kundennummer pro Benutzer (1, 2, 3, …).';
