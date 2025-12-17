import React from 'react';

export type Restaurant = {
  restaurant_id: string;
  name: string;
  city: string;
  area: string;
  geo_lat: number;
  geo_lng: number;
  cuisines: string[];
  visited: boolean;
  total_dishes_reviewed: number;
  top_picks: string[];
  meta: {
    first_visit: string; // date as string
    last_visit: string;
  };
  // Optional fields for compatibility
  hero_image_url?: string | null;
  rating?: number | null;
  price_range?: number | null;

  cuisine_tags?: string[] | null; // deprecated, use cuisines
  id?: string | number; // deprecated, use restaurant_id
};

type Props = {
  restaurant: Restaurant;
  onClick?: (id: string | number) => void;
};

// Reusable Restaurant card — mobile-first, clickable, accessible
export default function RestaurantCard({ restaurant, onClick }: Props) {
  const {
    id,
    name,
    hero_image_url,
    cuisine_tags,
    area,
    city,
    rating,
    price_range,
    top_picks,
  } = restaurant;

  const priceLabel = price_range === 1 ? '₹' : price_range === 2 ? '₹₹' : price_range === 3 ? '₹₹₹' : '—';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(id)}
      onKeyDown={(e) => (e.key === 'Enter' ? onClick?.(id) : null)}
      className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150 cursor-pointer"
    >
      <div className="w-full bg-gray-100" style={{ aspectRatio: '4/3' }}>
        {hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero_image_url} alt={`${name} hero`} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">No image</div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-slate-900">{name}</h3>
          <div className="text-sm text-gray-600">{priceLabel}</div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(cuisine_tags ?? []).slice(0, 3).map((tag, i) => (
            <span
              key={`${tag ?? 'tag'}-${i}`}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-3 text-sm text-gray-600 flex items-center justify-between">
          <div>
            <div>{area ?? 'Unknown area'}</div>
            <div className="text-xs text-gray-500">{city ?? 'Unknown city'}</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
                <path d="M12 .587l3.668 7.568L24 9.75l-6 5.847L19.335 24 12 19.897 4.665 24 6 15.597 0 9.75l8.332-1.595z" />
              </svg>
              <span className="text-sm font-medium">{rating ?? '—'}</span>
            </div>
            <div className="text-xs text-gray-500">Top Picks: {(top_picks ?? []).slice(0, 2).join(', ') || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
