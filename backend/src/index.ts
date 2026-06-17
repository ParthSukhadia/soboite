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
      .from('images')
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return c.json({ url: data.publicUrl });
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

export default app;
