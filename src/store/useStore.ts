import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Restaurant, Dish, DishReview, PhotoEntry } from '../types';
import { supabase, uploadImage } from '../lib/supabase';
import { prefetchCachedImages } from '../lib/imageCache';
import { indexedDBStorage } from './indexedDBStorage';

const isValidReviewDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const createReviewId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeReviewDate = (value?: string, fallbackMs: number = Date.now()) => {
  if (value && isValidReviewDate(value)) {
    return value;
  }
  return new Date(fallbackMs).toISOString().slice(0, 10);
};

const normalizeUploadedAt = (value?: string, fallbackMs: number = Date.now()) => {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date(fallbackMs).toISOString();
};

const reviewTimestamp = (review: DishReview) => {
  const parsed = Date.parse(`${review.date}T00:00:00`);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return review.createdAt;
};

const isMissingColumnError = (error: unknown, columnName: string) => {
  if (!error || typeof error !== 'object') return false;
  const message = (error as { message?: string }).message;
  if (typeof message !== 'string') return false;
  return message.includes(`'${columnName}'`) && message.includes('schema cache');
};

const removeMissingColumnsFromPayload = (payload: Record<string, unknown>, error: unknown, columns: string[]) => {
  let removed = false;
  columns.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(payload, column) && isMissingColumnError(error, column)) {
      delete payload[column];
      removed = true;
    }
  });
  return removed;
};

const normalizePhotos = (source: unknown, fallbackUrl?: string): PhotoEntry[] => {
  const items: PhotoEntry[] = [];

  if (Array.isArray(source)) {
    source.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const candidateUrl = String((entry as any).url ?? (entry as any).imageUrl ?? '').trim();
      if (!candidateUrl) return;
      const rawUploadedAt = typeof (entry as any).uploadedAt === 'string' ? (entry as any).uploadedAt : undefined;
      const createdAt = Date.now();
      items.push({
        id: String((entry as any).id ?? createReviewId()),
        url: candidateUrl,
        uploadedAt: normalizeUploadedAt(rawUploadedAt, createdAt)
      });
    });
  }

  const fallback = fallbackUrl?.trim();
  if (fallback && !items.some((photo) => photo.url === fallback)) {
    items.push({
      id: createReviewId(),
      url: fallback,
      uploadedAt: normalizeUploadedAt(undefined, Date.now())
    });
  }

  return Array.from(new Map(items.map((photo) => [photo.id, photo])).values());
};

const resolvePrimaryPhotoId = (photos: PhotoEntry[], preferred?: string) => {
  if (preferred && photos.some((photo) => photo.id === preferred)) {
    return preferred;
  }
  return photos[0]?.id;
};

const resolvePrimaryPhotoUrl = (photos: PhotoEntry[], primaryPhotoId?: string, fallbackUrl?: string) => {
  if (primaryPhotoId) {
    const preferred = photos.find((photo) => photo.id === primaryPhotoId);
    if (preferred) return preferred.url;
  }
  if (photos[0]) return photos[0].url;
  return fallbackUrl;
};

const collectImageUrls = (restaurants: Restaurant[], dishes: Dish[]) => {
  const urls = new Set<string>();

  restaurants.forEach((restaurant) => {
    if (restaurant.imageUrl) urls.add(restaurant.imageUrl);
    restaurant.photos?.forEach((photo) => {
      if (photo.url) urls.add(photo.url);
    });
  });

  dishes.forEach((dish) => {
    if (dish.imageUrl) urls.add(dish.imageUrl);
    dish.photos?.forEach((photo) => {
      if (photo.url) urls.add(photo.url);
    });
  });

  return Array.from(urls);
};

const cacheImageUrlsForState = async (restaurants: Restaurant[], dishes: Dish[]) => {
  const urls = collectImageUrls(restaurants, dishes);
  if (urls.length === 0) return;
  await prefetchCachedImages(urls);
};

const normalizeReviews = (
  source: unknown,
  fallbackReview?: string,
  fallbackReviewDate?: string
): DishReview[] => {
  const items: DishReview[] = [];

  if (Array.isArray(source)) {
    source.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const text = String((entry as any).text ?? '').trim();
      if (!text) return;
      const rawDate = typeof (entry as any).date === 'string' ? (entry as any).date : undefined;
      const rawCreatedAt = Number((entry as any).createdAt);
      const createdAt = Number.isFinite(rawCreatedAt) ? rawCreatedAt : Date.now();
      const date = normalizeReviewDate(rawDate, createdAt);
      items.push({
        id: String((entry as any).id ?? createReviewId()),
        text,
        date,
        createdAt
      });
    });
  }

  const legacyText = fallbackReview?.trim();
  if (legacyText) {
    const createdAt = Date.now();
    items.push({
      id: createReviewId(),
      text: legacyText,
      date: normalizeReviewDate(fallbackReviewDate, createdAt),
      createdAt
    });
  }

  const deduped = Array.from(
    new Map(items.map((entry) => [`${entry.text}|${entry.date}`, entry])).values()
  );

  return deduped.sort((a, b) => {
    const dateDelta = reviewTimestamp(b) - reviewTimestamp(a);
    if (dateDelta !== 0) return dateDelta;
    return b.createdAt - a.createdAt;
  });
};

