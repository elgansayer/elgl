-- The economy service reads/writes a `transaction_id` column on coin_purchases
-- (the store's transaction identifier, distinct from `receipt_token`) to detect
-- replayed purchases, but the column was never created. Because the duplicate
-- check only inspected query `data` and ignored `error`, the missing column
-- made every duplicate-transaction lookup silently report "not found",
-- allowing the same store transaction to be replayed for unlimited coins.
ALTER TABLE coin_purchases ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Enforce uniqueness at the database level so duplicate-transaction detection
-- is atomic and cannot be bypassed by a check-then-insert race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_purchases_transaction_id_unique
  ON coin_purchases (transaction_id)
  WHERE transaction_id IS NOT NULL;
