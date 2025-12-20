-- Create finder_messages table
CREATE TABLE finder_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_event_id INTEGER NOT NULL,
  tag_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  message TEXT NOT NULL,
  contact TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (scan_event_id) REFERENCES scan_events(id)
);