const normalizeDbRestaurant = (r: any): Restaurant => {
  const photos = normalizePhotos(r.photos, r.image_url);
  const primaryPhotoId = resolvePrimaryPhotoId(photos, r.primary_photo_id ?? r.primaryPhotoId);
  return {
    id: r.id,
    name: r.name,
    lat: Number(r.lat ?? r.latitude) || 18.9442,
    lng: Number(r.lng ?? r.longitude) || 72.8276,
    locationName: r.location_name ?? r.locationName,
    address: r.address,
    vegOnly: Boolean(r.veg_only ?? r.vegOnly),
    notes: r.notes,
    photos: photos.length > 0 ? photos : undefined,
    primaryPhotoId,
    imageUrl: resolvePrimaryPhotoUrl(photos, primaryPhotoId, r.image_url),
    type: r.type,
    cuisine: r.cuisine,
    costForTwo: r.cost_for_two ?? r.costForTwo,
    ambienceRating: r.ambience_rating ?? r.ambienceRating,
    serviceRating: r.service_rating ?? r.serviceRating,
    createdAt: r.created_at || r.createdAt
  };
};

const normalizeDbDish = (d: any): Dish => {
  const reviews = normalizeReviews(d.reviews, d.review, d.review_date ?? d.reviewDate);
  const latestReview = reviews[0];
  const photos = normalizePhotos(d.photos, d.image_url);
  const primaryPhotoId = resolvePrimaryPhotoId(photos, d.primary_photo_id ?? d.primaryPhotoId);
  return {
    id: d.id,
    name: d.name,
    restaurantId: d.restaurant_id || d.restaurantId,
    rating: typeof d.rating === 'number' ? d.rating : Number(d.rating) || 0,
    priceLevel: Math.min(3, Math.max(1, Number(d.price_level || d.priceLevel || 1))) as 1 | 2 | 3,
    actualPrice: d.actual_price ?? d.actualPrice,
    review: latestReview?.text ?? d.review,
    reviewDate: latestReview?.date ?? d.review_date ?? d.reviewDate,
    reviews: reviews.length > 0 ? reviews : undefined,
    photos: photos.length > 0 ? photos : undefined,
    primaryPhotoId,
    imageUrl: resolvePrimaryPhotoUrl(photos, primaryPhotoId, d.image_url),
    isRecommended: Boolean(d.is_recommended ?? d.isRecommended),
    cuisine: d.cuisine,
    flavorTags: d.flavor_tags ?? d.flavorTags
  };
};

interface AppState {
  editMode: boolean;
  setEditMode: (mode: boolean) => void;

  // Tracks when IndexedDB async hydration is complete
  hydrated: boolean;
  setHydrated: () => void;
  
  restaurants: Restaurant[];
  dishes: Dish[];
  restaurantTypes: string[];
  cuisines: string[];
  flavorTags: string[];
  loading: boolean;
  networkBusy: boolean;
  setNetworkBusy: (busy: boolean) => void;
  lastFetch: number | null;
  
  fetchData: (force?: boolean, background?: boolean) => Promise<void>;
  fetchRestaurantPhotos: (restaurantId: string) => Promise<void>;
  
  addRestaurant: (restaurant: Restaurant) => Promise<void>;
  updateRestaurant: (id: string, updates: Partial<Restaurant>) => Promise<void>;
  deleteRestaurant: (id: string) => Promise<void>;
  
  addDish: (dish: Dish) => Promise<void>;
  updateDish: (id: string, updates: Partial<Dish>) => Promise<void>;
  deleteDish: (id: string) => Promise<void>;

  ensureRestaurantType: (value: string) => Promise<void>;
  ensureCuisine: (value: string) => Promise<void>;
  ensureFlavorTag: (value: string) => Promise<void>;

  addRestaurantToState: (restaurant: any) => void;
  updateRestaurantInState: (id: string, updates: any) => void;
  deleteRestaurantFromState: (id: string) => void;

  addDishToState: (dish: any) => void;
  updateDishInState: (id: string, updates: any) => void;
  deleteDishFromState: (id: string) => void;
}

