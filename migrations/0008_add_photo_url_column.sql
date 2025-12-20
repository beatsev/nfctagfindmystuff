-- Migration: Add photo_url column to objects table
ALTER TABLE objects ADD COLUMN photo_url TEXT;
