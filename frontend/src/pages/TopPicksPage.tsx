import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import CachedImage from '../components/CachedImage';
import { Dish, Restaurant } from '../types';

const buildRestaurantScore = (restaurant: Restaurant, dishRating: number | null) => {
  const ratingParts: number[] = [];
  if (dishRating !== null) ratingParts.push(dishRating * 2);
  const restaurantRatings = [restaurant.ambienceRating, restaurant.serviceRating].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (restaurantRatings.length > 0) {
    const avg = restaurantRatings.reduce((sum, value) => sum + value, 0) / restaurantRatings.length;
    ratingParts.push(avg);
  }
  if (ratingParts.length === 0) return 0;
  return ratingParts.reduce((sum, value) => sum + value, 0) / ratingParts.length;
};

const computeDishScore = (dish: Dish) => {
  return dish.rating || 0;
};

const getRestaurantDishes = (restaurantId: string, dishes: Dish[]) =>
  dishes.filter((dish) => dish.restaurantId === restaurantId).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));

const getTopRestaurantIds = (restaurants: Restaurant[], dishes: Dish[], count: number) => {
  const dishAverages = new Map<string, number>();

  restaurants.forEach((restaurant) => {
    const restaurantDishes = dishes.filter((dish) => dish.restaurantId === restaurant.id);
    if (restaurantDishes.length === 0) {
      dishAverages.set(restaurant.id, 0);
      return;
    }
    const avg = restaurantDishes.reduce((sum, dish) => sum + computeDishScore(dish), 0) / restaurantDishes.length;
    dishAverages.set(restaurant.id, avg);
  });

  return [...restaurants]
    .sort((a, b) => {
      const aScore = buildRestaurantScore(a, dishAverages.get(a.id) ?? null);
      const bScore = buildRestaurantScore(b, dishAverages.get(b.id) ?? null);
      if (bScore !== aScore) return bScore - aScore;
      return (dishAverages.get(b.id) ?? 0) - (dishAverages.get(a.id) ?? 0);
    })
    .slice(0, count)
    .map((restaurant) => restaurant.id);
};

const joinIds = (ids: string[]) => ids.filter(Boolean).join(',');

