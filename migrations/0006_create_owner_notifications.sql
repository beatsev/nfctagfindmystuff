-- Create owner_notifications table
CREATE TABLE owner_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_event_id INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('telegram')),
  status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (scan_event_id) REFERENCES scan_events(id)
);
