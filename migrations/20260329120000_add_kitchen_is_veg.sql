-- Veg / non-veg tag for kitchens (true = veg, false = non-veg).
ALTER TABLE kitchens
  ADD COLUMN IF NOT EXISTS is_veg BOOLEAN NOT NULL DEFAULT false;
