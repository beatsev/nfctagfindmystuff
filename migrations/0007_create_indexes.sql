-- Create performance indexes
CREATE INDEX idx_objects_user_id ON objects(user_id);
CREATE INDEX idx_tags_object_id ON tags(object_id);
CREATE INDEX idx_tags_active ON tags(active) WHERE active = 1;
CREATE INDEX idx_scan_events_tag_id ON scan_events(tag_id);
CREATE INDEX idx_scan_events_object_id ON scan_events(object_id);
CREATE INDEX idx_scan_events_ts ON scan_events(ts DESC);
CREATE INDEX idx_finder_messages_object_id ON finder_messages(object_id);
CREATE INDEX idx_finder_messages_scan_event_id ON finder_messages(scan_event_id);
