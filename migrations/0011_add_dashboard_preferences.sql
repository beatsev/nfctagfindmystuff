-- Save user's preferred dashboard filter and sort as defaults
ALTER TABLE users ADD COLUMN default_filter TEXT NOT NULL DEFAULT 'all';
ALTER TABLE users ADD COLUMN default_sort TEXT NOT NULL DEFAULT 'recent_scan';
