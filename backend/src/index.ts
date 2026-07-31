// backend/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createSupabaseClient } from '../lib/supabase'
import { Zernio } from '@zernio/node'
import { GoogleGenAI, Type } from '@google/genai'
const app = new Hono()

app.onError((err, c) => {
  console.error(`[GLOBAL ERROR] ${c.req.method} ${c.req.url}`, err);
  return c.json({ error: 'Something went wrong', details: err.message }, 500);
});

app.use('*', async (c, next) => {
  await next()
  if (c.res.status === 500) {
    const res = c.res.clone()
    let errorDetail = ''
    try {
      errorDetail = await res.text()
    } catch (e) { }
    console.error(`[500 ERROR] ${c.req.method} ${c.req.url} -`, errorDetail)
  }
})
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

app.get('/api/events', async (c) => {
  const supabase = getSupabase(c);
  const { data, error } = await supabase.from('app_events').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Example: Get all restaurants (replace with your actual schema)
app.get('/api/restaurants', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('restaurants_with_likes').select('id, name, lat, lng, location_name, address, veg_only, notes, photos, primary_photo_id, image_storage_url, type, cuisine, cost_for_two, ambience_rating, service_rating, created_at, like_count, insta_published, insta_published_at, insta_edited_photo_url')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data);
})

