-- Optional instructions from the client for the kitchen (customization, dietary notes, etc.).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS notes TEXT NULL;
