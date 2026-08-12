// frontend/src/api.ts
import { useStore } from './store/useStore';

/**
 * Simple fetch wrapper that talks to the Cloudflare Workers backend.
 * The base URL is taken from the VITE_API_BASE env variable (defined in .env for local, or CI/CD for production).
 */
const defaultApiBase = import.meta.env.DEV
  ? (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8787` : 'http://localhost:8787')
  : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}` : ''); // In production, omit port 8787.

export const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || defaultApiBase;
const PROD_BACKEND = 'https://soboite-backend.masanirishabh12.workers.dev';

async function fetchWithFallback(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    let resp = await fetch(url, options);
    if (!resp.ok) {
      const cloned = resp.clone();
      const text = await cloned.text();
      if (text.includes('Invalid API key') || text.includes('apikey') || resp.status === 500 || resp.status === 401) {
        if (!url.startsWith(PROD_BACKEND)) {
          const path = url.replace(/^(?:https?:\/\/[^\/]+)?/, '');
          const fallbackUrl = `${PROD_BACKEND}${path}`;
          console.warn(`[API FALLBACK] ${url} failed (${resp.status}), retrying with ${fallbackUrl}...`);
          const fallbackResp = await fetch(fallbackUrl, options);
          if (fallbackResp.ok) return fallbackResp;
        }
      }
    }
    return resp;
  } catch (err) {
    if (!url.startsWith(PROD_BACKEND)) {
      const path = url.replace(/^(?:https?:\/\/[^\/]+)?/, '');
      const fallbackUrl = `${PROD_BACKEND}${path}`;
      return await fetch(fallbackUrl, options);
    }
    throw err;
  }
}

async function handleApiError(resp: Response, prefix: string) {
  let text = await resp.text();
  let msg = text;
  try {
    const json = JSON.parse(text);
    msg = json.error || json.details || json.message || text;
  } catch (e) {
    // not JSON
  }
  if (msg.includes('Invalid API key') || msg.includes('apikey')) {
    // Suppress API key errors
    console.warn(`[SUPPRESSED API ERROR] ${prefix}: ${msg}`);
    return;
  }
  const fullMsg = msg ? `Something went wrong: ${msg}` : `Something went wrong (${resp.status})`;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-error', { detail: fullMsg }));
  }
  throw new Error(`${prefix} (${resp.status}): ${text}`);
}

const getHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    if (useStore.getState().editMode) {
      headers["X-Admin-Access"] = "true";
    }
  } catch (e) {}
  return headers;
};

/** GET helper with JSON response handling */
async function getJSON<T>(path: string): Promise<T> {
  const url = `${apiBase}${path}`;
  const resp = await fetchWithFallback(url, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });
  if (!resp.ok) {
    await handleApiError(resp, `API GET ${path} failed`);
  }
  return (await resp.json()) as T;
}

