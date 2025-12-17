"use client";

import React, { useEffect, useState } from 'react';
import { createSupabaseClient } from '../lib/supabaseClient';

type Props = {
  tableName?: string;
};

export default function SupabaseStatus({ tableName = 'employee' }: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [selectedDish, setSelectedDish] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const supabase = createSupabaseClient();
      if (!supabase) {
        setError('Supabase env variables not found. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set and restart the dev server.');
        setRows(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(5);
        if (!mounted) return;
        if (error) {
          setError(error.message);
          setRows(null);
        } else {
          setRows(data ?? []);
        }
      } catch (err: any) {
        setError(String(err));
        setRows(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [tableName]);

  if (loading) return <div className="p-4">Connecting to Supabase...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-4">
      <div className="mb-4 font-medium">Connected to Supabase — table: {tableName}</div>
      <div className="text-sm text-gray-700 mb-4">Rows returned: {rows?.length ?? 0}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows?.map((row, index) => (
          <div
            key={row.id || index}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedDish(row)}
          >
            <h3 className="text-lg font-semibold">{row.name || `Dish ${index + 1}`}</h3>
            <p className="text-sm text-gray-600"><strong>Flavor:</strong> {row.flavor_profile || 'N/A'}</p>
            <p className="text-sm text-gray-600"><strong>Texture:</strong> {row.texture || 'N/A'}</p>
            <p className="text-sm text-gray-600"><strong>Intensity:</strong> {row.intensity || 'N/A'}</p>
            <p className="text-sm text-gray-600"><strong>Price:</strong> {row.price_range || 'N/A'}</p>
            <p className="text-sm text-gray-600"><strong>Value:</strong> {row.value_for_money || 'N/A'}</p>
          </div>
        ))}
      </div>
      {selectedDish && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Dish Details</h2>
            <div className="space-y-2">
              {Object.entries(selectedDish).map(([key, value]) => (
                <div key={key}>
                  <strong className="capitalize">{key.replace(/_/g, ' ')}:</strong> {String(value)}
                </div>
              ))}
            </div>
            <button
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => setSelectedDish(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
