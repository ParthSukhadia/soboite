import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import CachedImage from '../components/CachedImage';
import { Dish, Restaurant } from '../types';

type SortKey = 'rating' | 'priceAsc' | 'priceDesc' | 'dish' | 'restaurant';

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'rating', label: 'Best rating' },
  { value: 'priceAsc', label: 'Lowest price' },
  { value: 'priceDesc', label: 'Highest price' },
  { value: 'dish', label: 'Dish name' },
  { value: 'restaurant', label: 'Restaurant name' }
];

const filterAndSortRecommended = (
  restaurants: Restaurant[],
  dishes: Dish[],
  filters: {
    query: string;
    restaurantId: string;
    restaurantType: string;
    cuisine: string;
    flavorTag: string;
    priceLevel: string;
    minRating: number;
    sortKey: SortKey;
  }
) => {
  const restaurantMap = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  return dishes
    .filter((dish) => dish.isRecommended)
    .map((dish) => ({ dish, restaurant: restaurantMap.get(dish.restaurantId) }))
    .filter((entry) => entry.restaurant)
    .filter(({ dish, restaurant }) => {
      const restaurantName = restaurant?.name ?? '';
      const cuisine = dish.cuisine || restaurant?.cuisine || '';
      const type = restaurant?.type || '';
      const tags = dish.flavorTags ?? [];
      const query = filters.query.trim().toLowerCase();
      const matchesQuery =
        !query ||
        dish.name.toLowerCase().includes(query) ||
        restaurantName.toLowerCase().includes(query) ||
        cuisine.toLowerCase().includes(query) ||
        tags.some((tag) => tag.toLowerCase().includes(query));

      const matchesRestaurant = !filters.restaurantId || dish.restaurantId === filters.restaurantId;
      const matchesType = !filters.restaurantType || type === filters.restaurantType;
      const matchesCuisine = !filters.cuisine || cuisine === filters.cuisine;
      const matchesFlavor = !filters.flavorTag || tags.includes(filters.flavorTag);
      const matchesPrice = !filters.priceLevel || dish.priceLevel === Number(filters.priceLevel);
      const matchesRating = !filters.minRating || dish.rating >= filters.minRating;

      return (
        matchesQuery &&
        matchesRestaurant &&
        matchesType &&
        matchesCuisine &&
        matchesFlavor &&
        matchesPrice &&
        matchesRating
      );
    })
    .sort((a, b) => {
      switch (filters.sortKey) {
        case 'rating':
          if (b.dish.rating !== a.dish.rating) return b.dish.rating - a.dish.rating;
          break;
        case 'priceAsc': {
          const aPrice = a.dish.actualPrice ?? Number.POSITIVE_INFINITY;
          const bPrice = b.dish.actualPrice ?? Number.POSITIVE_INFINITY;
          if (aPrice !== bPrice) return aPrice - bPrice;
          break;
        }
        case 'priceDesc': {
          const aPrice = a.dish.actualPrice ?? 0;
          const bPrice = b.dish.actualPrice ?? 0;
          if (aPrice !== bPrice) return bPrice - aPrice;
          break;
        }
        case 'dish': {
          const diff = a.dish.name.localeCompare(b.dish.name);
          if (diff !== 0) return diff;
          break;
        }
        case 'restaurant': {
          const diff = (a.restaurant?.name || '').localeCompare(b.restaurant?.name || '');
          if (diff !== 0) return diff;
          break;
        }
      }
      if (b.dish.rating !== a.dish.rating) return b.dish.rating - a.dish.rating;
      return a.dish.name.localeCompare(b.dish.name);
    });
};