/** POST/PUT helper for JSON bodies */
async function sendJSON<T>(method: string, path: string, body: any): Promise<T> {
  const url = `${apiBase}${path}`;
  const resp = await fetchWithFallback(url, {
    method,
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    await handleApiError(resp, `API ${method} ${path} failed`);
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
  addRestaurant: (restaurant: any) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<any>("POST", "/api/restaurants", restaurant);
  },


  // Upsert helpers for reference data
  upsertRestaurantType: (name: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<void>("POST", "/api/restaurant-types", { name });
  },
  upsertCuisine: (name: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<void>("POST", "/api/cuisines", { name });
  },
  upsertFlavorTag: (name: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<void>("POST", "/api/flavor-tags", { name });
  },
  
  // Fetch photos for a specific restaurant and its dishes
  getRestaurantPhotos: (restaurantId: string) => 
    getJSON<any>(`/api/restaurants/${restaurantId}/photos`),

  // CRUD for restaurants and dishes
  updateRestaurant: (id: string, updates: any) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<any>("PUT", `/api/restaurants/${id}`, updates);
  },
  deleteRestaurant: (id: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<void>("DELETE", `/api/restaurants/${id}`, {});
  },
  
  addDish: (dish: any) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<any>("POST", "/api/dishes", dish);
  },
  updateDish: (id: string, updates: any) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<any>("PUT", `/api/dishes/${id}`, updates);
  },
  deleteDish: (id: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<void>("DELETE", `/api/dishes/${id}`, {});
  },

  // Image Upload
  uploadImage: async (dataUrl: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    const res = await sendJSON<{ image_storage_url: string }>("POST", "/api/upload-image", { dataUrl });
    return res.image_storage_url;
  },

  // Admin Export/Import
  exportAll: () => getJSON<Record<string, any[]>>("/api/export"),
  clearTable: (tableName: string, idColumn?: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<{ success: boolean; deleted: number }>("POST", "/api/clear-table", { tableName, idColumn });
  },
  importTable: (tableName: string, rows: any[], upsertKey: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<{ success: boolean; imported: number }>("POST", "/api/import-table", { tableName, rows, upsertKey });
  },

  // User and Likes
  registerUser: (deviceId: string, firstName: string, lastName: string) =>
    sendJSON<any>("POST", "/api/users", { deviceId, firstName, lastName }),
  getUserLikes: (deviceId: string) =>
    getJSON<{ 
      restaurants: { restaurant_id: string, is_like: boolean }[], 
      dishes: { dish_id: string, is_like: boolean }[],
      wishlist: { restaurant_id: string }[],
      polls: { restaurant_id: string, option_id: number }[]
    }>(`/api/users/${deviceId}/likes`),
  setRestaurantPoll: (restaurantId: string, deviceId: string, optionId: number | null) =>
    sendJSON<any>("POST", `/api/restaurants/${restaurantId}/poll`, { deviceId, optionId }),
  toggleWishlist: (restaurantId: string, deviceId: string, isInWishlist: boolean) =>
    sendJSON<any>("POST", `/api/restaurants/${restaurantId}/wishlist`, { deviceId, isInWishlist }),
  setDishLike: (dishId: string, deviceId: string, isLike: boolean | null) =>
    sendJSON<any>("POST", `/api/dishes/${dishId}/like`, { deviceId, isLike }),
  getDishLikes: (dishId: string) =>
    getJSON<{ names: string[] }>(`/api/dishes/${dishId}/likes`),

  async getTopPicks() {
    return getJSON<{ categories: any[], restaurants: any[] }>(`/api/top-picks`);
  },

  async createTopPickCategory(name: string) {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    const res = await fetch(`${apiBase}/api/top-picks/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      await handleApiError(res, `Failed to create top pick category`);
    }
    return res.json();
  },

  async updateTopPickCategory(id: string, name: string) {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    const res = await fetch(`${apiBase}/api/top-picks/categories/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      await handleApiError(res, `Failed to update top pick category`);
    }
    return res.json();
  },

  async deleteTopPickCategory(id: string) {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    const res = await fetch(`${apiBase}/api/top-picks/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      await handleApiError(res, `Failed to delete top pick category`);
    }
    return res.json();
  },

  async updateTopPickRestaurants(categoryId: string, restaurantIds: string[]) {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    const res = await fetch(`${apiBase}/api/top-picks/categories/${categoryId}/restaurants`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ restaurantIds })
    });
    if (!res.ok) {
      await handleApiError(res, `Failed to update top pick restaurants`);
    }
    return res.json();
  },

  sendPushNotification: (restaurantName: string) => {
    const isEditMode = useStore.getState().editMode;
    if (!isEditMode) {
      throw new Error("Unauthorized: Admin login is required to send push notifications.");
    }
    return sendJSON<void>("POST", "/api/push-notification", { message: `New restaurant added: ${restaurantName}! Check it out now.` });
  },
    
  publishToInstagram: (restaurantId: string, payload: { restaurantImageUrl?: string, dishImageUrls?: Record<string, string>, caption?: string, dishAnalyses?: any[], customMediaSequence?: { url: string, type: string }[] }) => {
    const isEditMode = useStore.getState().editMode;
    if (!isEditMode) {
      throw new Error("Unauthorized: Admin login is required to publish to Instagram.");
    }
    return sendJSON<{ success: boolean; url?: string }>("POST", `/api/restaurants/${restaurantId}/publish-instagram`, payload);
  },

  publishTopPickToInstagram: (payload: { imageUrl: string, caption?: string }) => {
    const isEditMode = useStore.getState().editMode;
    if (!isEditMode) {
      throw new Error("Unauthorized: Admin login is required to publish to Instagram.");
    }
    return sendJSON<{ success: boolean; url?: string }>("POST", "/api/top-picks/publish-instagram", payload);
  },

  generateEmbeddings: (restaurantId: string) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<{ success: boolean, message?: string }>("POST", `/api/restaurants/${restaurantId}/generate-embeddings`, {});
  },

  getEvents: () => getJSON<any[]>("/api/events"),
  
  analyzeRestaurantWithGemini: (restaurant: any, dishes: any[], forceRegenerate?: boolean) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<{ caption: string, isCached?: boolean, dishes: { id: string, pros: string[], cons: string[], summary: string, verdict?: string }[] }>("POST", "/api/gemini/analyze-restaurant", { restaurant, dishes, forceRegenerate });
  },

  analyzeDishes: (dishes: any[]) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<{ dishes: { id: string, pros: string[], cons: string[], summary: string, verdict?: string }[] }>("POST", "/api/gemini/analyze-dishes", { dishes });
  },

  saveInsights: (restaurantId: string, caption: string, dishesData: any[]) => {
    if (!useStore.getState().editMode) throw new Error('Unauthorized: Admin login required.');
    return sendJSON<{ success: boolean }>("POST", "/api/gemini/save-insights", { restaurantId, caption, dishesData });
  },

  askGemini: (message: string) =>
    sendJSON<{ reply?: string, error?: string }>("POST", "/api/gemini/chat", { message }),

  loginAdmin: (password: string) =>
    sendJSON<{ success?: boolean, error?: string }>("POST", "/api/admin/login", { password })
};
