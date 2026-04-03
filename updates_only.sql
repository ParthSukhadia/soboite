-- Latest migration script to run on existing database.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Dish columns for pricing, recommendations, reviews, and photos.
ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS actual_price NUMERIC(10,2);

ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS photos JSONB;

ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS primary_photo_id TEXT;

ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE;

ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS review_date DATE;

ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS reviews JSONB;

UPDATE dishes
SET review_date = COALESCE(review_date, CURRENT_DATE)
WHERE review_date IS NULL
    AND COALESCE(NULLIF(TRIM(review), ''), '') <> '';

UPDATE dishes
SET reviews = jsonb_build_array(
    jsonb_build_object(
        'id', uuid_generate_v4()::text,
        'text', review,
        'date', to_char(COALESCE(review_date, CURRENT_DATE), 'YYYY-MM-DD'),
        'createdAt', (extract(epoch from now()) * 1000)::bigint
    )
)
WHERE (reviews IS NULL OR jsonb_typeof(reviews) <> 'array' OR jsonb_array_length(reviews) = 0)
    AND COALESCE(NULLIF(TRIM(review), ''), '') <> '';

-- Keep price levels in 3 tiers.
UPDATE dishes
SET price_level = 3
WHERE price_level > 3;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'dishes_price_level_1_to_3_check'
    ) THEN
        ALTER TABLE dishes
            ADD CONSTRAINT dishes_price_level_1_to_3_check
            CHECK (price_level IS NULL OR (price_level >= 1 AND price_level <= 3));
    END IF;
END $$;

-- Restaurant metrics, photos, and location fields.
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS ambience_rating SMALLINT;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS service_rating SMALLINT;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS photos JSONB;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS primary_photo_id TEXT;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS location_name TEXT;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS veg_only BOOLEAN DEFAULT FALSE;

UPDATE restaurants
SET ambience_rating = NULL
WHERE ambience_rating IS NOT NULL
    AND (ambience_rating < 1 OR ambience_rating > 5);

UPDATE restaurants
SET service_rating = NULL
WHERE service_rating IS NOT NULL
    AND (service_rating < 1 OR service_rating > 5);

UPDATE restaurants
SET location_name = NULLIF(split_part(TRIM(location_name), ' ', 1), '')
WHERE location_name IS NOT NULL;

UPDATE restaurants
SET veg_only = FALSE
WHERE veg_only IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurants_ambience_rating_check'
    ) THEN
        ALTER TABLE restaurants
            ADD CONSTRAINT restaurants_ambience_rating_check
            CHECK (ambience_rating IS NULL OR (ambience_rating >= 1 AND ambience_rating <= 5));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurants_service_rating_check'
    ) THEN
        ALTER TABLE restaurants
            ADD CONSTRAINT restaurants_service_rating_check
            CHECK (service_rating IS NULL OR (service_rating >= 1 AND service_rating <= 5));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurants_location_name ON restaurants(location_name);
