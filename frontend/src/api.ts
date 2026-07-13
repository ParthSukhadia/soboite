// frontend/src/api.ts

/**
 * Simple fetch wrapper that talks to the Cloudflare Workers backend.
 * The base URL is taken from the VITE_API_BASE env variable (defined in .env for local, or CI/CD for production).
 */
const defaultApiBase = import.meta.env.DEV
  ? (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8787` : 'http://localhost:8787')
  : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}` : ''); // In production, omit port 8787.

export const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || defaultApiBase;

/** GET helper with JSON response handling */
async function getJSON<T>(path: string): Promise<T> {
  const url = `${apiBase}${path}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API GET ${path} failed (${resp.status}): ${text}`);
  }
  return (await resp.json()) as T;
}

/** POST/PUT helper for JSON bodies */
async function sendJSON<T>(method: string, path: string, body: any): Promise<T> {
  const url = `${apiBase}${path}`;
  const resp = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${method} ${path} failed (${resp.status}): ${text}`);
  }
  return (await resp.json()) as T;
}

/** Public API used by the frontend store */
export const api = {
  // Fetch all restaurants (the backend returns an array of restaurant rows)
  getRestaurants: () => getJSON<any[]>("/api/restaurants"),

  // Fetch all dishes
  getDishes: () => getJSON<any[]>("/api/dishes"),

  // Create a new restaurant
  addRestaurant: (restaurant: any) =>
    sendJSON<any>("POST", "/api/restaurants", restaurant),

  // Upsert helpers for reference data – currently thin wrappers that hit placeholder endpoints.
  // Implement these endpoints in the worker when needed.
  upsertRestaurantType: (name: string) =>
    sendJSON<void>("POST", "/api/restaurant-types", { name }),
  upsertCuisine: (name: string) =>
    sendJSON<void>("POST", "/api/cuisines", { name }),
  upsertFlavorTag: (name: string) =>
    sendJSON<void>("POST", "/api/flavor-tags", { name }),
  
  // Fetch photos for a specific restaurant and its dishes
  getRestaurantPhotos: (restaurantId: string) => 
    getJSON<any>(`/api/restaurants/${restaurantId}/photos`),

  // CRUD for restaurants and dishes
  updateRestaurant: (id: string, updates: any) =>
    sendJSON<any>("PUT", `/api/restaurants/${id}`, updates),
  deleteRestaurant: (id: string) =>
    sendJSON<void>("DELETE", `/api/restaurants/${id}`, {}),
  
  addDish: (dish: any) =>
    sendJSON<any>("POST", "/api/dishes", dish),
  updateDish: (id: string, updates: any) =>
    sendJSON<any>("PUT", `/api/dishes/${id}`, updates),
  deleteDish: (id: string) =>
    sendJSON<void>("DELETE", `/api/dishes/${id}`, {}),

  // Image Upload
  uploadImage: async (dataUrl: string) => {
    const res = await sendJSON<{ image_storage_url: string }>("POST", "/api/upload-image", { dataUrl });
    return res.image_storage_url;
  },

  // Admin Export/Import
  exportAll: () => getJSON<Record<string, any[]>>("/api/export"),
  clearTable: (tableName: string, idColumn?: string) =>
    sendJSON<{ success: boolean; deleted: number }>("POST", "/api/clear-table", { tableName, idColumn }),
  importTable: (tableName: string, rows: any[], upsertKey: string) =>
    sendJSON<{ success: boolean; imported: number }>("POST", "/api/import-table", { tableName, rows, upsertKey }),

  // User and Likes
  registerUser: (deviceId: string, firstName: string, lastName: string) =>
    sendJSON<any>("POST", "/api/users", { deviceId, firstName, lastName }),
  getUserLikes: (deviceId: string) =>
    getJSON<{ restaurants: { restaurant_id: string, is_like: boolean }[], dishes: { dish_id: string, is_like: boolean }[] }>(`/api/users/${deviceId}/likes`),
  setRestaurantLike: (restaurantId: string, deviceId: string, isLike: boolean | null) =>
    sendJSON<any>("POST", `/api/restaurants/${restaurantId}/like`, { deviceId, isLike }),
  setDishLike: (dishId: string, deviceId: string, isLike: boolean | null) =>
    sendJSON<any>("POST", `/api/dishes/${dishId}/like`, { deviceId, isLike }),
  getRestaurantLikes: (restaurantId: string) =>
    getJSON<{ names: string[] }>(`/api/restaurants/${restaurantId}/likes`),
  getDishLikes: (dishId: string) =>
    getJSON<{ names: string[] }>(`/api/dishes/${dishId}/likes`),

  async getTopPicks() {
    return getJSON<{ categories: any[], restaurants: any[] }>(`/api/top-picks`);
  },

  async createTopPickCategory(name: string) {
    const res = await fetch(`${apiBase}/api/top-picks/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to create top pick category');
    return res.json();
  },

  async updateTopPickCategory(id: string, name: string) {
    const res = await fetch(`${apiBase}/api/top-picks/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to update top pick category');
    return res.json();
  },

  async deleteTopPickCategory(id: string) {
    const res = await fetch(`${apiBase}/api/top-picks/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete top pick category');
    return res.json();
  },

  async updateTopPickRestaurants(categoryId: string, restaurantIds: string[]) {
    const res = await fetch(`${apiBase}/api/top-picks/categories/${categoryId}/restaurants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantIds })
    });
    if (!res.ok) throw new Error('Failed to update top pick restaurants');
    return res.json();
  },

  sendPushNotification: (restaurantName: string) =>
    sendJSON<void>("POST", "/api/push-notification", { message: `New restaurant added: ${restaurantName}! Check it out now.` }),
    
  publishToInstagram: (restaurantId: string, payload: { restaurantImageUrl: string, dishImageUrls: Record<string, string>, caption?: string, dishAnalyses?: any[] }) =>
    sendJSON<{ success: boolean; url?: string }>("POST", `/api/restaurants/${restaurantId}/publish-instagram`, payload),

  getEvents: () => getJSON<any[]>("/api/events"),
  
  analyzeRestaurantWithGemini: (restaurant: any, dishes: any[]) =>
    sendJSON<{ caption: string, isCached?: boolean, dishes: { id: string, pros: string[], cons: string[], summary: string, verdict?: string }[] }>("POST", "/api/gemini/analyze-restaurant", { restaurant, dishes }),

  saveInsights: (restaurantId: string, caption: string, dishesData: any[]) =>
    sendJSON<{ success: boolean }>("POST", "/api/gemini/save-insights", { restaurantId, caption, dishesData }),

  loginAdmin: (password: string) =>
    sendJSON<{ success?: boolean, error?: string }>("POST", "/api/admin/login", { password })
};
