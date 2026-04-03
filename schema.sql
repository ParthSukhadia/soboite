-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

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
    image_url TEXT,
    photos JSONB,
    primary_photo_id TEXT,
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
    image_url TEXT,
    photos JSONB,
    primary_photo_id TEXT,
    is_recommended BOOLEAN DEFAULT FALSE,
    cuisine TEXT,
    flavor_tags TEXT[]
);
