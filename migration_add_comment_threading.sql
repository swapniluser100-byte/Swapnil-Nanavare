-- Run this once against your existing (already deployed) database:
-- wrangler d1 execute swapnil_nanavare_db --file=./migration_add_comment_threading.sql --remote

ALTER TABLE comments ADD COLUMN award_id TEXT;
ALTER TABLE comments ADD COLUMN parent_id TEXT;
