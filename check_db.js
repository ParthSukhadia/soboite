import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfdohjlpfrnstqjyakfp.supabase.co';
const supabaseKey = 'sb_publishable_F1qIUw3Epj6IgG00XoniNA_IWgkP4yH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: rests, error: err1 } = await supabase.from('restaurants').select('*');
  const { data: dishes, error: err2 } = await supabase.from('dishes').select('*');
  console.log("Rests:", rests ? rests.length : 0);
  if (rests && rests.length > 0) {
    console.log("First rest:", rests[0]);
  }
  console.log("Dishes:", dishes ? dishes.length : 0);
  if (dishes && dishes.length > 0) {
    console.log("First dish:", dishes[0]);
  }
}
check();
