-- Schema for Swapnil Nanavare website (Cloudflare D1)

CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  year TEXT,
  org TEXT,
  short_desc TEXT,
  description TEXT,
  photos TEXT,           -- JSON array of photo URLs, stored as text
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  award_id TEXT,        -- NULL = general/home page comment, otherwise the award it belongs to
  parent_id TEXT,        -- NULL = top-level comment, otherwise the comment id it replies to
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  hero_photo TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  slogan TEXT DEFAULT ''
);

INSERT OR IGNORE INTO site_info (id, phone, email, address) VALUES (1, '', '', '');