// Get all dishes
app.get('/api/dishes', async (c) => {
  const supabase = getSupabase(c)
  const { data, error } = await supabase.from('dishes_with_likes').select('id, name, restaurant_id, rating, price_level, actual_price, serves, review, review_date, is_recommended, cuisine, flavor_tags, photos, primary_photo_id, image_storage_url, like_count, pros, cons, summary, verdict, rank, insta_published, insta_published_at, insta_edited_photo_url')
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

// Voice import
app.post('/api/text-import', async (c) => {
  try {
    const { text } = await c.req.json();
    if (!text) {
      return c.json({ error: 'No text provided' }, 400);
    }

    const ai = new GoogleGenAI({ apiKey: (c.env as any).GEMINI_API_KEY });

    const prompt = `
      You are an assistant helping extract structured data from a user's text note about a restaurant visit.
      Read the text carefully. 
      1. Identify the restaurant name.
      2. Use Google Search to find the EXACT address, latitude, and longitude for this restaurant. (assume the city is what the user mentions or context). If you find multiple, pick the most likely one based on context.
      3. Identify the overall price level (1=cheap, 2=moderate, 3=expensive) and rating (1-5 stars) for the restaurant if mentioned.
      4. Extract any specific dishes mentioned, along with their ratings and reviews.
      
      Return ONLY valid JSON.
      
      User's Text:
      ${text}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            address: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            priceLevel: { type: Type.NUMBER },
            review: { type: Type.STRING },
            rating: { type: Type.NUMBER },
            cuisine: { type: Type.STRING },
            serves: { type: Type.STRING },
            dishes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  rating: { type: Type.NUMBER },
                  review: { type: Type.STRING },
                  priceLevel: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    return c.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Text import error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// CRUD for restaurants
app.post('/api/restaurants', async (c) => {
  const supabase = getSupabase(c);
  const body = normalizeRequestBody(await c.req.json());
  if (!body.created_at) {
    body.created_at = Date.now();
  }

  console.log("PAYLOAD TO SUPABASE (restaurants):", JSON.stringify(body, null, 2));

  const { error, data } = await supabase.from('restaurants').insert(body).select();
  if (error) {
    console.error('Supabase insert error for restaurants:', JSON.stringify(error, null, 2));
    return c.json({ error: `Error: ${error.message}; reference = ${error.details || error.hint || JSON.stringify(error)}` }, 500);
  }

  if (data && data.length > 0) {
    const resto = data[0];
    await supabase.from('app_events').insert({
      type: 'RESTO_ADDED',
      message: `New restaurant added: ${resto.name}`,
      link_url: `/restaurant/${resto.id}`
    });
  }

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

async function generateDishEmbedding(apiKey: string, dishData: any, restaurantName: string = '') {
  try {
    const genAI = new GoogleGenAI({ apiKey });
    const ragContext = `Restaurant:\n${restaurantName || 'Unknown'}\n\nDish:\n${dishData.name || 'Unknown'}\n\nSummary:\n${dishData.summary || ''}\n\nPros:\n${(dishData.pros || []).join('\n')}\n\nCons:\n${(dishData.cons || []).join('\n')}\n\nKeywords:\n${dishData.cuisine || ''}\n${(dishData.flavor_tags || dishData.tags || []).join('\n')}`;

    const response = await genAI.models.embedContent({
      model: 'gemini-embedding-2',
      contents: ragContext
    });
    
    let values = null;
    if ((response as any).embeddings && (response as any).embeddings.length > 0) {
      values = (response as any).embeddings[0].values;
    } else if ((response as any).embedding && (response as any).embedding.values) {
      values = (response as any).embedding.values;
    } else if (Array.isArray(response) && response[0]?.values) {
      values = response[0].values;
    }
    
    if (values) {
      console.log(`[EMBEDDING GENERATED & SAVED] For dish: "${dishData.name}" | Restaurant: "${restaurantName}" | Dimension: ${values.length}`);
      return { embedding: JSON.stringify(values) };
    }
    return null;
  } catch (err) {
    console.error("Failed to generate embedding", err);
    return null;
  }
}

// CRUD for dishes
app.post('/api/dishes', async (c) => {
  const supabase = getSupabase(c)
  let body = normalizeRequestBody(await c.req.json())

  // Generate pros and cons via Gemini straight at the time of creating the dish
  const apiKey = (c.env as any).GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey && (!body.pros || !body.cons) && (body.name || body.review || body.reviews)) {
    try {
      const genAI = new GoogleGenAI({ apiKey });
      const revText = typeof body.review === 'string' ? body.review : (Array.isArray(body.reviews) ? body.reviews.map((r: any) => r.text || r).join('; ') : '');
      const prompt = `You are a food critic and social media expert analyzing a restaurant dish.
Dish Name: ${body.name || 'Dish'}
Rating: ${body.rating || 'N/A'}/5
Cuisine: ${body.cuisine || 'Various'}
Review: ${revText || 'No review text provided. Evaluate based on rating and name.'}

Generate a concise analysis: 1-3 pros, 0-2 cons, a short summary sentence, and a verdict ("Must try", "Okayish", or "Skip").
Each pro and con MUST be extremely concise (max 5-7 words).
Return ONLY a JSON object with 'pros' (array of strings), 'cons' (array of strings), 'summary' (string), and 'verdict' (string).`;

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } },
              summary: { type: Type.STRING },
              verdict: { type: Type.STRING },
            },
            required: ['pros', 'cons', 'summary', 'verdict'],
          },
          temperature: 0.5,
        },
      });

      if (response.text) {
        const aiResult = JSON.parse(response.text);
        if (!body.pros && Array.isArray(aiResult.pros)) body.pros = aiResult.pros;
        if (!body.cons && Array.isArray(aiResult.cons)) body.cons = aiResult.cons;
        if (!body.summary && aiResult.summary) body.summary = aiResult.summary;
        if (!body.verdict && aiResult.verdict) body.verdict = aiResult.verdict;
      }
    } catch (err) {
      console.warn('Could not generate Gemini insights during dish creation:', err);
    }
  }

  // DISABLED AUTOMATIC EMBEDDING GENERATION TO SAVE API CALLS
  /*
  if (apiKey && body.restaurant_id) {
    try {
      const { data: resto } = await supabase.from('restaurants').select('name').eq('id', body.restaurant_id).single();
      const embedResult = await generateDishEmbedding(apiKey, body, resto?.name);
      if (embedResult?.embedding) {
        body.embedding = embedResult.embedding;
      }
    } catch (err) {
      console.warn("Failed to generate embedding for new dish", err);
    }
  }
  */

  console.log("PAYLOAD TO SUPABASE (dishes):", JSON.stringify(body, null, 2));

  const { error, data } = await supabase.from('dishes').insert(body).select();
  if (error) {
    console.error('Supabase insert error for dishes:', JSON.stringify(error, null, 2));
    return c.json({ error: `Error: ${error.message}; reference = ${error.details || error.hint || JSON.stringify(error)}` }, 500);
  }
  // Return inserted row without selecting missing columns
  return c.json(data?.[0] ?? {})
});

app.put('/api/dishes/:id', async (c) => {
  const supabase = getSupabase(c)
  const id = c.req.param('id')
  let updates = normalizeRequestBody(await c.req.json())

  // Generate embedding if there are changes to fields that matter
  const apiKey = (c.env as any).GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey && (updates.pros || updates.cons || updates.summary || updates.name || updates.cuisine || updates.tags)) {
    try {
      const { data: existingDish } = await supabase.from('dishes').select('*, restaurants(name)').eq('id', id).single();
      if (existingDish) {
        /*
        // Generate embedding if there are changes to fields that matter
        const apiKey = (c.env as any).GEMINI_API_KEY;
        if (apiKey && (updates.name || updates.summary || updates.pros || updates.cons || updates.verdict)) {
          try {
            // We need the full dish data to generate a good embedding
            const mergedData = { ...existingDish, ...updates };
            const embedResult = await generateDishEmbedding(apiKey, mergedData, existingDish.restaurants?.name);
            if (embedResult?.embedding) {
              updates.embedding = embedResult.embedding;
            }
          } catch (err) {
            console.warn("Failed to generate embedding for updated dish", err);
          }
        }
        */
      }
    } catch (err) {
      console.warn("Failed to generate embedding for updated dish", err);
    }
  }

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
app.get('/api/restaurants/:id/photos', async (c) => {
  // TODO: implement actual photo fetching logic
  return c.json({ restaurant: null, dishes: [] });
});

// Note: getRestaurantPhotos endpoint can be added later.

app.post('/api/restaurants/:id/generate-embeddings', async (c) => {
  const supabase = getSupabase(c);
  const id = c.req.param('id');
  const apiKey = (c.env as any).GEMINI_API_KEY;

  if (!apiKey) {
    return c.json({ error: 'GEMINI_API_KEY is not configured' }, 500);
  }

  // 1. Fetch restaurant name
  const { data: resto, error: restoError } = await supabase
    .from('restaurants')
    .select('name')
    .eq('id', id)
    .single();

  if (restoError || !resto) {
    return c.json({ error: 'Restaurant not found' }, 404);
  }

  // 2. Fetch all dishes for this restaurant
  const { data: dishes, error: dishesError } = await supabase
    .from('dishes')
    .select('*')
    .eq('restaurant_id', id);

  if (dishesError) {
    return c.json({ error: 'Failed to fetch dishes' }, 500);
  }

  if (!dishes || dishes.length === 0) {
    return c.json({ success: true, message: 'No dishes to generate embeddings for' });
  }

  let successCount = 0;
  let failCount = 0;

  // 3. Generate embeddings and update DB
  for (const dish of dishes) {
    try {
      const embedResult = await generateDishEmbedding(apiKey, dish, resto.name);
      if (embedResult?.embedding) {
        await supabase
          .from('dishes')
          .update({ embedding: embedResult.embedding })
          .eq('id', dish.id);
        successCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      console.error(`Failed to generate embedding for dish ${dish.id}:`, e);
      failCount++;
    }
  }

  return c.json({ 
    success: true, 
    message: `Generated embeddings for ${successCount} dishes. ${failCount} failed.` 
  });
});

async function uploadDataUrlToSupabase(supabase: any, dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  
  const [header, base64] = dataUrl.split(',');
  if (!base64) throw new Error("Invalid dataUrl, missing base64 part");
  
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

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message || JSON.stringify(error)}`);
  }

  const { data } = supabase.storage
    .from('soboite')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Image upload endpoint
app.post('/api/upload-image', async (c) => {
  const supabase = getSupabase(c);
  const body = await c.req.json();
  const dataUrl = body.dataUrl;

  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return c.json({ error: 'Invalid data URL' }, 400);
  }

  const publicUrl = await uploadDataUrlToSupabase(supabase, dataUrl);
  if (!publicUrl) return c.json({ error: 'Upload failed' }, 500);
  return c.json({ image_storage_url: publicUrl });
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

// --- Gemini API Endpoint ---
app.post('/api/gemini/analyze-restaurant', async (c) => {
  const apiKey = (c.env as any).GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'GEMINI_API_KEY is not configured in the backend.' }, 500);
  }

  try {
    const { restaurant, dishes, forceRegenerate } = await c.req.json();
    const supabase = getSupabase(c);

    // Extract existing pros, cons, rank, etc., straight from dishes table rows
    const dishInsightsFromDb = (dishes || []).map((d: any) => ({
      id: d.id,
      pros: d.pros || [],
      cons: d.cons || [],
      summary: d.summary || '',
      verdict: d.verdict || (d.isRecommended || d.is_recommended ? 'Must try' : 'Okayish'),
      rank: typeof d.rank === 'number' ? d.rank : (Number(d.rank) || null)
    }));

    // CHECK DB FIRST FOR CAPTION
    const { data: restoData, error: restoError } = await supabase
      .from('restaurants')
      .select('instagram_caption')
      .eq('id', restaurant.id)
      .single();

    const existingCaption = restoData?.instagram_caption;
    const hasValidData = existingCaption && existingCaption.trim() !== '';

    if (!forceRegenerate && hasValidData && !restoError) {
      console.log("=== Found existing caption in DB, skipping Gemini ===");
      return c.json({
        caption: existingCaption,
        dishes: dishInsightsFromDb,
        isCached: true
      });
    }

    const genAI = new GoogleGenAI({ apiKey });

    // Format the dishes info
    const dishesInfo = dishes.map((d: any) => {
      const revs = d.reviews || [];
      const reviewText = revs.map((r: any) => `- "${r.text}"`).join('\n');
      const prosText = (d.pros || []).join(', ');
      const consText = (d.cons || []).join(', ');
      return `Dish ID: ${d.id}\nDish: ${d.name} (Rating: ${d.rating}/5)\nPros: ${prosText}\nCons: ${consText}\nReviews:\n${reviewText}`;
    }).join('\\n\\n');

    const prompt = `
You are a food critic and social media expert analyzing a restaurant and its dishes.
Restaurant Name: ${restaurant.name}
Cuisine: ${restaurant.cuisine || 'Various'}
Location: ${restaurant.locationName || 'Unknown'}

Here are the dishes, pros/cons, and user reviews:
${dishesInfo}

Generate a beautifully formatted Instagram caption for the entire restaurant.

CRITICAL FORMATTING INSTRUCTIONS FOR CAPTION:
- You MUST use actual newline characters (\n) to preserve line breaks.
- You MUST include a blank line (\n\n) between every single section of the caption so it looks clean and readable! Do NOT cram it all together.

The caption MUST follow this exact structure (replace placeholders with actual data):

[some emoji related to the dish or resto] [Catchy hook sentence related to the restaurant]
\n\n
📍 Restaurant:
${restaurant.name}, ${restaurant.locationName || 'Location'}
\n\n
🍽 Must Try:
• [Dish 1] ⭐⭐⭐⭐⭐
• [Dish 2] ⭐⭐⭐⭐☆
\n\n
⭐ Overall Rating: [calculate overall out of 5 based on provided ratings]/5
👥 Best For: [e.g. Date Night, Casual Dining, Family, etc. based on vibe]
\n\n
Review:
[A 2-3 sentence engaging review of the restaurant combining thoughts from the dish reviews]
\n\n
✅ Would I revisit?
[Yes/No/Maybe with a short reason]
\n\n
👇 Have you been here? What should I try next?
\n\n
📌 Save this post for your next food outing.
\n\n
#Hashtags (generate 5 relevant hashtags)

Return ONLY a JSON object containing 'caption' (the formatted string).
`;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: {
              type: Type.STRING,
              description: 'The formatted Instagram caption',
            },
          },
          required: ['caption'],
        },
        temperature: 0.7,
      },
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      if (result.caption) {
        result.caption = result.caption.replace(/\\n/g, '\n');
      }
      return c.json({
        caption: result.caption,
        dishes: dishInsightsFromDb,
        isCached: false
      });
    }
    return c.json({ error: 'Empty response from Gemini' }, 500);
  } catch (error: any) {
    console.error('Failed to analyze restaurant with Gemini:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/gemini/save-insights', async (c) => {
  const supabase = getSupabase(c);
  try {
    const { restaurantId, caption, dishesData } = await c.req.json();
    if (!restaurantId) return c.json({ error: 'restaurantId is required' }, 400);

    // Save pros, cons, summary, verdict, and rank straight into the existing dishes table!
    if (Array.isArray(dishesData)) {
      for (const d of dishesData) {
        if (d.id) {
          await supabase.from('dishes').update({
            pros: d.pros || [],
            cons: d.cons || [],
            summary: d.summary || null,
            verdict: d.verdict || null,
            rank: typeof d.rank === 'number' ? d.rank : (Number(d.rank) || null)
          }).eq('id', d.id);
        }
      }
    }

    if (caption) {
      const { error } = await supabase.from('restaurants').update({
        instagram_caption: caption
      }).eq('id', restaurantId);
      if (error) console.warn("Notice on instagram_caption update:", error.message);
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/gemini/analyze-dishes', async (c) => {
  const apiKey = (c.env as any).GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'GEMINI_API_KEY is not configured.' }, 500);
  }
  try {
    const { dishes } = await c.req.json();
    if (!Array.isArray(dishes) || dishes.length === 0) {
      return c.json({ dishes: [] });
    }
    const supabase = getSupabase(c);
    const genAI = new GoogleGenAI({ apiKey });

    const dishesInfo = dishes.map((d: any) => {
      const revs = d.reviews || [];
      const reviewText = revs.map((r: any) => `- "${r.text}"`).join('\n');
      return `Dish ID: ${d.id}\nDish: ${d.name} (Rating: ${d.rating}/5)\nCuisine: ${d.cuisine || 'Various'}\nReviews:\n${reviewText || d.review || ''}`;
    }).join('\n\n');

    const prompt = `You are a food critic analyzing several restaurant dishes.
Here are the dishes:
${dishesInfo}

For each dish, generate 1-3 pros, 0-2 cons, a short one-line summary, and a verdict ("Must try", "Okayish", or "Skip").
Each point in pros and cons MUST be extremely concise (max 5-7 words).
Return ONLY a JSON object with 'dishes' as an array of objects containing 'id', 'pros', 'cons', 'summary', and 'verdict'.`;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dishes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                  cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  summary: { type: Type.STRING },
                  verdict: { type: Type.STRING }
                },
                required: ['id', 'pros', 'cons', 'summary', 'verdict']
              }
            }
          },
          required: ['dishes']
        },
        temperature: 0.5
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      const analyzedDishes = result.dishes || [];
      for (const d of analyzedDishes) {
        if (d.id) {
          const originalDish = dishes.find((od: any) => od.id === d.id);
          const updateData: any = {
            pros: d.pros || [],
            cons: d.cons || [],
            summary: d.summary || null,
            verdict: d.verdict || null
          };

          if (originalDish) {
            const mergedData = { ...originalDish, ...updateData };
            /*
            const apiKey = (c.env as any).GEMINI_API_KEY;
            if (apiKey && (updateData.name || updateData.summary || updateData.pros || updateData.cons || updateData.verdict)) {
              const { data: resto } = await supabase.from('restaurants').select('name').eq('id', updateData.restaurant_id || existing.restaurant_id).single();
              const mergedData = { ...existing, ...updateData };
              const embedResult = await generateDishEmbedding(apiKey, mergedData, resto?.name);
              if (embedResult?.embedding) {
                updateData.embedding = embedResult.embedding;
              }
            }
            */
          }

          await supabase.from('dishes').update(updateData).eq('id', d.id);
        }
      }
      return c.json({ dishes: analyzedDishes });
    }
    return c.json({ error: 'Empty response from Gemini' }, 500);
  } catch (error: any) {
    console.error('Failed to analyze dishes:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/gemini/chat', async (c) => {
  const apiKey = (c.env as any).GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: 'GEMINI_API_KEY is not configured.' }, 500);

  try {
    const { message } = await c.req.json();
    if (!message) return c.json({ error: 'Message is required' }, 400);

    const supabase = getSupabase(c);
    const genAI = new GoogleGenAI({ apiKey });

    // 1. Generate embedding for the user's question
    const embedResponse = await genAI.models.embedContent({
      model: 'gemini-embedding-2',
      contents: message
    });
    
    let queryEmbedding = null;
    if ((embedResponse as any).embeddings && (embedResponse as any).embeddings.length > 0) {
      queryEmbedding = (embedResponse as any).embeddings[0].values;
    } else if ((embedResponse as any).embedding && (embedResponse as any).embedding.values) {
      queryEmbedding = (embedResponse as any).embedding.values;
    } else if (Array.isArray(embedResponse) && embedResponse[0]?.values) {
      queryEmbedding = embedResponse[0].values;
    }

    if (!queryEmbedding) {
      return c.json({ error: 'Failed to generate embedding for query' }, 500);
    }

    // 2. Perform vector search using RPC match_dishes
    const { data: matchedDishes, error } = await supabase.rpc('match_dishes', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.5,
      match_count: 10
    });

    if (error) {
      console.error("Vector search error:", error);
      return c.json({ error: 'Vector search failed' }, 500);
    }

    // fetch total restaurant count
    const { count: restoCount } = await supabase.from('restaurants').select('*', { count: 'exact', head: true });

    // 3. Construct context
    const contextStr = (matchedDishes || []).map((d: any) => d.rag_context).join('\n\n');

    // 4. Generate answer
    const prompt = `You are Soboite, a helpful and expert food app assistant.
Soboite is a curated restaurant guide for South Mumbai (SoBo). It features top restaurants, detailed dish reviews, pros/cons, and AI-powered insights.
Currently, Soboite has ${restoCount || 'many'} restaurants listed in its database.
ONLY answer using the following data.
If the answer is not contained below or you don't know, say "I don't have enough information."

Context:
${contextStr}

User Question: ${message}`;

    console.log(`[GEMINI REQUEST PROMPT] \n${prompt}\n`);

    const chatResponse = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7
      }
    });

    console.log(`[GEMINI RESPONSE] \n${chatResponse.text}\n`);

    return c.json({ reply: chatResponse.text });
  } catch (err: any) {
    console.error('Failed to chat:', err);
    return c.json({ error: err.message }, 500);
  }
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
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
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
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
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
    .maybeSingle();

  if (userError) return c.json({ error: userError.message }, 500);
  if (!user) return c.json({ restaurants: [], dishes: [] });

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
    .maybeSingle();

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
    .maybeSingle();

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

