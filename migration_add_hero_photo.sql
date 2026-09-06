-- Run this once against your existing (already deployed) database:
-- wrangler d1 execute swapnil_nanavare_db --file=./migration_add_hero_photo.sql --remote

ALTER TABLE site_info ADD COLUMN hero_photo TEXT DEFAULT '';
