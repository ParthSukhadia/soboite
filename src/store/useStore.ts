import { create } from 'zustand';
import { Restaurant, Dish } from '../types';
import { supabase } from '../lib/supabase';

interface AppState {
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  
  restaurants: Restaurant[];
  dishes: Dish[];
  restaurantTypes: string[];
  cuisines: string[];
  flavorTags: string[];
  loading: boolean;
  
  fetchData: () => Promise<void>;
  
  addRestaurant: (restaurant: Restaurant) => Promise<void>;
  updateRestaurant: (id: string, updates: Partial<Restaurant>) => Promise<void>;
  deleteRestaurant: (id: string) => Promise<void>;
  
  addDish: (dish: Dish) => Promise<void>;
  updateDish: (id: string, updates: Partial<Dish>) => Promise<void>;
  deleteDish: (id: string) => Promise<void>;

  ensureRestaurantType: (value: string) => Promise<void>;
  ensureCuisine: (value: string) => Promise<void>;
  ensureFlavorTag: (value: string) => Promise<void>;
}

export const useStore = create<AppState>()(
  (set) => ({
    editMode: true,
    setEditMode: (mode) => set({ editMode: mode }),
    
    restaurants: [],
    dishes: [],
    restaurantTypes: [],
    cuisines: [],
    flavorTags: [],
    loading: false,

    ensureRestaurantType: async (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;

      const { error } = await supabase
        .from('restaurant_types')
        .upsert({ name: normalized }, { onConflict: 'name' });

      if (error && !error.message.includes('does not exist')) {
        throw new Error(error.message);
      }

      set((state) => {
        if (state.restaurantTypes.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
          return state;
        }
        return { restaurantTypes: [...state.restaurantTypes, normalized].sort((a, b) => a.localeCompare(b)) };
      });
    },

    ensureCuisine: async (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;

      const { error } = await supabase
        .from('cuisines')
        .upsert({ name: normalized }, { onConflict: 'name' });

      if (error && !error.message.includes('does not exist')) {
        throw new Error(error.message);
      }

      set((state) => {
        if (state.cuisines.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
          return state;
        }
        return { cuisines: [...state.cuisines, normalized].sort((a, b) => a.localeCompare(b)) };
      });
    },

    ensureFlavorTag: async (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;

      const { error } = await supabase
        .from('flavor_tags')
        .upsert({ name: normalized }, { onConflict: 'name' });

      if (error && !error.message.includes('does not exist')) {
        throw new Error(error.message);
      }

      set((state) => {
        if (state.flavorTags.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
          return state;
        }
        return { flavorTags: [...state.flavorTags, normalized].sort((a, b) => a.localeCompare(b)) };
      });
    },

    fetchData: async () => {
      set({ loading: true });
      console.log("Starting data fetch from Supabase...");
      try {
        const [restRes, dishRes, typeRes, cuisineRes, flavorTagRes] = await Promise.all([
          supabase.from('restaurants').select('*'),
          supabase.from('dishes').select('*'),
          supabase.from('restaurant_types').select('name'),
          supabase.from('cuisines').select('name'),
          supabase.from('flavor_tags').select('name')
        ]);

        console.log("Supabase Restaurants Response:", { data: restRes.data, error: restRes.error });
        console.log("Supabase Dishes Response:", { data: dishRes.data, error: dishRes.error });

        if (restRes.error) console.error("Restaurant fetch error:", restRes.error);
        if (dishRes.error) console.error("Dish fetch error:", dishRes.error);
        if (typeRes.error && !typeRes.error.message.includes('does not exist')) console.error("Restaurant types fetch error:", typeRes.error);
        if (cuisineRes.error && !cuisineRes.error.message.includes('does not exist')) console.error("Cuisines fetch error:", cuisineRes.error);
        if (flavorTagRes.error && !flavorTagRes.error.message.includes('does not exist')) console.error("Flavor tags fetch error:", flavorTagRes.error);

        let mappedRests: Restaurant[] = [];
        let mappedDishes: Dish[] = [];

        if (restRes.data) {
          mappedRests = restRes.data.map((r: any) => ({
            id: r.id, 
            name: r.name,
            lat: r.lat ?? r.latitude,
            lng: r.lng ?? r.longitude,
            notes: r.notes,
            imageUrl: r.image_url,
            type: r.type,
            cuisine: r.cuisine,
            costForTwo: r.cost_for_two,
            createdAt: r.created_at || r.createdAt
          }));
        }
        
        if (dishRes.data) {
          mappedDishes = dishRes.data.map((d: any) => ({
            id: d.id,
            name: d.name,
            restaurantId: d.restaurant_id || d.restaurantId,
            rating: d.rating,
            priceLevel: d.price_level || d.priceLevel,
            review: d.review,
            imageUrl: d.image_url,
            cuisine: d.cuisine,
            flavorTags: d.flavor_tags
          }));
        }

        const derivedTypes = Array.from(new Set(mappedRests.map((r) => r.type).filter((v): v is string => Boolean(v))));
        const derivedCuisines = Array.from(new Set([
          ...mappedRests.map((r) => r.cuisine),
          ...mappedDishes.map((d) => d.cuisine)
        ].filter((v): v is string => Boolean(v))));
        const derivedFlavorTags = Array.from(new Set(mappedDishes.flatMap((d) => d.flavorTags ?? []).filter(Boolean)));

        const tableTypes = (typeRes.data ?? []).map((row: any) => row.name).filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0);
        const tableCuisines = (cuisineRes.data ?? []).map((row: any) => row.name).filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0);
        const tableFlavorTags = (flavorTagRes.data ?? []).map((row: any) => row.name).filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0);

        const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

        set({
          restaurants: mappedRests,
          dishes: mappedDishes,
          restaurantTypes: uniqueSorted(tableTypes.length > 0 ? tableTypes : derivedTypes),
          cuisines: uniqueSorted(tableCuisines.length > 0 ? tableCuisines : derivedCuisines),
          flavorTags: uniqueSorted(tableFlavorTags.length > 0 ? tableFlavorTags : derivedFlavorTags)
        });
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        set({ loading: false });
      }
    },
    
    addRestaurant: async (restaurant) => {
      const dbRest = {
        ...restaurant,
        image_url: restaurant.imageUrl,
        cost_for_two: restaurant.costForTwo,
        created_at: restaurant.createdAt ? new Date(restaurant.createdAt).toISOString() : undefined
      };
      delete (dbRest as any).createdAt;
      delete (dbRest as any).imageUrl;
      delete (dbRest as any).costForTwo;

      const { error } = await supabase.from('restaurants').insert(dbRest);
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({ restaurants: [...state.restaurants, restaurant] }));
    },
    updateRestaurant: async (id, updates) => {
      const dbUpdates = { ...updates };
      if (dbUpdates.imageUrl !== undefined) {
        (dbUpdates as any).image_url = dbUpdates.imageUrl;
        delete dbUpdates.imageUrl;
      }
      if (dbUpdates.costForTwo !== undefined) {
        (dbUpdates as any).cost_for_two = dbUpdates.costForTwo;
        delete dbUpdates.costForTwo;
      }
      const { error } = await supabase.from('restaurants').update(dbUpdates).eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({
        restaurants: state.restaurants.map((r) => r.id === id ? { ...r, ...updates } : r)
      }));
    },
    deleteRestaurant: async (id) => {
      const { error: restaurantError } = await supabase.from('restaurants').delete().eq('id', id);
      if (restaurantError) {
        throw new Error(restaurantError.message);
      }
      const { error: dishError } = await supabase.from('dishes').delete().eq('restaurant_id', id);
      if (dishError) {
        throw new Error(dishError.message);
      }
      set((state) => ({
        restaurants: state.restaurants.filter((r) => r.id !== id),
        dishes: state.dishes.filter(d => d.restaurantId !== id)
      }));
    },
    
    addDish: async (dish) => {
      // Map to snake_case if your Supabase column is named 'restaurant_id'
      const { restaurantId, ...rest } = dish;
      const dbDish: any = {
        ...rest,
        restaurant_id: restaurantId,
        price_level: rest.priceLevel,
        image_url: rest.imageUrl,
        flavor_tags: rest.flavorTags
      };
      delete dbDish.priceLevel;
      delete dbDish.imageUrl;
      delete dbDish.flavorTags;
      
      const { error } = await supabase.from('dishes').insert(dbDish);
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({ dishes: [...state.dishes, dish] }));
    },
    updateDish: async (id, updates) => {
      const dbUpdates: any = { ...updates };
      if (dbUpdates.restaurantId) {
        dbUpdates.restaurant_id = dbUpdates.restaurantId;
        delete dbUpdates.restaurantId;
      }
      if (dbUpdates.priceLevel) {
        dbUpdates.price_level = dbUpdates.priceLevel;
        delete dbUpdates.priceLevel;
      }
      if (dbUpdates.imageUrl !== undefined) {
        dbUpdates.image_url = dbUpdates.imageUrl;
        delete dbUpdates.imageUrl;
      }
      if (dbUpdates.flavorTags !== undefined) {
        dbUpdates.flavor_tags = dbUpdates.flavorTags;
        delete dbUpdates.flavorTags;
      }
      
      const { error } = await supabase.from('dishes').update(dbUpdates).eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({
        dishes: state.dishes.map((d) => d.id === id ? { ...d, ...updates } : d)
      }));
    },
    deleteDish: async (id) => {
      const { error } = await supabase.from('dishes').delete().eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({
        dishes: state.dishes.filter((d) => d.id !== id)
      }));
    },
  })
);