export default function RecommendedDishesPage() {
  const { dishes, restaurants, loading, fetchData } = useStore();
  const [query, setQuery] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [restaurantType, setRestaurantType] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [flavorTag, setFlavorTag] = useState('');
  const [priceLevel, setPriceLevel] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('rating');

  useEffect(() => {
    if (restaurants.length === 0 || dishes.length === 0) {
      void fetchData();
    }
  }, [restaurants.length, dishes.length, fetchData]);

  const restaurantOptions = useMemo(
    () => restaurants.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [restaurants]
  );

  const restaurantTypes = useMemo(
    () => [...new Set(restaurants.map((restaurant) => restaurant.type).filter(Boolean))] as string[],
    [restaurants]
  );

  const cuisineOptions = useMemo(() => {
    const cuisines = new Set<string>();
    restaurants.forEach((restaurant) => {
      if (restaurant.cuisine) cuisines.add(restaurant.cuisine);
    });
    dishes.forEach((dish) => {
      if (dish.cuisine) cuisines.add(dish.cuisine);
    });
    return [...cuisines].sort();
  }, [restaurants, dishes]);

  const flavorOptions = useMemo(() => {
    const tags = new Set<string>();
    dishes.forEach((dish) => dish.flavorTags?.forEach((tag) => tags.add(tag)));
    return [...tags].sort();
  }, [dishes]);

  const recommendedEntries = useMemo(
    () =>
      filterAndSortRecommended(restaurants, dishes, {
        query,
        restaurantId,
        restaurantType,
        cuisine,
        flavorTag,
        priceLevel,
        minRating,
        sortKey
      }),
    [restaurants, dishes, query, restaurantId, restaurantType, cuisine, flavorTag, priceLevel, minRating, sortKey]
  );

  const clearFilters = () => {
    setQuery('');
    setRestaurantId('');
    setRestaurantType('');
    setCuisine('');
    setFlavorTag('');
    setPriceLevel('');
    setMinRating(0);
    setSortKey('rating');
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 pt-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Recommended dishes</h1>
            <p className="mt-1 text-sm text-gray-500">
              Browse and sort the dishes you marked as recommended, with filters for restaurants, cuisine, price, rating and tags.
            </p>
          </div>
          <Link
            to="/top-picks"
            className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
          >
            View top restaurants
          </Link>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Search</label>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Dish, restaurant, cuisine, tag…"
                  className="mt-2 w-full rounded-2xl border border-transparent bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Restaurant
                  <select
                    value={restaurantId}
                    onChange={(event) => setRestaurantId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    <option value="">All restaurants</option>
                    {restaurantOptions.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Restaurant type
                  <select
                    value={restaurantType}
                    onChange={(event) => setRestaurantType(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    <option value="">All types</option>
                    {restaurantTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Cuisine
                <select
                  value={cuisine}
                  onChange={(event) => setCuisine(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="">All cuisines</option>
                  {cuisineOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Flavor tag
                <select
                  value={flavorTag}
                  onChange={(event) => setFlavorTag(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="">All tags</option>
                  {flavorOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Minimum rating
                <select
                  value={minRating}
                  onChange={(event) => setMinRating(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value={0}>Any rating</option>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} stars & up
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Price level
                <select
                  value={priceLevel}
                  onChange={(event) => setPriceLevel(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="">All prices</option>
                  {[1, 2, 3].map((level) => (
                    <option key={level} value={level}>
                      {'$'.repeat(level)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 sm:items-end">
            <label className="block text-sm font-medium text-gray-700">
              Sort by
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">{recommendedEntries.length} dish{recommendedEntries.length === 1 ? '' : 'es'} found</p>
            </div>
          </div>

          {loading && dishes.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              Loading recommended dishes…
            </div>
          ) : recommendedEntries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              No recommended dishes match the current filters.
            </div>
          ) : (
            <div className="space-y-4">
              {recommendedEntries.map(({ dish, restaurant }) => (
                <div key={dish.id} className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <div className="h-28 overflow-hidden rounded-3xl bg-gray-100">
                      <CachedImage
                        src={dish.imageUrl || restaurant?.imageUrl || ''}
                        alt={dish.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Link to={`/restaurant/${restaurant?.id}`} className="text-lg font-semibold text-gray-900 hover:text-red-600">
                            {dish.name}
                          </Link>
                          <p className="text-sm text-gray-500">{restaurant?.name}</p>
                        </div>
                        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">
                          ★ Recommended
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                        <span>Rating {dish.rating.toFixed(1)}</span>
                        {dish.actualPrice !== undefined && <span>₹{dish.actualPrice}</span>}
                        <span>{'$'.repeat(dish.priceLevel)}</span>
                        {dish.cuisine && <span>{dish.cuisine}</span>}
                        {restaurant?.type && <span>{restaurant.type}</span>}
                        {dish.flavorTags?.map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {dish.review ? <p className="text-sm text-gray-700">{dish.review}</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
