import React from 'react';
import SupabaseStatus from '../components/SupabaseStatus';

export default function Page() {
  const table = process.env.NEXT_PUBLIC_SUPABASE_TEST_TABLE ?? 'test_table';

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Soboite — Supabase connection test</h1>
      <p className="mb-6 text-sm text-gray-600">This page attempts to query a table and display results.</p>
      <SupabaseStatus tableName={table} />
    </div>
  );
}
