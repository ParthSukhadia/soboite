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
  const [showRanking, setShowRanking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseClient();
      if (!supabase) throw new Error('Supabase env variables not found. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.');
      const { data, error } = await supabase.from("restaurants").select('*').limit(200);
      console.log(data)
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
    <div className="relative h-screen">
      <MapView restaurants={restaurants} onViewDetails={handleSelect} />

      <header className="absolute top-0 left-0 right-0 p-4 bg-black bg-opacity-50 text-white z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Discover Restaurants</h1>
          <p className="text-sm opacity-90">Live rankings and map powered by Supabase</p>
        </div>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => setShowRanking(true)}
        >
          Show Rankings
        </button>
      </header>

      {loading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 p-4 rounded">
          Loading restaurants…
        </div>
      )}
      {error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-400 bg-black bg-opacity-50 p-4 rounded">
          {error}
        </div>
      )}

      {showRanking && (
        <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Live Rankings</h2>
            <RankingList tableName={TABLE} onSelect={(id) => { handleSelect(id); setShowRanking(false); }} />
            <button
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              onClick={() => setShowRanking(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
