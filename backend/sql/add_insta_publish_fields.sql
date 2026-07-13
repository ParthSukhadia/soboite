-- Add Instagram tracking fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS insta_published BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS insta_published_at TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS insta_edited_photo_url TEXT;

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS insta_published BOOLEAN DEFAULT FALSE;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS insta_published_at TIMESTAMPTZ;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS insta_edited_photo_url TEXT;

DROP VIEW IF EXISTS restaurants_with_likes;
CREATE OR REPLACE VIEW restaurants_with_likes AS
SELECT r.*,
       (SELECT COUNT(*) FROM restaurant_likes rl WHERE rl.restaurant_id = r.id AND rl.is_like = true) AS like_count
FROM restaurants r;

DROP VIEW IF EXISTS dishes_with_likes;
CREATE OR REPLACE VIEW dishes_with_likes AS
SELECT d.*,
       (SELECT COUNT(*) FROM dish_likes dl WHERE dl.dish_id = d.id AND dl.is_like = true) AS like_count
FROM dishes d;
