-- Remove non-veg restaurants (and their dishes via ON DELETE CASCADE)
DELETE FROM restaurants
WHERE id IN (
  '77777777-7777-7777-7777-777777777777', -- Trishna (Seafood)
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Bagdadi Restaurant (Mughlai)
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'  -- Bademiya (Mughlai)
);

-- Replace non-veg dishes with veg versions
UPDATE dishes
SET name = 'Paneer Bhurji Pav',
    review = 'Soft pav with spicy paneer bhurji.',
    image_url = 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800'
WHERE name = 'Kheema Pav';

UPDATE dishes
SET name = 'Veg Dhansak',
    review = 'Lentils with seasonal veggies and rice.',
    image_url = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800'
WHERE name = 'Chicken Dhansak';

UPDATE dishes
SET name = 'Veg Burger',
    review = 'Crisp veg patty with house sauce.',
    image_url = 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&q=80&w=800'
WHERE name = 'Chicken Burger';

-- Remove any remaining non-veg dishes by name pattern
DELETE FROM dishes
WHERE name ILIKE '%chicken%'
   OR name ILIKE '%kebab%'
   OR name ILIKE '%prawn%'
   OR name ILIKE '%crab%'
   OR name ILIKE '%mutton%'
   OR name ILIKE '%fish%';

-- Fix restaurant images that were broken
UPDATE restaurants
SET image_url = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800'
WHERE name = 'Pizza By The Bay';

UPDATE restaurants
SET image_url = 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&q=80&w=800'
WHERE name = 'B. Merwan & Co.';
