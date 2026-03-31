-- Reset script for metadata lookups and existing option sync
-- This file intentionally replaces previous contents.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS restaurant_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cuisines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flavor_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure required dish metadata columns exist.
ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS cuisine TEXT;

ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS flavor_tags TEXT[];

-- Backfill dummy cuisine for all rows that are blank.
UPDATE dishes
SET cuisine = COALESCE(NULLIF(TRIM(cuisine), ''), 'Indian');

-- Backfill dummy flavor tags for all rows that are null/empty.
UPDATE dishes
SET flavor_tags = CASE
    WHEN cuisine ILIKE '%italian%' THEN ARRAY['cheesy', 'herby']
    WHEN cuisine ILIKE '%south%' THEN ARRAY['spicy', 'comfort']
    WHEN cuisine ILIKE '%chinese%' THEN ARRAY['savory', 'smoky']
    WHEN cuisine ILIKE '%gujarati%' THEN ARRAY['sweet', 'hearty']
    ELSE ARRAY['savory', 'mild']
END
WHERE flavor_tags IS NULL OR cardinality(flavor_tags) = 0;

-- Remove current lookup contents and rebuild from existing restaurant/dish data.
TRUNCATE TABLE restaurant_types RESTART IDENTITY;
TRUNCATE TABLE cuisines RESTART IDENTITY;
TRUNCATE TABLE flavor_tags RESTART IDENTITY;

INSERT INTO restaurant_types (name)
SELECT initcap(lower(trim(type)))::citext
FROM restaurants
WHERE type IS NOT NULL AND trim(type) <> ''
GROUP BY lower(trim(type))
ON CONFLICT (name) DO NOTHING;

INSERT INTO cuisines (name)
SELECT initcap(lower(trim(cuisine)))::citext
FROM restaurants
WHERE cuisine IS NOT NULL AND trim(cuisine) <> ''
GROUP BY lower(trim(cuisine))
ON CONFLICT (name) DO NOTHING;

INSERT INTO cuisines (name)
SELECT initcap(lower(trim(cuisine)))::citext
FROM dishes
WHERE cuisine IS NOT NULL AND trim(cuisine) <> ''
GROUP BY lower(trim(cuisine))
ON CONFLICT (name) DO NOTHING;

INSERT INTO flavor_tags (name)
SELECT lower(trim(tag))::citext
FROM dishes,
LATERAL unnest(coalesce(flavor_tags, ARRAY[]::text[])) AS tag
WHERE trim(tag) <> ''
GROUP BY lower(trim(tag))
ON CONFLICT (name) DO NOTHING;
