-- Create scan_events table
CREATE TABLE scan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  ip_hash TEXT,
  user_agent TEXT,
  approx_location TEXT,
  lat REAL,
  lng REAL,
  source TEXT NOT NULL DEFAULT 'landing_page' CHECK(source IN ('landing_page', 'api')),
  FOREIGN KEY (tag_id) REFERENCES tags(id),
  FOREIGN KEY (object_id) REFERENCES objects(id)
);
