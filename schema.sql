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
    notes TEXT,
    image_url TEXT,
    type TEXT,
    cuisine TEXT,
    cost_for_two INTEGER,
    created_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000
);

-- Create Dishes Table
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    price_level INTEGER CHECK (price_level >= 1 AND price_level <= 4),
    review TEXT,
    image_url TEXT,
    cuisine TEXT,
    flavor_tags TEXT[]
);
