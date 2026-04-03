import { create } from 'zustand';
import { Restaurant, Dish, DishReview, PhotoEntry } from '../types';
import { supabase } from '../lib/supabase';

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
  (set, get) => ({
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
            photos: (() => {
              const photos = normalizePhotos(r.photos, r.image_url);
              return photos.length > 0 ? photos : undefined;
            })(),
            primaryPhotoId: (() => {
              const photos = normalizePhotos(r.photos, r.image_url);
              return resolvePrimaryPhotoId(photos, r.primary_photo_id ?? r.primaryPhotoId);
            })(),
            id: r.id, 
            name: r.name,
            lat: r.lat ?? r.latitude,
            lng: r.lng ?? r.longitude,
            locationName: r.location_name ?? r.locationName,
            address: r.address,
            vegOnly: Boolean(r.veg_only ?? r.vegOnly),
            notes: r.notes,
            imageUrl: (() => {
              const photos = normalizePhotos(r.photos, r.image_url);
              const primary = resolvePrimaryPhotoId(photos, r.primary_photo_id ?? r.primaryPhotoId);
              return resolvePrimaryPhotoUrl(photos, primary, r.image_url);
            })(),
            type: r.type,
            cuisine: r.cuisine,
            costForTwo: r.cost_for_two,
            ambienceRating: r.ambience_rating ?? r.ambienceRating,
            serviceRating: r.service_rating ?? r.serviceRating,
            createdAt: r.created_at || r.createdAt
          }));
        }
        
        if (dishRes.data) {
          mappedDishes = dishRes.data.map((d: any) => {
            const reviews = normalizeReviews(d.reviews, d.review, d.review_date ?? d.reviewDate);
            const latestReview = reviews[0];
            const photos = normalizePhotos(d.photos, d.image_url);
            const primaryPhotoId = resolvePrimaryPhotoId(photos, d.primary_photo_id ?? d.primaryPhotoId);

            return {
              id: d.id,
              name: d.name,
              restaurantId: d.restaurant_id || d.restaurantId,
              rating: d.rating,
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
              flavorTags: d.flavor_tags
            };
          });
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
      const normalizedPhotos = normalizePhotos(restaurant.photos, restaurant.imageUrl);
      const primaryPhotoId = resolvePrimaryPhotoId(normalizedPhotos, restaurant.primaryPhotoId);
      const resolvedImageUrl = resolvePrimaryPhotoUrl(normalizedPhotos, primaryPhotoId, restaurant.imageUrl);
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
    },
    updateRestaurant: async (id, updates) => {
      const current = get().restaurants.find((restaurant) => restaurant.id === id);
      const normalizedUpdates = { ...updates };

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

      const latestReview = incomingReviews[0];
      const safePriceLevel = Math.min(3, Math.max(1, dish.priceLevel)) as 1 | 2 | 3;
      const normalizedPhotos = normalizePhotos(dish.photos, dish.imageUrl);
      const primaryPhotoId = resolvePrimaryPhotoId(normalizedPhotos, dish.primaryPhotoId);
      const resolvedImageUrl = resolvePrimaryPhotoUrl(normalizedPhotos, primaryPhotoId, dish.imageUrl);
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
          ['actual_price', 'review_date', 'reviews', 'photos', 'primary_photo_id', 'is_recommended']
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
          ['actual_price', 'review_date', 'reviews', 'photos', 'primary_photo_id', 'is_recommended']
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
  })
);