export default function TopPicksPage() {
  const { restaurants, dishes, loading, fetchData } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [topCount, setTopCount] = useState(3);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const sharedIds = useMemo(() => {
    const raw = searchParams.get('restos');
    if (!raw) return [];
    return raw.split(',').map((id) => id.trim()).filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    if (restaurants.length === 0 || dishes.length === 0) {
      void fetchData();
    }
  }, [restaurants.length, dishes.length, fetchData]);

  useEffect(() => {
    const countParam = Number(searchParams.get('count'));
    if (countParam === 3 || countParam === 5) {
      setTopCount(countParam);
    }
  }, [searchParams]);

  const topRestaurantIds = useMemo(() => {
    if (sharedIds.length > 0) return sharedIds;
    return getTopRestaurantIds(restaurants, dishes, topCount);
  }, [restaurants, dishes, sharedIds, topCount]);

  const topRestaurants = useMemo(
    () => topRestaurantIds.map((id) => restaurants.find((restaurant) => restaurant.id === id)).filter((restaurant): restaurant is Restaurant => Boolean(restaurant)),
    [topRestaurantIds, restaurants]
  );

  const writeTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!success) {
      throw new Error('Clipboard copy not supported');
    }
  };

  const copyShareLink = async () => {
    const currentIds = topRestaurantIds.length > 0 ? topRestaurantIds : getTopRestaurantIds(restaurants, dishes, topCount);
    const baseUrl = window.location.origin + window.location.pathname;
    const hash = `#/top-picks?restos=${encodeURIComponent(joinIds(currentIds))}&count=${topCount}`;
    const shareUrl = `${baseUrl}${hash}`;

    try {
      await writeTextToClipboard(shareUrl);
      setCopied(true);
      setCopyMessage('Link copied');
      window.setTimeout(() => {
        setCopied(false);
        setCopyMessage(null);
      }, 2200);
    } catch (error) {
      console.error('Copy failed', error);
      setCopyMessage('Copy failed. Please try again.');
      window.setTimeout(() => setCopyMessage(null), 2200);
    }
  };

  const selectedRestaurants = topRestaurants;

  const title = sharedIds.length > 0 ? 'Shared top restaurant picks' : `Top ${topCount} restaurants`;
  const description = sharedIds.length > 0
    ? 'A shared list of restaurant favorites and their dishes.'
    : 'Your top restaurant picks with the dishes that make them shine.';

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 pt-6">
      <div className={`pointer-events-none fixed right-4 top-4 z-50 rounded-full bg-black/90 px-4 py-2 text-sm font-medium text-white shadow-xl transition-opacity duration-300 ${copyMessage ? 'opacity-100' : 'opacity-0'}`}>
        {copyMessage || 'Link copied'}
      </div>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!sharedIds.length && (
              <div className="rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-700">
                Showing top {topCount}
              </div>
            )}
            <button
              type="button"
              onClick={copyShareLink}
              className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
            >
              {copied ? 'Link copied' : 'Copy share link'}
            </button>
          </div>
        </div>

        {!sharedIds.length && (
          <div className="flex flex-wrap gap-2">
            {[3, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTopCount(value);
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set('count', String(value));
                  setSearchParams(nextParams, { replace: true });
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${topCount === value ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Top {value}
              </button>
            ))}
          </div>
        )}

        {loading && restaurants.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading restaurant picks…
          </div>
        ) : selectedRestaurants.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            No restaurants available to show yet.
          </div>
        ) : (
          <div className="space-y-6">
            {selectedRestaurants.map((restaurant) => {
              const restaurantDishes = getRestaurantDishes(restaurant.id, dishes);
              return (
                <div key={restaurant.id} className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="grid gap-4 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="relative overflow-hidden rounded-3xl bg-gray-100">
                      <CachedImage
                        src={restaurant.imageUrl || restaurant.photos?.[0]?.url || ''}
                        alt={restaurant.name}
                        className="h-full w-full min-h-[180px] object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                        <p className="text-base font-semibold">{restaurant.name}</p>
                        <p className="text-xs text-gray-200">
                          {restaurant.cuisine ?? restaurant.type ?? 'Restaurant'} · {restaurant.locationName ?? restaurant.address ?? 'Unknown location'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Top pick</span>
                        <Link
                          to={`/restaurant/${restaurant.id}`}
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                        >
                          View restaurant details
                        </Link>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-3xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Dish count</div>
                          <div className="mt-1 text-lg font-semibold">{restaurantDishes.length}</div>
                        </div>
                        <div className="rounded-3xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Average dish rating</div>
                          <div className="mt-1 text-lg font-semibold">
                            {restaurantDishes.length > 0
                              ? (restaurantDishes.reduce((sum, dish) => sum + dish.rating, 0) / restaurantDishes.length).toFixed(1)
                              : '--'}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {restaurantDishes.map((dish) => (
                          <div key={dish.id} className="rounded-3xl border border-gray-100 p-4">
                            <div className="flex items-start gap-4">
                              <div className="h-16 w-16 overflow-hidden rounded-3xl bg-gray-100">
                                <CachedImage
                                  src={dish.imageUrl || restaurant.imageUrl || ''}
                                  alt={dish.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-semibold text-gray-900">{dish.name}</p>
                                  {dish.isRecommended && (
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-500">
                                  <span>Rating {dish.rating.toFixed(1)}</span>
                                  {dish.actualPrice !== undefined && <span>₹{dish.actualPrice}</span>}
                                  {dish.cuisine && <span>{dish.cuisine}</span>}
                                </div>
                                {dish.review ? <p className="mt-2 text-sm text-gray-600">{dish.review}</p> : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
