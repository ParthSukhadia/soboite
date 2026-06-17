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
};
