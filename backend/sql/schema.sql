-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS vector;


-- Lookup tables for normalized options
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

-- Create Restaurants Table
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    lat FLOAT8 NOT NULL,
    lng FLOAT8 NOT NULL,
    location_name TEXT,
    address TEXT,
    veg_only BOOLEAN DEFAULT FALSE,
    notes TEXT,
    image_storage_url TEXT,
    photos JSONB,
    primary_photo_id TEXT,
    instagram_caption TEXT,
    type TEXT,
    cuisine TEXT,
    cost_for_two INTEGER,
    ambience_rating SMALLINT CHECK (ambience_rating >= 1 AND ambience_rating <= 5),
    service_rating SMALLINT CHECK (service_rating >= 1 AND service_rating <= 5),
    created_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000
);

-- Create Dishes Table
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    price_level INTEGER CHECK (price_level >= 1 AND price_level <= 3),
    actual_price NUMERIC(10,2),
    review TEXT,
    review_date DATE,
    reviews JSONB,
    image_storage_url TEXT,
    photos JSONB,
    primary_photo_id TEXT,
    is_recommended BOOLEAN DEFAULT FALSE,
    cuisine TEXT,
    flavor_tags TEXT[],
    serves TEXT,
    pros TEXT[],
    cons TEXT[],
    rank INTEGER,
    summary TEXT,
    verdict TEXT,
    embedding vector(3072)
);

-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Restaurant Likes Table
CREATE TABLE IF NOT EXISTS restaurant_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    is_like BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, restaurant_id)
);

-- Create Dish Likes Table
CREATE TABLE IF NOT EXISTS dish_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
    is_like BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, dish_id)
);

-- Create views for fetching aggregated likes
CREATE OR REPLACE VIEW restaurants_with_likes AS
SELECT r.*,
       (SELECT COUNT(*) FROM restaurant_likes rl WHERE rl.restaurant_id = r.id AND rl.is_like = true) AS like_count
FROM restaurants r;

CREATE OR REPLACE VIEW dishes_with_likes AS
SELECT d.*, (SELECT COUNT(*) FROM dish_likes dl WHERE dl.dish_id = d.id AND dl.is_like = true) AS like_count 
FROM dishes d;

-- RPC for Vector Similarity Search on Dishes
CREATE OR REPLACE FUNCTION match_dishes(
    query_embedding vector(3072),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    restaurant_id uuid,
    name text,
    similarity float,
    rag_context text
)
LANGUAGE sql STABLE
AS $$
    SELECT
        id,
        restaurant_id,
        name,
        1 - (embedding <=> query_embedding) AS similarity,
        'Dish: ' || name || CHR(10) || 
        'Summary: ' || COALESCE(summary, '') || CHR(10) ||
        'Pros: ' || COALESCE(array_to_string(pros, ', '), '') || CHR(10) ||
        'Cons: ' || COALESCE(array_to_string(cons, ', '), '') || CHR(10) ||
        'Verdict: ' || COALESCE(verdict, '') AS rag_context
    FROM dishes
    WHERE embedding IS NOT NULL AND 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Create Top Pick Categories
CREATE TABLE IF NOT EXISTS top_pick_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Top Pick Restaurants
CREATE TABLE IF NOT EXISTS top_pick_restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES top_pick_categories(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(category_id, restaurant_id)
);
