"use client";

import React, { useEffect, useState } from 'react';
import { createSupabaseClient } from '../lib/supabaseClient';
import { Restaurant } from './RestaurantCard';

type Props = {
  tableName?: string;
  onSelect?: (id: string | number) => void;
};

export default function RankingList({ tableName = 'restaurants', onSelect }: Props) {
  const [items, setItems] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const client = createSupabaseClient();
        if (!client) throw new Error('Supabase client not available. Check NEXT_PUBLIC env vars.');
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .order('rating', { ascending: false })
          .limit(50);
        if (error) throw error;
        if (!cancelled) setItems((data as Restaurant[]) ?? []);
      } catch (err: any) {
        if (!cancelled) setError(String(err.message ?? err));
      }
    };

    load();

    // Subscribe to realtime updates for the table
    const client = createSupabaseClient();
    if (client) {
      const channel = (client as any)?.channel?.('public:rankings');
      if (channel) {
        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
            load();
          })
          .subscribe();
      } else if ((client as any)?.from) {
        try {
          // @ts-ignore
          const sub = client.from(`${tableName}`).on('*', () => {
            load();
          }).subscribe();

          return () => {
            // @ts-ignore
            sub.unsubscribe?.();
          };
        } catch (_) {
          // ignore
        }
      }
    }

    return () => {
      cancelled = true;
      try {
        const client = createSupabaseClient();
        (client as any)?.removeAllSubscriptions?.();
      } catch (_) {
        // ignore
      }
    };
  }, [tableName]);

  if (error) return <div className="p-2 text-sm text-red-600">{error}</div>;
  if (!items.length) return <div className="p-2 text-sm text-gray-600">No restaurants found.</div>;

  return (
    <ol className="space-y-2">
      {items.map((r, idx) => (
        <li key={`${r.id ?? idx}` } className="flex items-center justify-between bg-white p-2 rounded">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-700">{idx + 1}.</div>
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{r.area ?? r.city ?? ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">{r.rating ?? '—'}</div>
            <button
              onClick={() => onSelect?.(r.id)}
              className="text-xs bg-slate-900 text-white px-2 py-1 rounded"
            >
              View
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
