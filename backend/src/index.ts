// backend/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createSupabaseClient } from '../lib/supabase'

const app = new Hono()
const getSupabase = (c: any) => createSupabaseClient(c.env)

const normalizeRequestBody = (body: any) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  return Object.entries(body).reduce((acc, [key, value]) => {
    const normalizedKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    acc[normalizedKey] = value
    return acc
  }, {} as Record<string, any>)
}

// Enable CORS for frontend requests
app.use('*', cors({
  origin: (origin) => origin || null,
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Root route for dev server
app.get('/', (c) => c.text('Supabase backend running. Use /health or /api/* endpoints.'))

// Health check
app.get('/health', (c) => c.text('OK'))

// Example: Get all restaurants (replace with your actual schema)
app.get('/api/restaurants', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('restaurants_with_likes').select('id, name, lat, lng, location_name, address, veg_only, notes, photos, primary_photo_id, image_storage_url, type, cuisine, cost_for_two, ambience_rating, service_rating, created_at, like_count')
  if (error) return c.json({ error: error.message }, 500)
return c.json(data);
})

// Get all dishes
app.get('/api/dishes', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('dishes_with_likes').select('id, name, restaurant_id, rating, price_level, actual_price, review, review_date, is_recommended, cuisine, flavor_tags, photos, primary_photo_id, image_storage_url, like_count')
  if (error) return c.json({ error: error.message }, 500)
return c.json(data);
})

// Get reference data
app.get('/api/restaurant-types', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('restaurant_types').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.get('/api/cuisines', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('cuisines').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.get('/api/flavor-tags', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('flavor_tags').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Placeholder for Google OAuth callback (to be implemented later)
app.get('/auth/google/callback', (c) => {
  // TODO: exchange code for token, set session cookie, etc.
  return c.text('Google OAuth callback - not implemented')
})

// CRUD for restaurants
app.post('/api/restaurants', async (c) => {
  const supabase = getSupabase(c);
  const body = normalizeRequestBody(await c.req.json());
  const { error, data } = await supabase.from('restaurants').insert(body);
  if (error) return c.json({ error: error.message }, 500);
  // Return inserted rows without selecting missing columns
  return c.json(data);
});

app.put('/api/restaurants/:id', async (c) => {
  const supabase = getSupabase(c)
  const id = c.req.param('id');
  const updates = normalizeRequestBody(await c.req.json());
  const { error, data } = await supabase.from('restaurants').update(updates).eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  // Return updated row without selecting missing columns
  return c.json(data?.[0] ?? {});
});

app.delete('/api/restaurants/:id', async (c) => {
  const supabase = getSupabase(c)
  const id = c.req.param('id');
  const { error } = await supabase.from('restaurants').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.text('Deleted');
});

// CRUD for dishes
app.post('/api/dishes', async (c) => {
  const supabase = getSupabase(c)
  let body = normalizeRequestBody(await c.req.json())
  const { error, data } = await supabase.from('dishes').insert(body)
  if (error) return c.json({ error: error.message }, 500)
  // Return inserted row without selecting missing columns
  return c.json(data?.[0] ?? {})
});

app.put('/api/dishes/:id', async (c) => {
  const supabase = getSupabase(c)
  const id = c.req.param('id')
  let updates = normalizeRequestBody(await c.req.json())
  const { error, data } = await supabase.from('dishes').update(updates).eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  // Return updated row without selecting missing columns
  return c.json(data?.[0] ?? {})
});

app.delete('/api/dishes/:id', async (c) => {
  const supabase = getSupabase(c)
  const id = c.req.param('id');
  const { error } = await supabase.from('dishes').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.text('Deleted');
});

// Upsert reference data
app.post('/api/restaurant-types', async (c) => {
  const supabase = getSupabase(c)
  const { name } = await c.req.json();
  const { error, data } = await supabase.from('restaurant_types').upsert({ name }, { onConflict: 'name' }).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post('/api/cuisines', async (c) => {
  const supabase = getSupabase(c)
  const { name } = await c.req.json();
  const { error, data } = await supabase.from('cuisines').upsert({ name }, { onConflict: 'name' }).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post('/api/flavor-tags', async (c) => {
  const supabase = getSupabase(c)
  const { name } = await c.req.json();
  const { error, data } = await supabase.from('flavor_tags').upsert({ name }, { onConflict: 'name' }).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Top Picks Endpoints
app.get('/api/top-picks', async (c) => {
  const supabase = getSupabase(c);
  const { data: categories, error: catError } = await supabase.from('top_pick_categories').select('*').order('created_at', { ascending: true });
  if (catError) return c.json({ error: catError.message }, 500);

  const { data: restaurants, error: restError } = await supabase.from('top_pick_restaurants').select('*').order('position', { ascending: true });
  if (restError) return c.json({ error: restError.message }, 500);

  return c.json({ categories, restaurants });
});

app.post('/api/top-picks/categories', async (c) => {
  const supabase = getSupabase(c);
  const { name } = await c.req.json();
  const { data, error } = await supabase.from('top_pick_categories').insert({ name }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.put('/api/top-picks/categories/:id', async (c) => {
  const supabase = getSupabase(c);
  const id = c.req.param('id');
  const { name } = await c.req.json();
  const { data, error } = await supabase.from('top_pick_categories').update({ name }).eq('id', id).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete('/api/top-picks/categories/:id', async (c) => {
  const supabase = getSupabase(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('top_pick_categories').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

app.post('/api/top-picks/categories/:id/restaurants', async (c) => {
  const supabase = getSupabase(c);
  const id = c.req.param('id');
  const { restaurantIds } = await c.req.json();

  await supabase.from('top_pick_restaurants').delete().eq('category_id', id);

  if (restaurantIds && restaurantIds.length > 0) {
    const inserts = restaurantIds.map((restId: string, idx: number) => ({
      category_id: id,
      restaurant_id: restId,
      position: idx,
    }));
    const { error } = await supabase.from('top_pick_restaurants').insert(inserts);
    if (error) return c.json({ error: error.message }, 500);
  }
  return c.json({ success: true });
});

// Get restaurant photos (placeholder)
app.get('/api/restaurant-photos/:id', async (c) => {
  // TODO: implement actual photo fetching logic
  return c.json({ restaurant: null, dishes: [] });
});

// Note: getRestaurantPhotos endpoint can be added later.

// Image upload endpoint
app.post('/api/upload-image', async (c) => {
  const supabase = getSupabase(c);
  const body = await c.req.json();
  const dataUrl = body.dataUrl;

  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return c.json({ error: 'Invalid data URL' }, 400);
  }

  try {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const fileExt = mimeType.split('/')[1] || 'jpg';
    
    // Decode base64 to Uint8Array
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error } = await supabase.storage
      .from('soboite')
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('soboite')
      .getPublicUrl(filePath);

    return c.json({ image_storage_url: data.publicUrl });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin endpoints
app.get('/api/export', async (c) => {
  const supabase = getSupabase(c);
  const tables = ['restaurant_types', 'cuisines', 'flavor_tags', 'restaurants', 'dishes'];
  const tableResults = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*');
      return { table, data, error };
    })
  );
  
  const firstError = tableResults.find(r => r.error);
  if (firstError) return c.json({ error: firstError.error?.message }, 500);

  const exportData: Record<string, any[]> = {};
  tableResults.forEach(r => {
    exportData[r.table] = r.data || [];
  });
  return c.json(exportData);
});

app.post('/api/clear-table', async (c) => {
  const supabase = getSupabase(c);
  const { tableName, idColumn = 'id' } = await c.req.json();
  
  const { data, error } = await supabase.from(tableName).select(idColumn);
  if (error) return c.json({ error: error.message }, 500);
  
  const ids = (data ?? []).map((row: any) => row[idColumn]).filter(Boolean);
  if (ids.length === 0) return c.json({ success: true, deleted: 0 });
  
  const chunkArray = (arr: any[], size: number) => {
    const res = [];
    for(let i=0; i<arr.length; i+=size) res.push(arr.slice(i, i+size));
    return res;
  };
  
  for (const chunk of chunkArray(ids, 500)) {
    const { error: delErr } = await (supabase as any).from(tableName).delete().in(idColumn, chunk);
    if (delErr) return c.json({ error: delErr.message }, 500);
  }
  return c.json({ success: true, deleted: ids.length });
});

app.post('/api/import-table', async (c) => {
  const supabase = getSupabase(c);
  const { tableName, rows, upsertKey } = await c.req.json();
  
  if (!rows || rows.length === 0) return c.json({ success: true, imported: 0 });
  
  const chunkArray = (arr: any[], size: number) => {
    const res = [];
    for(let i=0; i<arr.length; i+=size) res.push(arr.slice(i, i+size));
    return res;
  };
  
  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await (supabase as any).from(tableName).upsert(chunk, { onConflict: upsertKey });
    if (error) return c.json({ error: error.message }, 500);
  }
  return c.json({ success: true, imported: rows.length });
});

// --- Device-based Auth & Likes Endpoints ---
app.post('/api/users', async (c) => {
  const supabase = getSupabase(c);
  const { deviceId, firstName, lastName } = await c.req.json();
  
  if (!deviceId || !firstName) return c.json({ error: 'Missing required fields' }, 400);

  const { data, error } = await supabase
    .from('users')
    .upsert({ device_id: deviceId, first_name: firstName, last_name: lastName }, { onConflict: 'device_id' })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.get('/api/users/:device_id/likes', async (c) => {
  const supabase = getSupabase(c);
  const deviceId = c.req.param('device_id');

  // First get the user id
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('device_id', deviceId)
    .single();

  if (userError || !user) return c.json({ error: userError?.message || 'User not found' }, 404);

  const { data: restLikes, error: restError } = await supabase
    .from('restaurant_likes')
    .select('restaurant_id, is_like')
    .eq('user_id', user.id);

  if (restError) return c.json({ error: restError.message }, 500);

  const { data: dishLikes, error: dishError } = await supabase
    .from('dish_likes')
    .select('dish_id, is_like')
    .eq('user_id', user.id);

  if (dishError) return c.json({ error: dishError.message }, 500);

  return c.json({
    restaurants: restLikes,
    dishes: dishLikes
  });
});

app.post('/api/restaurants/:id/like', async (c) => {
  const supabase = getSupabase(c);
  const restaurantId = c.req.param('id');
  const { deviceId, isLike } = await c.req.json();

  if (!deviceId || (typeof isLike !== 'boolean' && isLike !== null)) return c.json({ error: 'Missing fields' }, 400);

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('device_id', deviceId)
    .single();

  if (userError || !user) return c.json({ error: 'User not found' }, 404);

  if (isLike === null) {
    const { error } = await supabase.from('restaurant_likes').delete().match({ user_id: user.id, restaurant_id: restaurantId });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, removed: true });
  }

  const { data, error } = await supabase
    .from('restaurant_likes')
    .upsert(
      { user_id: user.id, restaurant_id: restaurantId, is_like: isLike },
      { onConflict: 'user_id, restaurant_id' }
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post('/api/dishes/:id/like', async (c) => {
  const supabase = getSupabase(c);
  const dishId = c.req.param('id');
  const { deviceId, isLike } = await c.req.json();

  if (!deviceId || (typeof isLike !== 'boolean' && isLike !== null)) return c.json({ error: 'Missing fields' }, 400);

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('device_id', deviceId)
    .single();

  if (userError || !user) return c.json({ error: 'User not found' }, 404);

  if (isLike === null) {
    const { error } = await supabase.from('dish_likes').delete().match({ user_id: user.id, dish_id: dishId });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, removed: true });
  }

  const { data, error } = await supabase
    .from('dish_likes')
    .upsert(
      { user_id: user.id, dish_id: dishId, is_like: isLike },
      { onConflict: 'user_id, dish_id' }
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.get('/api/restaurants/:id/likes', async (c) => {
  const supabase = getSupabase(c);
  const restaurantId = c.req.param('id');
  const { data, error } = await supabase
    .from('restaurant_likes')
    .select('users(first_name, last_name)')
    .eq('restaurant_id', restaurantId)
    .eq('is_like', true);
  
  if (error) return c.json({ error: error.message }, 500);
  
  const names = (data || []).map((row: any) => 
    `${row.users?.first_name || ''} ${row.users?.last_name || ''}`.trim()
  ).filter(Boolean);
  
  return c.json({ names });
});

app.get('/api/dishes/:id/likes', async (c) => {
  const supabase = getSupabase(c);
  const dishId = c.req.param('id');
  const { data, error } = await supabase
    .from('dish_likes')
    .select('users(first_name, last_name)')
    .eq('dish_id', dishId)
    .eq('is_like', true);
  
  if (error) return c.json({ error: error.message }, 500);
  
  const names = (data || []).map((row: any) => 
    `${row.users?.first_name || ''} ${row.users?.last_name || ''}`.trim()
  ).filter(Boolean);
  
  return c.json({ names });
});

export default app;