let activeFetchId = 0;
let activeFetchPromise: Promise<void> | null = null;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      editMode: false,
      setEditMode: (mode) => set({ editMode: mode }),

      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      
      restaurants: [],
      dishes: [],
      restaurantTypes: [],
      cuisines: [],
      flavorTags: [],
      loading: false,
      networkBusy: false,
      setNetworkBusy: (busy) => set({ networkBusy: busy }),
      lastFetch: null,

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

    fetchData: async (force = false, background = false) => {
      const state = get();
      // Deduplicate concurrent non-forced fetches
      if (activeFetchPromise && !force) {
        return activeFetchPromise;
      }

      // If we already have data loaded from the local DB, run this fetch silently in the background
      const isBackgroundFetch = background || state.restaurants.length > 0;

      const runFetch = async () => {
        if (!isBackgroundFetch) {
          set({ loading: true });
        }
        const fetchId = ++activeFetchId;
        console.log("Starting data fetch from Supabase... (Fetch ID:", fetchId, ")");
        try {
          let restRes: any;
          let dishRes: any;
          let typeRes: any;
          let cuisineRes: any;
          let flavorTagRes: any;

          let retries = 3;
          let delayMs = 1000;

          while (retries > 0) {
            try {
              const [rRes, dRes, tRes, cRes, fRes] = await Promise.all([
                supabase.from('restaurants').select('id, name, lat, lng, location_name, address, veg_only, notes, image_url, photos, primary_photo_id, type, cuisine, cost_for_two, ambience_rating, service_rating, created_at'),
                supabase.from('dishes').select('id, restaurant_id, name, rating, price_level, actual_price, review, review_date, reviews, image_url, photos, primary_photo_id, is_recommended, cuisine, flavor_tags'),
                supabase.from('restaurant_types').select('name'),
                supabase.from('cuisines').select('name'),
                supabase.from('flavor_tags').select('name')
              ]);

              restRes = rRes;
              dishRes = dRes;
              typeRes = tRes;
              cuisineRes = cRes;
              flavorTagRes = fRes;

              if (!restRes.error && !dishRes.error) {
                break;
              }
              console.warn("Retrying fetch due to error in critical queries:", { restError: restRes.error, dishError: dishRes.error });
            } catch (err) {
              console.warn("Retrying fetch due to parallel Promise.all exception:", err);
            }

            retries--;
            if (retries === 0) break;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            delayMs *= 2;
          }

          if (fetchId !== activeFetchId) {
            console.log("Fetch ID mismatch. Aborting this fetch.", fetchId);
            return;
          }

          if (!restRes || restRes.error) {
            console.error("Restaurant fetch error after retries:", restRes?.error);
            return;
          }

          console.log("Supabase Restaurants Response:", { data: restRes.data });

          let mappedRests: Restaurant[] = state.restaurants;
          let mappedDishes: Dish[] = state.dishes;

          if (restRes.data) {
            mappedRests = restRes.data.map(normalizeDbRestaurant);

            try {
              // Push restaurants as soon as they are ready so map pins can render earlier.
              set({ restaurants: mappedRests });
            } catch (e) {
              console.warn("Storage quota exceeded while caching restaurants:", e);
            }
          }

          console.log("Supabase Dishes Response:", { data: dishRes?.data, error: dishRes?.error });
          if (!dishRes || dishRes.error) {
            console.error("Dish fetch error after retries:", dishRes?.error);
            return;
          }

          if (typeRes?.error && !typeRes.error.message.includes('does not exist')) console.error("Restaurant types fetch error:", typeRes.error);
          if (cuisineRes?.error && !cuisineRes.error.message.includes('does not exist')) console.error("Cuisines fetch error:", cuisineRes.error);
          if (flavorTagRes?.error && !flavorTagRes.error.message.includes('does not exist')) console.error("Flavor tags fetch error:", flavorTagRes.error);

          if (dishRes.data) {
            mappedDishes = dishRes.data.map(normalizeDbDish);
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
            flavorTags: uniqueSorted(tableFlavorTags.length > 0 ? tableFlavorTags : derivedFlavorTags),
            lastFetch: Date.now()
          });

          void cacheImageUrlsForState(mappedRests, mappedDishes);
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          if (!isBackgroundFetch) {
            set({ loading: false });
          }
        }
      };

      const promise = runFetch();
      activeFetchPromise = promise.finally(() => {
        if (activeFetchPromise === promise) {
          activeFetchPromise = null;
        }
      });
      return promise;
    },
    
    fetchRestaurantPhotos: async (restaurantId: string) => {
      const state = get();
      const currentRestaurant = state.restaurants.find((restaurant) => restaurant.id === restaurantId);
      const currentDishes = state.dishes.filter((dish) => dish.restaurantId === restaurantId);

      const restaurantHasPhotos = Boolean(currentRestaurant && ((currentRestaurant.photos?.length ?? 0) > 0 || currentRestaurant.imageUrl));
      const dishesHavePhotos = currentDishes.length === 0 || currentDishes.every((dish) => ((dish.photos?.length ?? 0) > 0 || dish.imageUrl));

      if (restaurantHasPhotos && dishesHavePhotos) {
        return;
      }

      const restPromise = supabase
        .from('restaurants')
        .select('photos, image_url, primary_photo_id')
        .eq('id', restaurantId)
        .single();
      const dishPromise = supabase
        .from('dishes')
        .select('id, photos, image_url, primary_photo_id')
        .eq('restaurant_id', restaurantId);

      const [restRes, dishRes] = await Promise.all([restPromise, dishPromise]);

      if (restRes.error) {
        console.error("Error fetching restaurant photos on-demand:", restRes.error);
        return;
      }

      const updatedRests = state.restaurants.map((r) => {
        if (r.id !== restaurantId) return r;
        const photos = normalizePhotos(restRes.data.photos, restRes.data.image_url);
        const primaryPhotoId = resolvePrimaryPhotoId(photos, restRes.data.primary_photo_id);
        const imageUrl = resolvePrimaryPhotoUrl(photos, primaryPhotoId, restRes.data.image_url);
        return {
          ...r,
          photos: photos.length > 0 ? photos : undefined,
          primaryPhotoId,
          imageUrl
        };
      });

      const dishData = dishRes.data || [];
      const updatedDishes = state.dishes.map((d) => {
        if (d.restaurantId !== restaurantId) return d;
        const matched = dishData.find((dbDish) => dbDish.id === d.id);
        if (!matched) return d;
        const photos = normalizePhotos(matched.photos, matched.image_url);
        const primaryPhotoId = resolvePrimaryPhotoId(photos, matched.primary_photo_id);
        const imageUrl = resolvePrimaryPhotoUrl(photos, primaryPhotoId, matched.image_url);
        return {
          ...d,
          photos: photos.length > 0 ? photos : undefined,
          primaryPhotoId,
          imageUrl
        };
      });

      set({
        restaurants: updatedRests,
        dishes: updatedDishes
      });

      void cacheImageUrlsForState(updatedRests, updatedDishes);
    },

    addRestaurant: async (restaurant) => {
      set({ networkBusy: true });
      try {
        let uploadedImageUrl = restaurant.imageUrl;
        if (restaurant.imageUrl && restaurant.imageUrl.startsWith('data:')) {
          uploadedImageUrl = await uploadImage(restaurant.imageUrl);
        }

        let uploadedPhotos = restaurant.photos;
        if (Array.isArray(restaurant.photos)) {
          uploadedPhotos = await Promise.all(
            restaurant.photos.map(async (photo) => {
              if (photo && photo.url && photo.url.startsWith('data:')) {
                const url = await uploadImage(photo.url);
                return { ...photo, url };
              }
              return photo;
            })
          );
        }

        const normalizedPhotos = normalizePhotos(uploadedPhotos, uploadedImageUrl);
        const primaryPhotoId = resolvePrimaryPhotoId(normalizedPhotos, restaurant.primaryPhotoId);
        const resolvedImageUrl = resolvePrimaryPhotoUrl(normalizedPhotos, primaryPhotoId, uploadedImageUrl);
        const normalizedRestaurant: Restaurant = {
          ...restaurant,
          photos: normalizedPhotos.length > 0 ? normalizedPhotos : undefined,
          primaryPhotoId,
          imageUrl: resolvedImageUrl
        };

      const dbRest: any = {
        ...normalizedRestaurant,
        image_url: normalizedRestaurant.imageUrl,
        photos: normalizedRestaurant.photos,
        primary_photo_id: normalizedRestaurant.primaryPhotoId,
        location_name: normalizedRestaurant.locationName,
        address: normalizedRestaurant.address,
        veg_only: normalizedRestaurant.vegOnly,
        cost_for_two: normalizedRestaurant.costForTwo,
        ambience_rating: normalizedRestaurant.ambienceRating,
        service_rating: normalizedRestaurant.serviceRating,
        created_at: normalizedRestaurant.createdAt ? new Date(normalizedRestaurant.createdAt).toISOString() : undefined
      };
      delete (dbRest as any).createdAt;
      delete (dbRest as any).imageUrl;
      delete (dbRest as any).primaryPhotoId;
      delete (dbRest as any).locationName;
      delete (dbRest as any).vegOnly;
      delete (dbRest as any).costForTwo;
      delete (dbRest as any).ambienceRating;
      delete (dbRest as any).serviceRating;

      let { error } = await supabase.from('restaurants').insert(dbRest);
      while (
        error
        && removeMissingColumnsFromPayload(dbRest, error, ['photos', 'primary_photo_id', 'location_name', 'address', 'veg_only', 'ambience_rating', 'service_rating'])
      ) {
        const retry = await supabase.from('restaurants').insert(dbRest);
        error = retry.error;
      }
      if (error) {
          throw new Error(error.message);
        }
        set((state) => ({ restaurants: [...state.restaurants, normalizedRestaurant] }));
      } finally {
        set({ networkBusy: false });
      }
    },
    updateRestaurant: async (id, updates) => {
      set({ networkBusy: true });
      try {
        const current = get().restaurants.find((restaurant) => restaurant.id === id);
        const normalizedUpdates = { ...updates };

        if (normalizedUpdates.imageUrl && normalizedUpdates.imageUrl.startsWith('data:')) {
          normalizedUpdates.imageUrl = await uploadImage(normalizedUpdates.imageUrl);
        }

        if (Array.isArray(normalizedUpdates.photos)) {
          normalizedUpdates.photos = await Promise.all(
            normalizedUpdates.photos.map(async (photo) => {
              if (photo && photo.url && photo.url.startsWith('data:')) {
                const url = await uploadImage(photo.url);
                return { ...photo, url };
              }
              return photo;
            })
          );
        }

        if (normalizedUpdates.photos !== undefined || normalizedUpdates.primaryPhotoId !== undefined || normalizedUpdates.imageUrl !== undefined) {
          const nextPhotos = normalizePhotos(
            normalizedUpdates.photos ?? current?.photos,
            normalizedUpdates.imageUrl ?? current?.imageUrl
          );
          const nextPrimaryPhotoId = resolvePrimaryPhotoId(nextPhotos, normalizedUpdates.primaryPhotoId ?? current?.primaryPhotoId);
          normalizedUpdates.photos = nextPhotos.length > 0 ? nextPhotos : undefined;
          normalizedUpdates.primaryPhotoId = nextPrimaryPhotoId;
          normalizedUpdates.imageUrl = resolvePrimaryPhotoUrl(nextPhotos, nextPrimaryPhotoId, normalizedUpdates.imageUrl ?? current?.imageUrl);
        }

      const dbUpdates = { ...normalizedUpdates };
      if (dbUpdates.imageUrl !== undefined) {
        (dbUpdates as any).image_url = dbUpdates.imageUrl;
        delete dbUpdates.imageUrl;
      }
      if ((dbUpdates as any).photos !== undefined) {
        (dbUpdates as any).photos = (dbUpdates as any).photos;
      }
      if ((dbUpdates as any).primaryPhotoId !== undefined) {
        (dbUpdates as any).primary_photo_id = (dbUpdates as any).primaryPhotoId;
        delete (dbUpdates as any).primaryPhotoId;
      }
      if ((dbUpdates as any).locationName !== undefined) {
        (dbUpdates as any).location_name = (dbUpdates as any).locationName;
        delete (dbUpdates as any).locationName;
      }
      if ((dbUpdates as any).vegOnly !== undefined) {
        (dbUpdates as any).veg_only = Boolean((dbUpdates as any).vegOnly);
        delete (dbUpdates as any).vegOnly;
      }
      if (dbUpdates.costForTwo !== undefined) {
        (dbUpdates as any).cost_for_two = dbUpdates.costForTwo;
        delete dbUpdates.costForTwo;
      }
      if ((dbUpdates as any).ambienceRating !== undefined) {
        (dbUpdates as any).ambience_rating = (dbUpdates as any).ambienceRating;
        delete (dbUpdates as any).ambienceRating;
      }
      if ((dbUpdates as any).serviceRating !== undefined) {
        (dbUpdates as any).service_rating = (dbUpdates as any).serviceRating;
        delete (dbUpdates as any).serviceRating;
      }

      let { error } = await supabase.from('restaurants').update(dbUpdates).eq('id', id);
      while (
        error
        && removeMissingColumnsFromPayload(dbUpdates as any, error, ['photos', 'primary_photo_id', 'location_name', 'address', 'veg_only', 'ambience_rating', 'service_rating'])
      ) {
        const retry = await supabase.from('restaurants').update(dbUpdates).eq('id', id);
        error = retry.error;
      }
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({
        restaurants: state.restaurants.map((r) => r.id === id ? { ...r, ...normalizedUpdates } : r)
      }));
      } finally {
        set({ networkBusy: false });
      }
    },
    deleteRestaurant: async (id) => {
      activeFetchId++; // Invalidate any ongoing background fetches
      const { error: dishError } = await supabase.from('dishes').delete().eq('restaurant_id', id);
      if (dishError) {
        throw new Error(dishError.message);
      }
      const { error: restaurantError } = await supabase.from('restaurants').delete().eq('id', id);
      if (restaurantError) {
        throw new Error(restaurantError.message);
      }
      set((state) => ({
        restaurants: state.restaurants.filter((r) => r.id !== id),
        dishes: state.dishes.filter(d => d.restaurantId !== id)
      }));
    },
    
    addDish: async (dish) => {
      const normalizedName = dish.name.trim().toLowerCase();
      const existing = get().dishes.find(
        (item) => item.restaurantId === dish.restaurantId && item.name.trim().toLowerCase() === normalizedName
      );

      const incomingReviews = normalizeReviews(dish.reviews, dish.review, dish.reviewDate);

      if (existing) {
        const mergedReviews = normalizeReviews(
          [...(existing.reviews ?? []), ...incomingReviews],
          existing.review,
          existing.reviewDate
        );
        const mergedFlavorTags = Array.from(
          new Set([...(existing.flavorTags ?? []), ...(dish.flavorTags ?? [])].filter(Boolean))
        );

        const mergedPhotos = normalizePhotos(
          [...(existing.photos ?? []), ...(dish.photos ?? [])],
          dish.imageUrl || existing.imageUrl
        );
        const mergedPrimaryPhotoId = resolvePrimaryPhotoId(mergedPhotos, dish.primaryPhotoId ?? existing.primaryPhotoId);
        const mergedImageUrl = resolvePrimaryPhotoUrl(mergedPhotos, mergedPrimaryPhotoId, dish.imageUrl || existing.imageUrl);

        await get().updateDish(existing.id, {
          rating: dish.rating,
          priceLevel: Math.min(3, Math.max(1, dish.priceLevel)) as 1 | 2 | 3,
          actualPrice: dish.actualPrice ?? existing.actualPrice,
          imageUrl: mergedImageUrl,
          photos: mergedPhotos.length > 0 ? mergedPhotos : undefined,
          primaryPhotoId: mergedPrimaryPhotoId,
          isRecommended: dish.isRecommended ?? existing.isRecommended,
          cuisine: dish.cuisine || existing.cuisine,
          flavorTags: mergedFlavorTags.length > 0 ? mergedFlavorTags : undefined,
          review: mergedReviews[0]?.text,
          reviewDate: mergedReviews[0]?.date,
          reviews: mergedReviews.length > 0 ? mergedReviews : undefined
        });
        return;
      }

      let uploadedImageUrl = dish.imageUrl;
      if (dish.imageUrl && dish.imageUrl.startsWith('data:')) {
        uploadedImageUrl = await uploadImage(dish.imageUrl);
      }

      let uploadedPhotos = dish.photos;
      if (Array.isArray(dish.photos)) {
        uploadedPhotos = await Promise.all(
          dish.photos.map(async (photo) => {
            if (photo && photo.url && photo.url.startsWith('data:')) {
              const url = await uploadImage(photo.url);
              return { ...photo, url };
            }
            return photo;
          })
        );
      }

      const latestReview = incomingReviews[0];
      const safePriceLevel = Math.min(3, Math.max(1, dish.priceLevel)) as 1 | 2 | 3;
      const normalizedPhotos = normalizePhotos(uploadedPhotos, uploadedImageUrl);
      const primaryPhotoId = resolvePrimaryPhotoId(normalizedPhotos, dish.primaryPhotoId);
      const resolvedImageUrl = resolvePrimaryPhotoUrl(normalizedPhotos, primaryPhotoId, uploadedImageUrl);
      // Map to snake_case if your Supabase column is named 'restaurant_id'
      const { restaurantId, ...rest } = dish;
      const dbDish: any = {
        ...rest,
        restaurant_id: restaurantId,
        price_level: safePriceLevel,
        review: latestReview?.text ?? rest.review,
        review_date: latestReview?.date ?? rest.reviewDate,
        reviews: incomingReviews.length > 0 ? incomingReviews : undefined,
        image_url: resolvedImageUrl,
        photos: normalizedPhotos.length > 0 ? normalizedPhotos : undefined,
        primary_photo_id: primaryPhotoId,
        is_recommended: Boolean(rest.isRecommended),
        flavor_tags: rest.flavorTags
      };
      if (typeof rest.actualPrice === 'number' && Number.isFinite(rest.actualPrice)) {
        dbDish.actual_price = rest.actualPrice;
      }
      delete dbDish.priceLevel;
      delete dbDish.actualPrice;
      delete dbDish.reviewDate;
      delete dbDish.imageUrl;
      delete dbDish.primaryPhotoId;
      delete dbDish.isRecommended;
      delete dbDish.flavorTags;
      if (!dbDish.review_date) {
        delete dbDish.review_date;
      }
      if (!dbDish.reviews) {
        delete dbDish.reviews;
      }
      
      let { error } = await supabase.from('dishes').insert(dbDish);
      while (
        error
        && removeMissingColumnsFromPayload(
          dbDish,
          error,
          ['actual_price', 'review_date', 'reviews', 'photos', 'primary_photo_id', 'is_recommended', 'cuisine', 'flavor_tags']
        )
      ) {
        const retry = await supabase.from('dishes').insert(dbDish);
        error = retry.error;
      }
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({
        dishes: [
          ...state.dishes,
          {
            ...dish,
            priceLevel: safePriceLevel,
            photos: normalizedPhotos.length > 0 ? normalizedPhotos : undefined,
            primaryPhotoId,
            imageUrl: resolvedImageUrl,
            isRecommended: Boolean(dish.isRecommended),
            review: latestReview?.text ?? dish.review,
            reviewDate: latestReview?.date ?? dish.reviewDate,
            reviews: incomingReviews.length > 0 ? incomingReviews : undefined
          }
        ]
      }));
    },
    updateDish: async (id, updates) => {
      const current = get().dishes.find((dish) => dish.id === id);
      const normalizedUpdates: Partial<Dish> = { ...updates };

      if (normalizedUpdates.imageUrl && normalizedUpdates.imageUrl.startsWith('data:')) {
        normalizedUpdates.imageUrl = await uploadImage(normalizedUpdates.imageUrl);
      }

      if (Array.isArray(normalizedUpdates.photos)) {
        normalizedUpdates.photos = await Promise.all(
          normalizedUpdates.photos.map(async (photo) => {
            if (photo && photo.url && photo.url.startsWith('data:')) {
              const url = await uploadImage(photo.url);
              return { ...photo, url };
            }
            return photo;
          })
        );
      }

      if (normalizedUpdates.photos !== undefined || normalizedUpdates.primaryPhotoId !== undefined || normalizedUpdates.imageUrl !== undefined) {
        const nextPhotos = normalizePhotos(
          normalizedUpdates.photos ?? current?.photos,
          normalizedUpdates.imageUrl ?? current?.imageUrl
        );
        const nextPrimaryPhotoId = resolvePrimaryPhotoId(nextPhotos, normalizedUpdates.primaryPhotoId ?? current?.primaryPhotoId);
        normalizedUpdates.photos = nextPhotos.length > 0 ? nextPhotos : undefined;
        normalizedUpdates.primaryPhotoId = nextPrimaryPhotoId;
        normalizedUpdates.imageUrl = resolvePrimaryPhotoUrl(nextPhotos, nextPrimaryPhotoId, normalizedUpdates.imageUrl ?? current?.imageUrl);
      }

      const dbUpdates: any = { ...normalizedUpdates };
      if (dbUpdates.priceLevel !== undefined) {
        dbUpdates.priceLevel = Math.min(3, Math.max(1, Number(dbUpdates.priceLevel)));
      }
      if (dbUpdates.restaurantId) {
        dbUpdates.restaurant_id = dbUpdates.restaurantId;
        delete dbUpdates.restaurantId;
      }
      if (dbUpdates.priceLevel !== undefined) {
        dbUpdates.price_level = dbUpdates.priceLevel;
        delete dbUpdates.priceLevel;
      }
      if (dbUpdates.actualPrice !== undefined) {
        dbUpdates.actual_price = dbUpdates.actualPrice;
        delete dbUpdates.actualPrice;
      }
      if (dbUpdates.reviewDate !== undefined) {
        dbUpdates.review_date = dbUpdates.reviewDate;
        delete dbUpdates.reviewDate;
      }
      if (dbUpdates.imageUrl !== undefined) {
        dbUpdates.image_url = dbUpdates.imageUrl;
        delete dbUpdates.imageUrl;
      }
      if (dbUpdates.photos !== undefined) {
        dbUpdates.photos = dbUpdates.photos;
      }
      if (dbUpdates.primaryPhotoId !== undefined) {
        dbUpdates.primary_photo_id = dbUpdates.primaryPhotoId;
        delete dbUpdates.primaryPhotoId;
      }
      if (dbUpdates.isRecommended !== undefined) {
        dbUpdates.is_recommended = Boolean(dbUpdates.isRecommended);
        delete dbUpdates.isRecommended;
      }
      if (dbUpdates.flavorTags !== undefined) {
        dbUpdates.flavor_tags = dbUpdates.flavorTags;
        delete dbUpdates.flavorTags;
      }
      
      let { error } = await supabase.from('dishes').update(dbUpdates).eq('id', id);
      while (
        error
        && removeMissingColumnsFromPayload(
          dbUpdates,
          error,
          ['actual_price', 'review_date', 'reviews', 'photos', 'primary_photo_id', 'is_recommended', 'cuisine', 'flavor_tags']
        )
      ) {
        const retry = await supabase.from('dishes').update(dbUpdates).eq('id', id);
        error = retry.error;
      }
      if (error) {
        throw new Error(error.message);
      }
      set((state) => ({
        dishes: state.dishes.map((d) => d.id === id ? { ...d, ...normalizedUpdates } : d)
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

    addRestaurantToState: (restaurant: any) => {
      const normalized = normalizeDbRestaurant(restaurant);
      set((state) => {
        if (state.restaurants.some((r) => r.id === normalized.id)) {
          return {
            restaurants: state.restaurants.map((r) => r.id === normalized.id ? normalized : r)
          };
        }
        return {
          restaurants: [...state.restaurants, normalized]
        };
      });
    },
    updateRestaurantInState: (id: string, updates: any) => {
      set((state) => {
        const existing = state.restaurants.find((r) => r.id === id);
        if (!existing) return state;
        
        const normalized = normalizeDbRestaurant({
          ...existing,
          ...updates,
          photos: updates.photos !== undefined ? updates.photos : existing.photos,
          image_url: updates.image_url !== undefined ? updates.image_url : (updates.imageUrl !== undefined ? updates.imageUrl : existing.imageUrl),
          primary_photo_id: updates.primary_photo_id !== undefined ? updates.primary_photo_id : (updates.primaryPhotoId !== undefined ? updates.primaryPhotoId : existing.primaryPhotoId),
          location_name: updates.location_name !== undefined ? updates.location_name : (updates.locationName !== undefined ? updates.locationName : existing.locationName),
          veg_only: updates.veg_only !== undefined ? updates.veg_only : (updates.vegOnly !== undefined ? updates.vegOnly : existing.vegOnly),
          cost_for_two: updates.cost_for_two !== undefined ? updates.cost_for_two : (updates.costForTwo !== undefined ? updates.costForTwo : existing.costForTwo),
          ambience_rating: updates.ambience_rating !== undefined ? updates.ambience_rating : (updates.ambienceRating !== undefined ? updates.ambienceRating : existing.ambienceRating),
          service_rating: updates.service_rating !== undefined ? updates.service_rating : (updates.serviceRating !== undefined ? updates.serviceRating : existing.serviceRating)
        });

        return {
          restaurants: state.restaurants.map((r) => r.id === id ? normalized : r)
        };
      });
    },
    deleteRestaurantFromState: (id: string) => {
      set((state) => ({
        restaurants: state.restaurants.filter((r) => r.id !== id),
        dishes: state.dishes.filter((d) => d.restaurantId !== id)
      }));
    },

    addDishToState: (dish: any) => {
      const normalized = normalizeDbDish(dish);
      set((state) => {
        if (state.dishes.some((d) => d.id === normalized.id)) {
          return {
            dishes: state.dishes.map((d) => d.id === normalized.id ? normalized : d)
          };
        }
        return {
          dishes: [...state.dishes, normalized]
        };
      });
    },
    updateDishInState: (id: string, updates: any) => {
      set((state) => {
        const existing = state.dishes.find((d) => d.id === id);
        if (!existing) return state;

        const normalized = normalizeDbDish({
          ...existing,
          ...updates,
          restaurant_id: updates.restaurant_id !== undefined ? updates.restaurant_id : (updates.restaurantId !== undefined ? updates.restaurantId : existing.restaurantId),
          price_level: updates.price_level !== undefined ? updates.price_level : (updates.priceLevel !== undefined ? updates.priceLevel : existing.priceLevel),
          actual_price: updates.actual_price !== undefined ? updates.actual_price : (updates.actualPrice !== undefined ? updates.actualPrice : existing.actualPrice),
          review_date: updates.review_date !== undefined ? updates.review_date : (updates.reviewDate !== undefined ? updates.reviewDate : existing.reviewDate),
          image_url: updates.image_url !== undefined ? updates.image_url : (updates.imageUrl !== undefined ? updates.imageUrl : existing.imageUrl),
          primary_photo_id: updates.primary_photo_id !== undefined ? updates.primary_photo_id : (updates.primaryPhotoId !== undefined ? updates.primaryPhotoId : existing.primaryPhotoId),
          is_recommended: updates.is_recommended !== undefined ? updates.is_recommended : (updates.isRecommended !== undefined ? updates.isRecommended : existing.isRecommended),
          flavor_tags: updates.flavor_tags !== undefined ? updates.flavor_tags : (updates.flavorTags !== undefined ? updates.flavorTags : existing.flavorTags)
        });

        return {
          dishes: state.dishes.map((d) => d.id === id ? normalized : d)
        };
      });
    },
    deleteDishFromState: (id: string) => {
      set((state) => ({
        dishes: state.dishes.filter((d) => d.id !== id)
      }));
    },
  }),
  {
    name: 'soboite-storage-v3',
    storage: createJSONStorage(() => indexedDBStorage),
    partialize: (state) => ({
      editMode: state.editMode,
      restaurants: state.restaurants,
      dishes: state.dishes,
      restaurantTypes: state.restaurantTypes,
      cuisines: state.cuisines,
      flavorTags: state.flavorTags,
      lastFetch: state.lastFetch,
    }),
    // Called when IndexedDB async rehydration finishes — signals UI to stop blocking
    onRehydrateStorage: () => (state) => {
      if (state) {
        state.setHydrated();
      }
    },
  }
  )
);

