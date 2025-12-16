"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { createSupabaseClient } from '../lib/supabaseClient';
import RestaurantCard, { Restaurant } from '../components/RestaurantCard';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('../components/MapView'), { ssr: false });
import RankingList from '../components/RankingList';

const TABLE = process.env.NEXT_PUBLIC_SUPABASE_RESTAURANTS_TABLE ?? process.env.NEXT_PUBLIC_SUPABASE_TEST_TABLE ?? 'restaurants';

export default function Page() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseClient();
      if (!supabase) throw new Error('Supabase env variables not found. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.');
      const { data, error } = await supabase.from(TABLE).select('*').order('rating', { ascending: false }).limit(200);
      if (error) throw error;
      setRestaurants((data as Restaurant[]) ?? []);
    } catch (err: any) {
      setError(String(err.message ?? err));
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [TABLE]);

  useEffect(() => {
    load();

    // Subscribe to realtime updates — on change, re-fetch
    const supabase = createSupabaseClient();
    if (!supabase) {
      // nothing to subscribe to
      return;
    }

    let unsubCleanup: (() => void) | null = null;

    const channel = (supabase as any)?.channel?.('public:restaurants-updates');
    if (channel) {
      const ch = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
          load();
        })
        .subscribe();
      unsubCleanup = () => ch.unsubscribe();
    } else if ((supabase as any)?.from) {
      try {
        // @ts-ignore
        const sub = supabase.from(`${TABLE}`).on('*', () => {
          load();
        }).subscribe();
        unsubCleanup = () => sub.unsubscribe?.();
      } catch (_) {
        // ignore
      }
    }

    return () => {
      try {
        unsubCleanup?.();
      } catch (_) {
        // ignore
      }
      try {
        (supabase as any)?.removeAllSubscriptions?.();
      } catch (_) {
        // ignore
      }
    };
  }, [load]);

  const handleSelect = (id: string | number) => {
    // Placeholder for view details behavior — could navigate to details page
    const r = restaurants.find((x) => x.id === id);
    if (r) alert(`Selected: ${r.name}`);
  };

  return (
    <div className="md:flex md:gap-6">
      <div className="md:flex-1">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">Discover Restaurants</h1>
          <p className="text-sm text-gray-600">Live rankings and map powered by Supabase</p>
        </header>

        {loading && <div className="text-sm text-gray-600">Loading restaurants…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map((r, idx) => (
            <RestaurantCard
              key={`${r.id ?? idx}-${String(r.name ?? '').slice(0, 12)}`}
              restaurant={r}
              onClick={() => handleSelect(r.id)}
            />
          ))}
        </div>
      </div>

      <aside className="md:w-96 md:sticky md:top-6 mt-6 md:mt-0">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Live Rankings</h2>
        </div>
        <div className="mb-6">
          <RankingList tableName={TABLE} onSelect={handleSelect} />
        </div>

        <div>
          <h2 className="text-lg font-medium mb-2">Map</h2>
          <MapView restaurants={restaurants} onViewDetails={handleSelect} />
        </div>
      </aside>
    </div>
  );
}
