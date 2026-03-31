-- Insert Restaurants
INSERT INTO restaurants (id, name, lat, lng, notes, image_url, type, cuisine, cost_for_two, created_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Kyani & Co.', 18.9442, 72.8276, 'Historic Irani cafe famous for bun maska and kheema.', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=800', 'Cafe', 'Parsi', 600, 1711880000000),
    ('22222222-2222-2222-2222-222222222222', 'Sassanian Boulangerie', 18.9431, 72.8265, 'Great dhansak and baked goods. Very old-school vibe.', 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=800', 'Bakery', 'Parsi', 700, 1711880000000),
    ('33333333-3333-3333-3333-333333333333', 'Kailash Parbat', 18.9415, 72.8285, 'Iconic street food and Sindhi delicacies.', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=800', 'Casual Dining', 'North Indian', 800, 1711880000000),
    ('44444444-4444-4444-4444-444444444444', 'Cafe Ideal', 18.9419, 72.8251, 'Cozy spot overlooking the street, great Irani chai.', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800', 'Cafe', 'Irani', 500, 1711880000000),
    ('55555555-5555-5555-5555-555555555555', 'B. Merwan & Co.', 18.9402, 72.8259, 'Legendary Mawa cakes, usually sold out by morning.', 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&q=80&w=800', 'Bakery', 'Parsi', 400, 1711880000000);

-- Insert Dishes
INSERT INTO dishes (restaurant_id, name, rating, price_level, review, image_url, cuisine, flavor_tags)
VALUES 
    -- Kyani & Co
    ('11111111-1111-1111-1111-111111111111', 'Bun Maska', 5, 1, 'Absolutely buttery and melts in your mouth!', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800', 'Parsi', ARRAY['buttery', 'sweet']),
    ('11111111-1111-1111-1111-111111111111', 'Paneer Bhurji Pav', 4, 2, 'Spicy paneer bhurji in soft pav.', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800', 'Parsi', ARRAY['spicy', 'savory']),
    
    -- Sassanian
    ('22222222-2222-2222-2222-222222222222', 'Veg Dhansak', 5, 2, 'Lentils with seasonal veggies and rice.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800', 'Parsi', ARRAY['hearty', 'tangy']),
    
    -- Kailash Parbat
    ('33333333-3333-3333-3333-333333333333', 'Pani Puri', 5, 1, 'Hygienic and incredibly tasty standard for Mumbai chaat.', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=800', 'North Indian', ARRAY['tangy', 'spicy']),
    ('33333333-3333-3333-3333-333333333333', 'Chole Bhature', 4, 2, 'Rich and heavy, perfect weekend brunch.', 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&q=80&w=800', 'North Indian', ARRAY['rich', 'hearty']),
    
    -- Cafe Ideal
    ('44444444-4444-4444-4444-444444444444', 'Irani Chai', 4, 1, 'Sweet, milky, and nostalgic.', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800', 'Irani', ARRAY['milky', 'sweet']),
    
    -- B. Merwan
    ('55555555-5555-5555-5555-555555555555', 'Mawa Cake', 5, 1, 'The best in the city. You have to arrive by 8 AM to get them.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800', 'Parsi', ARRAY['sweet', 'rich']);

-- Optional updates if existing rows were inserted before adding new columns
UPDATE restaurants SET type = 'Cafe', cuisine = 'Parsi', cost_for_two = 600 WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE restaurants SET type = 'Bakery', cuisine = 'Parsi', cost_for_two = 700 WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE restaurants SET type = 'Casual Dining', cuisine = 'North Indian', cost_for_two = 800 WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE restaurants SET type = 'Cafe', cuisine = 'Irani', cost_for_two = 500 WHERE id = '44444444-4444-4444-4444-444444444444';
UPDATE restaurants SET type = 'Bakery', cuisine = 'Parsi', cost_for_two = 400 WHERE id = '55555555-5555-5555-5555-555555555555';

UPDATE dishes SET image_url = 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800', cuisine = 'Parsi', flavor_tags = ARRAY['buttery', 'sweet'] WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' AND name = 'Bun Maska';
UPDATE dishes SET image_url = 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800', cuisine = 'Parsi', flavor_tags = ARRAY['spicy', 'savory'] WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' AND name = 'Paneer Bhurji Pav';
UPDATE dishes SET image_url = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800', cuisine = 'Parsi', flavor_tags = ARRAY['hearty', 'tangy'] WHERE restaurant_id = '22222222-2222-2222-2222-222222222222' AND name = 'Veg Dhansak';
UPDATE dishes SET image_url = 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=800', cuisine = 'North Indian', flavor_tags = ARRAY['tangy', 'spicy'] WHERE restaurant_id = '33333333-3333-3333-3333-333333333333' AND name = 'Pani Puri';
UPDATE dishes SET image_url = 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&q=80&w=800', cuisine = 'North Indian', flavor_tags = ARRAY['rich', 'hearty'] WHERE restaurant_id = '33333333-3333-3333-3333-333333333333' AND name = 'Chole Bhature';
UPDATE dishes SET image_url = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800', cuisine = 'Irani', flavor_tags = ARRAY['milky', 'sweet'] WHERE restaurant_id = '44444444-4444-4444-4444-444444444444' AND name = 'Irani Chai';
UPDATE dishes SET image_url = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800', cuisine = 'Parsi', flavor_tags = ARRAY['sweet', 'rich'] WHERE restaurant_id = '55555555-5555-5555-5555-555555555555' AND name = 'Mawa Cake';

-- More restaurants (different cuisines/types)
INSERT INTO restaurants (id, name, lat, lng, notes, image_url, type, cuisine, cost_for_two, created_at)
VALUES
    ('66666666-6666-6666-6666-666666666666', 'Pizza By The Bay', 18.9449, 72.8237, 'Sea-facing pizza and pasta spot on Marine Drive.', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800', 'Casual Dining', 'Italian', 1400, 1711880000000),
    ('88888888-8888-8888-8888-888888888888', 'China Gate', 18.9226, 72.8323, 'Classic Indo-Chinese with family-style portions.', 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&q=80&w=800', 'Casual Dining', 'Chinese', 1200, 1711880000000),
    ('99999999-9999-9999-9999-999999999999', 'Sunlight Restaurant', 18.9216, 72.8326, 'Old-school South Indian spot for dosas and filter coffee.', 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&q=80&w=800', 'Casual Dining', 'South Indian', 600, 1711880000000),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Leopold Cafe', 18.9221, 72.8310, 'Iconic cafe-bar with continental comfort food.', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=800', 'Cafe', 'Continental', 1500, 1711880000000),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Shree Thaker Bhojanalay', 18.9516, 72.8271, 'Classic Gujarati thali in Kalbadevi.', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800', 'Casual Dining', 'Gujarati', 700, 1711880000000),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Pancham Puriwala', 18.9502, 72.8321, 'Famous puri-bhaji spot in Kalbadevi.', 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&q=80&w=800', 'Quick Bites', 'North Indian', 500, 1711880000000),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Tiwari Bros. Mithai', 18.9554, 72.8151, 'Popular Girgaon sweets and snacks.', 'https://images.unsplash.com/photo-1505253216365-0b77b8d6b164?auto=format&fit=crop&q=80&w=800', 'Sweet Shop', 'Indian', 400, 1711880000000);

-- Dishes for new restaurants
INSERT INTO dishes (restaurant_id, name, rating, price_level, review, image_url, cuisine, flavor_tags)
VALUES
    ('66666666-6666-6666-6666-666666666666', 'Margherita Pizza', 4, 3, 'Thin crust, classic tomato and basil.', 'https://images.unsplash.com/photo-1548365328-8b849e6b4e45?auto=format&fit=crop&q=80&w=800', 'Italian', ARRAY['cheesy', 'tangy']),
    ('66666666-6666-6666-6666-666666666666', 'Penne Alfredo', 4, 3, 'Creamy and comforting pasta.', 'https://images.unsplash.com/photo-1521389508051-d7ffb5dc8c48?auto=format&fit=crop&q=80&w=800', 'Italian', ARRAY['creamy', 'rich']),

    ('88888888-8888-8888-8888-888888888888', 'Hakka Noodles', 4, 2, 'Smoky wok-tossed noodles.', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&q=80&w=800', 'Chinese', ARRAY['smoky', 'savory']),
    ('88888888-8888-8888-8888-888888888888', 'Veg Manchurian', 4, 2, 'Crispy balls in a tangy gravy.', 'https://images.unsplash.com/photo-1562967916-eb82221dfb36?auto=format&fit=crop&q=80&w=800', 'Chinese', ARRAY['tangy', 'crispy']),

    ('99999999-9999-9999-9999-999999999999', 'Masala Dosa', 5, 1, 'Golden crisp dosa with spiced potato.', 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d44?auto=format&fit=crop&q=80&w=800', 'South Indian', ARRAY['crispy', 'spicy']),
    ('99999999-9999-9999-9999-999999999999', 'Filter Coffee', 4, 1, 'Strong, frothy South Indian coffee.', 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=800', 'South Indian', ARRAY['strong', 'sweet']),

    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Veg Burger', 4, 2, 'Crisp veg patty with house sauce.', 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&q=80&w=800', 'Continental', ARRAY['savory', 'hearty']),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Irish Coffee', 4, 2, 'Coffee with a creamy finish.', 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=800', 'Continental', ARRAY['creamy', 'sweet']),
    
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gujarati Thali', 5, 2, 'Full thali with farsan, kadhi, and desserts.', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800', 'Gujarati', ARRAY['hearty', 'sweet']),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Khichdi Kadhi', 4, 1, 'Comforting khichdi with tangy kadhi.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800', 'Gujarati', ARRAY['comfort', 'tangy']),

    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Puri Bhaji', 5, 1, 'Crisp puris with spicy potato bhaji.', 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&q=80&w=800', 'North Indian', ARRAY['spicy', 'savory']),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Kachori', 4, 1, 'Flaky kachori with chutney.', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=800', 'North Indian', ARRAY['flaky', 'spicy']),

    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Kaju Katli', 5, 1, 'Classic cashew fudge.', 'https://images.unsplash.com/photo-1505253216365-0b77b8d6b164?auto=format&fit=crop&q=80&w=800', 'Indian', ARRAY['sweet', 'rich']),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Dhokla', 4, 1, 'Soft, savory dhokla with chutney.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800', 'Indian', ARRAY['savory', 'tangy']);
