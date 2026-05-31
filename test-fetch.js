import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dfdohjlpfrnstqjyakfp.supabase.co',
  'sb_publishable_F1qIUw3Epj6IgG00XoniNA_IWgkP4yH'
);

const cols = [
  'id', 'restaurant_id', 'name', 'rating', 'price_level', 'actual_price', 
  'review', 'review_date', 'reviews', 'image_url', 'photos', 'primary_photo_id', 
  'is_recommended', 'cuisine', 'flavor_tags'
];

async function run() {
  let safeCols = ['id'];
  for (const col of cols) {
    if (col === 'id') continue;
    const testCols = [...safeCols, col].join(',');
    const t1 = Date.now();
    const res = await supabase.from('dishes').select(testCols);
    const duration = Date.now() - t1;
    if (res.error) {
      console.log(`Failed when adding ${col}:`, res.error.message);
    } else {
      console.log(`Success with ${col} (${duration}ms)`);
      safeCols.push(col);
    }
  }
  console.log("Safe columns:", safeCols.join(','));
}

run();
