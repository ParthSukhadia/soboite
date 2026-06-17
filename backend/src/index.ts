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
  const { data, error } = await supabase.from('restaurants').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Get all dishes
app.get('/api/dishes', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('dishes').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
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
  const supabase = getSupabase(c)
  const body = normalizeRequestBody(await c.req.json());
  const { error, data } = await supabase.from('restaurants').insert(body).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(Array.isArray(data) ? data[0] : data);
});

app.put('/api/restaurants/:id', async (c) => {
  const supabase = getSupabase(c)
  const id = c.req.param('id');
  const updates = normalizeRequestBody(await c.req.json());
  const { error, data } = await supabase.from('restaurants').update(updates).eq('id', id).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(Array.isArray(data) ? data[0] : data);
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
  const body = normalizeRequestBody(await c.req.json());
  const { error, data } = await supabase.from('dishes').insert(body).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(Array.isArray(data) ? data[0] : data);
});

app.put('/api/dishes/:id', async (c) => {
  const supabase = getSupabase(c)
  const id = c.req.param('id');
  const updates = normalizeRequestBody(await c.req.json());
  const { error, data } = await supabase.from('dishes').update(updates).eq('id', id).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(Array.isArray(data) ? data[0] : data);
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

// Get restaurant photos (placeholder)
app.get('/api/restaurant-photos/:id', async (c) => {
  // TODO: implement actual photo fetching logic
  return c.json({ restaurant: null, dishes: [] });
});

// Note: getRestaurantPhotos endpoint can be added later.

export default app;
