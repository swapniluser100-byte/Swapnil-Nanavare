-- Run this once against your existing (already deployed) database:
-- wrangler d1 execute swapnil_nanavare_db --file=./migration_add_slogan.sql --remote

ALTER TABLE site_info ADD COLUMN slogan TEXT DEFAULT '';

UPDATE site_info
SET slogan = 'प्रत्येक हृदयाच्या ठोक्यासोबत, नवजीवनाची आशा.'
WHERE id = 1;
