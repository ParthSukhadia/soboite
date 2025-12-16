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
      <div className="mb-2 font-medium">Connected to Supabase — table: {tableName}</div>
      <div className="text-sm text-gray-700">Rows returned: {rows?.length ?? 0}</div>
      <pre className="mt-3 bg-gray-100 p-3 rounded text-xs overflow-auto">{JSON.stringify(rows, null, 2)}</pre>
    </div>
  );
}
