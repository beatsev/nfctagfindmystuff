-- Add UUID column to scan_events for non-blocking scan event creation.
-- The UUID is generated before the D1 INSERT so the landing page can
-- return immediately while the INSERT runs in waitUntil.
ALTER TABLE scan_events ADD COLUMN uuid TEXT;
CREATE UNIQUE INDEX idx_scan_events_uuid ON scan_events(uuid);
