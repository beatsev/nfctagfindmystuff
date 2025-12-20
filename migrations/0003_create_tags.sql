-- Create tags table
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
);
