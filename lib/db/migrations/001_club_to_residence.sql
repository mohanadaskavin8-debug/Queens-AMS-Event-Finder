-- Migration: swap event category 'club' -> 'residence'
-- Applied: 2026-08-10
-- Safe to re-run (idempotent WHERE guard)
UPDATE events
SET category = 'residence'
WHERE category = 'club';
