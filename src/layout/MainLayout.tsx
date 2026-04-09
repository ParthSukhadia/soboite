import { useRef, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { DatabaseZap, Download, Settings2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface ExportPayload {
  version: number;
  exportedAt: string;
  format: 'table-map';
  tableOrder: string[];
  upsertKeys: Record<string, string>;
  tables: Record<string, any[]>;
}

interface TableConfig {
  name: string;
  upsertKey: string;
}

const TABLES: TableConfig[] = [
  { name: 'restaurant_types', upsertKey: 'name' },
  { name: 'cuisines', upsertKey: 'name' },
  { name: 'flavor_tags', upsertKey: 'name' },
  { name: 'restaurants', upsertKey: 'id' },
  { name: 'dishes', upsertKey: 'id' }
];

const TRANSACTIONAL_TABLES = ['dishes', 'restaurants'];

const IMPORT_ORDER = [
  'restaurant_types',
  'cuisines',
  'flavor_tags',
  'restaurants',
  'dishes'
];

const LEGACY_TABLE_KEY_MAP: Record<string, string> = {
  restaurants: 'restaurants',
  dishes: 'dishes',
  restaurantTypes: 'restaurant_types',
  cuisines: 'cuisines',
  flavorTags: 'flavor_tags'
};

const CHUNK_SIZE = 500;

const downloadJsonFile = (payload: ExportPayload, fileName: string) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const chunkArray = <T,>(input: T[], chunkSize: number) => {
  const result: T[][] = [];
  for (let index = 0; index < input.length; index += chunkSize) {
    result.push(input.slice(index, index + chunkSize));
  }
  return result;
};

const clearTableByIds = async (tableName: string, idColumn: string = 'id') => {
  const { data, error } = await supabase.from(tableName).select(idColumn);
  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? []).map((row: any) => row[idColumn]).filter(Boolean);
  if (ids.length === 0) return;

  for (const idsChunk of chunkArray(ids, CHUNK_SIZE)) {
    const { error: deleteError } = await supabase.from(tableName).delete().in(idColumn, idsChunk);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }
};

function SoboiteIcon() {
  return (
    <span className="soboite-logo" aria-hidden="true">
      <img src="/soboite-icon.svg" alt="" />
    </span>
  );
}

export default function MainLayout() {
  const { fetchData } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const exportAllData = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const tableResults = await Promise.all(
        TABLES.map(async (table) => {
          const response = await supabase.from(table.name).select('*');
          return { table: table.name, response };
        })
      );

      const firstError = tableResults.map((result) => result.response.error).find(Boolean);
      if (firstError) {
        throw new Error(firstError.message);
      }

      const tables: Record<string, any[]> = {};
      tableResults.forEach((result) => {
        tables[result.table] = result.response.data ?? [];
      });

      const upsertKeys = TABLES.reduce<Record<string, string>>((acc, table) => {
        acc[table.name] = table.upsertKey;
        return acc;
      }, {});

      const payload: ExportPayload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        format: 'table-map',
        tableOrder: IMPORT_ORDER,
        upsertKeys,
        tables
      };

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJsonFile(payload, `soboite-export-${stamp}.json`);
      setStatusMessage(`Export complete (${TABLES.length} tables).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearTransactionalData = async () => {
    if (!window.confirm('Clear only transactional data (restaurants and dishes)?')) return;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      for (const tableName of TRANSACTIONAL_TABLES) {
        await clearTableByIds(tableName);
      }
      await fetchData();
      setStatusMessage('Transactional data cleared.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to clear transactional data.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllData = async () => {
    if (!window.confirm('Clear all data in all app tables?')) return;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const clearOrder = [...IMPORT_ORDER].reverse();
      for (const tableName of clearOrder) {
        await clearTableByIds(tableName);
      }
      await fetchData();
      setStatusMessage('All data cleared.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to clear all data.');
    } finally {
      setIsProcessing(false);
    }
  };

  const importDataFromFile = async (file: File | null) => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const tables: Record<string, any[]> = (() => {
        if (parsed && typeof parsed === 'object' && parsed.tables && typeof parsed.tables === 'object') {
          return parsed.tables as Record<string, any[]>;
        }

        const legacyRoot = parsed?.data ?? parsed;
        const mapped: Record<string, any[]> = {};
        Object.entries(LEGACY_TABLE_KEY_MAP).forEach(([legacyKey, tableName]) => {
          const value = legacyRoot?.[legacyKey];
          if (Array.isArray(value)) {
            mapped[tableName] = value;
          }
        });
        return mapped;
      })();

      const upsertKeysFromFile = (parsed && typeof parsed === 'object' && parsed.upsertKeys && typeof parsed.upsertKeys === 'object')
        ? parsed.upsertKeys as Record<string, string>
        : {};

      const importOrderFromFile = (parsed && typeof parsed === 'object' && Array.isArray(parsed.tableOrder))
        ? parsed.tableOrder as string[]
        : IMPORT_ORDER;

      for (const tableName of importOrderFromFile) {
        const rows = Array.isArray(tables[tableName]) ? tables[tableName] : [];
        if (rows.length === 0) continue;

        const upsertKey = upsertKeysFromFile[tableName]
          ?? TABLES.find((table) => table.name === tableName)?.upsertKey
          ?? 'id';

        for (const chunk of chunkArray(rows, CHUNK_SIZE)) {
          const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: upsertKey });
          if (error) {
            throw new Error(`Import failed for ${tableName}: ${error.message}`);
          }
        }
      }

      await fetchData();
      setStatusMessage('Import completed.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setIsProcessing(false);
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <header className="bg-white border-b border-gray-200 shadow-sm z-[3000] px-4 py-3 flex justify-between items-center relative">
        <Link to="/" className="inline-flex items-center gap-2.5 text-gray-800">
          <SoboiteIcon />
          <span className="soboite-wordmark">Soboite</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setShowSettings((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Settings2 size={14} />
            Settings
          </button>

          {showSettings && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl p-3 z-[3100]">
              <input
                ref={importFileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void importDataFromFile(file);
                }}
              />

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void exportAllData()}
                  className="w-full inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download size={14} />
                  Export all data
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => importFileRef.current?.click()}
                  className="w-full inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Upload size={14} />
                  Import data
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void clearTransactionalData()}
                  className="w-full inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <DatabaseZap size={14} />
                  Delete transactional data
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void clearAllData()}
                  className="w-full inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <DatabaseZap size={14} />
                  Clear all data
                </button>
              </div>

              {statusMessage && (
                <p className="mt-2 text-xs text-gray-500">{statusMessage}</p>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 relative overflow-hidden bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
