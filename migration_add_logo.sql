-- Run this once against your existing (already deployed) database:
-- wrangler d1 execute swapnil_nanavare_db --file=./migration_add_logo.sql --remote

ALTER TABLE site_info ADD COLUMN logo_url TEXT DEFAULT '';

UPDATE site_info
SET logo_url = 'https://lh3.googleusercontent.com/d/1vNJ6Ziqoqm5UzaQFBy0fQyMKK_cvSL5g'
WHERE id = 1;