// Push Notifications Endpoint
app.post('/api/push-notification', async (c) => {
  // In a real implementation, we would extract the admin token from headers
  const { message } = await c.req.json();
  // In a real app, this would use a web-push library and push to subscriptions in the DB
  // 1. Fetch all admin users' push subscriptions from the database
  // 2. Use web-push library with VAPID keys to send the payload
  // 3. Handle expired subscriptions


  return c.json({ success: true, message: "Push notification sent to all logged in admins" });
});

app.post('/api/admin/login', async (c) => {
  try {
    const { password } = await c.req.json();
    if (!password) return c.json({ error: 'Password required' }, 400);

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Pre-calculated SHA-256 hash for S0b0ite$$2026!
    const expectedHash = 'efcbcfa30e8a5636fdd3c4349251b25538407871ac12441b149e2c435eec506f';

    if (hashHex === expectedHash) {
      return c.json({ success: true });
    } else {
      return c.json({ error: 'Invalid password' }, 401);
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Instagram Publish Endpoint
app.post('/api/restaurants/:id/publish-instagram', async (c) => {
  const supabase = getSupabase(c);
  const id = c.req.param('id');

  let body: any = {};
  try {
    body = await c.req.json();
  } catch (e) {
    // Ignore error if body is empty or not JSON
  }

  let restaurantImageUrl = body.restaurantImageUrl;
  const dishImageUrls = body.dishImageUrls || {};
  let caption = body.caption;
  const dishAnalyses = body.dishAnalyses || [];

  try {
    if (restaurantImageUrl && restaurantImageUrl.startsWith('data:')) {
      restaurantImageUrl = await uploadDataUrlToSupabase(supabase, restaurantImageUrl);
    }
    for (const dishId of Object.keys(dishImageUrls)) {
      if (dishImageUrls[dishId] && dishImageUrls[dishId].startsWith('data:')) {
        dishImageUrls[dishId] = await uploadDataUrlToSupabase(supabase, dishImageUrls[dishId]);
      }
    }
  } catch (err: any) {
    return c.json({ error: `Image upload failed: ${err.message}` }, 500);
  }

  const zernioApiKey = (c.env as any).ZERNIO_API_KEY;
  const zernioAccountId = (c.env as any).ZERNIO_ACCOUNT_ID;

  if (!zernioApiKey || !zernioAccountId) {
    console.log("Missing Zernio credentials");
    return c.json({ error: `Missing Zernio credentials. Ensure both ZERNIO_API_KEY and ZERNIO_ACCOUNT_ID are set in .env.` }, 400);
  }

  // Fetch restaurant and dishes
  const { data: restaurant, error: restError } = await supabase.from('restaurants').select('*').eq('id', id).single();
  if (restError || !restaurant) return c.json({ error: 'Restaurant not found' }, 404);

  const { data: dishes, error: dishesError } = await supabase.from('dishes').select('*').eq('restaurant_id', id);
  if (dishesError) return c.json({ error: 'Error fetching dishes' }, 500);

  if (!caption) {
    // Construct caption fallback
    const hooks = [
      `Don't leave ${restaurant.location_name || 'Mumbai'} without trying this.`,
      `One of South Mumbai's most underrated spots.`,
      `Worth the hype? Here's my verdict.`,
      `Looking for good ${restaurant.cuisine || 'food'} in ${restaurant.location_name || 'South Mumbai'}?`,
      `Your new favourite spot in ${restaurant.location_name || 'town'}?`
    ];
    const hook = hooks[Math.floor(Math.random() * hooks.length)];

    const loc = restaurant.location_name ? `, ${restaurant.location_name}` : '';
    const restoLoc = `📍 Restaurant:\n${restaurant.name}${loc}`;

    let recommended = (dishes || []).filter(d => d.is_recommended);
    if (recommended.length === 0 && dishes && dishes.length > 0) {
      recommended = [...dishes].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 2);
    }

    let dishesText = '';
    if (recommended.length > 0) {
      dishesText = `🍽 Must Try:\n` + recommended.map(d => {
        const rating = d.rating || 4;
        const full = '⭐'.repeat(Math.floor(rating));
        const empty = '☆'.repeat(5 - Math.floor(rating));
        return `• ${d.name} ${full}${empty}`;
      }).join('\n');
    }

    const dishAvg = (dishes && dishes.length > 0) ? (dishes.reduce((a: number, b: any) => a + (b.rating || 0), 0) / dishes.length) : 0;
    let overallSum = 0; let overallCount = 0;
    if (restaurant.ambience_rating) { overallSum += restaurant.ambience_rating; overallCount++; }
    if (restaurant.service_rating) { overallSum += restaurant.service_rating; overallCount++; }
    if (dishAvg > 0) { overallSum += dishAvg; overallCount++; }
    const overall = overallCount > 0 ? (overallSum / overallCount).toFixed(1) : '4.5';

    const cost = restaurant.cost_for_two || 1000;
    const priceSymbols = cost > 1500 ? '₹₹₹' : cost > 600 ? '₹₹' : '₹';

    const typeMap: Record<string, string> = {
      'Cafe': '☕ Solo Work / Casual Meetup',
      'Fine Dining': '❤️ Date Night',
      'Pub / Bar': '👥 Friends / Drinks',
      'Casual Dining': '👨‍👩‍👧 Families',
      'Street Food': '🚶 Quick Bite',
      'Dessert': '🍰 Sweet Cravings'
    };
    const bestFor = restaurant.type ? (typeMap[restaurant.type] || '👥 Friends & Family') : '👥 Friends & Family';

    let facts = `⭐ Overall Rating: ${overall}/5\n💰 ${priceSymbols}\n👥 Best For: ${bestFor}`;
    if (restaurant.veg_only) {
      facts += `\n🥬 Veg Friendly: Yes`;
    }

    const reviewText = restaurant.notes ? `Review:\n${restaurant.notes}` : '';
    const wouldRevisit = parseFloat(overall) >= 4.0 ? '✅ Would I revisit?\nAbsolutely.' : '🤔 Would I revisit?\nOnly for specific dishes.';

    const ctas = [
      '👇 Which place should I review next?',
      '👇 Have you tried this place? What would you rate it?',
      '👇 Tag someone you\'d take here!',
      `📌 Save this post for your next trip to ${restaurant.location_name || 'South Mumbai'}.`
    ];
    const cta = ctas[Math.floor(Math.random() * ctas.length)];

    const branding = `🍽 More curated food recommendations on Soboite`;

    const baseHashtags = ['#SouthMumbai', '#MumbaiFood', '#MumbaiFoodie', '#FoodReview', '#RestaurantReview'];
    if (restaurant.cuisine) baseHashtags.push(`#${restaurant.cuisine.replace(/[^a-zA-Z0-9]/g, '')}`);
    if (restaurant.location_name) baseHashtags.push(`#${restaurant.location_name.replace(/[^a-zA-Z0-9]/g, '')}`);

    const hashtagText = baseHashtags.join(' ');

    caption = [
      `🍕 ${hook}`,
      restoLoc,
      dishesText,
      facts,
      reviewText,
      wouldRevisit,
      cta,
      branding,
      hashtagText
    ].filter(Boolean).join('\n\n');
  }

  let mediaToPublish: { url: string; type: string }[] = [];

  if (body.customMediaSequence && Array.isArray(body.customMediaSequence)) {
    mediaToPublish = body.customMediaSequence;
  } else {
    // 1. Add Restaurant Cover Photo
    if (restaurantImageUrl) {
    mediaToPublish.push({ url: restaurantImageUrl, type: 'image' });
  } else if (restaurant.image_storage_url) {
    mediaToPublish.push({ url: restaurant.image_storage_url, type: 'image' });
  } else if (restaurant.photos && restaurant.photos.length > 0) {
    mediaToPublish.push({ url: restaurant.photos[0].url, type: (restaurant.photos[0].type || 'image').toLowerCase() });
  }

  // 2. Add Dish Photos and Videos
  if (dishes && dishes.length > 0) {
    dishes.forEach(dish => {
      // If there's an edited Info Card for this dish, add it first
      if (dishImageUrls && dishImageUrls[dish.id]) {
        mediaToPublish.push({ url: dishImageUrls[dish.id], type: 'image' });

        // Then add the remaining raw media for this dish as B-Roll (skip index 0 as it was the base for Info Card)
        if (dish.photos && dish.photos.length > 1) {
          const rawMedia = dish.photos.slice(1);
          rawMedia.forEach((media: any) => {
            mediaToPublish.push({ url: media.url, type: (media.type || 'image').toLowerCase() });
          });
        }
      } else if (dish.image_storage_url) {
        // Fallback: No edited image, just use storage URL
        mediaToPublish.push({ url: dish.image_storage_url, type: 'image' });
      } else if (dish.photos && dish.photos.length > 0) {
        // Fallback: No edited image, use all raw photos/videos for this dish
        dish.photos.forEach((media: any) => {
          mediaToPublish.push({ url: media.url, type: (media.type || 'image').toLowerCase() });
        });
      }
    });
  }
}

  // 3. Catch any data URLs that might have come from the database (e.g. dish.photos)
  try {
    for (let i = 0; i < mediaToPublish.length; i++) {
      if (mediaToPublish[i].url && mediaToPublish[i].url.startsWith('data:')) {
        mediaToPublish[i].url = await uploadDataUrlToSupabase(supabase, mediaToPublish[i].url);
      }
    }
  } catch (err: any) {
    return c.json({ error: `Image upload failed during media prep: ${err.message}` }, 500);
  }

  // Enforce Instagram's strict 10-item carousel limit
  const finalMediaItems = mediaToPublish.slice(0, 10);

  if (finalMediaItems.length === 0) {
    return c.json({ error: 'No photos available to publish' }, 400);
  }

  try {
    const zernio = new Zernio({ apiKey: zernioApiKey });
    const result = await zernio.posts.createPost({
      body: {
        content: caption,
        publishNow: true,
        mediaItems: finalMediaItems.map(media => ({ url: media.url, type: media.type })),
        platforms: [
          {
            platform: 'instagram',
            accountId: zernioAccountId
          }
        ]
      }
    });

    if (result.error) {
      throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
    }

    let postData = result.data as any;
    const postId = postData?.id;

    // As long as Zernio didn't return an error, we mark it as published
    if (postData?.status !== 'failed') {
      // Update restaurant in DB (Optimistic update since we removed polling)
      await supabase.from('restaurants').update({
        insta_published: true,
        insta_published_at: new Date().toISOString(),
        insta_edited_photo_url: restaurantImageUrl || null
      }).eq('id', id);

      // Update dishes in DB
      if (dishes && dishes.length > 0) {
        for (const dish of dishes) {
          const dishEditedUrl = dishImageUrls[dish.id];
          if (dishEditedUrl) {
            await supabase.from('dishes').update({
              insta_published: true,
              insta_published_at: new Date().toISOString(),
              insta_edited_photo_url: dishEditedUrl
            }).eq('id', dish.id);
          }
        }
      }

      // Log event
      await supabase.from('app_events').insert({
        type: 'RESTO_PUBLISHED',
        message: `${restaurant.name} was queued for publishing to Instagram!`,
        link_url: `/restaurant/${id}`
      });

      // Save caption to restaurants table if provided
      if (caption) {
        await supabase.from('restaurants').update({
          instagram_caption: caption
        }).eq('id', id);
      }
    }

    return c.json({ success: true, id: postData?.id, status: postData?.status, post: postData });
  } catch (err: any) {
    console.error('Zernio publish error details:', err.message, err.stack);
    return c.json({ error: err.message }, 500);
  }
});

// Category/Top-Picks Publish Endpoint
app.post('/api/top-picks/publish-instagram', async (c) => {
  const supabase = getSupabase(c);

  let body: any = {};
  try {
    body = await c.req.json();
  } catch (e) { }

  let imageUrl = body.imageUrl;
  try {
    if (imageUrl && imageUrl.startsWith('data:')) {
      imageUrl = await uploadDataUrlToSupabase(supabase, imageUrl);
    }
  } catch (err: any) {
    return c.json({ error: `Image upload failed: ${err.message}` }, 500);
  }
  const caption = body.caption;

  const zernioApiKey = (c.env as any).ZERNIO_API_KEY;
  const zernioAccountId = (c.env as any).ZERNIO_ACCOUNT_ID;

  if (!zernioApiKey || !zernioAccountId) {
    return c.json({ error: `Missing Zernio credentials.` }, 400);
  }

  if (!imageUrl) {
    return c.json({ error: 'No image provided' }, 400);
  }

  try {
    const zernio = new Zernio({ apiKey: zernioApiKey });
    const result = await zernio.posts.createPost({
      body: {
        content: caption || 'Check out our Top Picks!',
        publishNow: true,
        mediaItems: [{ url: imageUrl }],
        platforms: [
          {
            platform: 'instagram',
            accountId: zernioAccountId
          }
        ]
      }
    });

    if (result.error) throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
    let postData = result.data as any;

    // Log event
    await supabase.from('app_events').insert({
      type: 'CATEGORY_PUBLISHED',
      message: `A Top Picks category was published to Instagram!`,
      link_url: `/`
    });

    return c.json({ success: true, id: postData?.id, status: postData?.status, post: postData });
  } catch (err: any) {
    console.error('Zernio publish error details:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
