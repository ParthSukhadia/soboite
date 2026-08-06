import { useRef, useState, FormEvent, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { DatabaseZap, Download, Settings2, Upload, LogIn, LogOut, Lock, X, Menu, Eye, EyeOff, Loader2, RotateCw, Share2, Bell, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { processInstagramImage } from '../lib/instagramProcessing';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { AIChatModal } from '../components/AIChatModal';
import { AppEvent } from '../types';

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
  await api.clearTable(tableName, idColumn);
};

function SoboiteIcon() {
  return (
    <span className="soboite-logo" aria-hidden="true">
      <img src="/soboite-icon.svg" alt="" />
    </span>
  );
}

export default function MainLayout() {
  const {
    fetchData,
    editMode,
    setEditMode,
    networkBusy,
    isDarkMode,
    setDarkMode,
    userFirstName,
    hydrated,
    registerDeviceUser,
    restaurants,
    dishes,
    updateRestaurant,
    updateDish,
    wishlist
  } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileAdmin, setShowMobileAdmin] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Registration state
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const { addToast } = useToast();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; isDestructive: boolean; action: (() => Promise<void> | void) | null }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    action: null
  });

  const importFileRef = useRef<HTMLInputElement | null>(null);
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const fetchEvents = async () => {
    try {
      const data = await api.getEvents();
      if (data && Array.isArray(data)) {
        setEvents(data);
      }
    } catch (e) {
      console.error('Failed to fetch events', e);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 3600000);
    return () => clearInterval(interval);
  }, []);

  const mergedEvents = useMemo(() => {
    const missingEvents: AppEvent[] = [];
    if (editMode) {
      restaurants.forEach(r => {
        const hasCuisine = !!r.cuisine;
        const hasLocation = !!r.locationName;
        const rDishes = dishes.filter(d => d.restaurantId === r.id);
        const hasDishes = rDishes.length > 0;
        
        if (!hasCuisine || !hasLocation || !hasDishes) {
          const missingFields = [];
          if (!hasCuisine) missingFields.push('Cuisine');
          if (!hasLocation) missingFields.push('Location');
          if (!hasDishes) missingFields.push('Dishes');
          
          missingEvents.push({
            id: `missing-${r.id}`,
            type: 'warning',
            message: `⚠️ Missing info for ${r.name}: ${missingFields.join(', ')}`,
            created_at: new Date().toISOString(),
            link_url: `/restaurant/${r.id}`
          });
        }
      });
    }
    return [...missingEvents, ...events];
  }, [events, restaurants, dishes, editMode]);

  useEffect(() => {
    const lastSeenId = localStorage.getItem('last_seen_event_id');
    if (!lastSeenId && mergedEvents.length > 0) {
      setUnreadCount(mergedEvents.length);
    } else if (lastSeenId) {
      const index = mergedEvents.findIndex(e => e.id === lastSeenId);
      if (index > 0) setUnreadCount(index);
      else if (index === -1 && mergedEvents.length > 0) setUnreadCount(mergedEvents.length); // If last seen event is gone (e.g. fixed missing info), reset unread count
      else setUnreadCount(0);
    } else {
      setUnreadCount(0);
    }
  }, [mergedEvents]);

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && mergedEvents.length > 0) {
      setUnreadCount(0);
      localStorage.setItem('last_seen_event_id', mergedEvents[0].id);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setStatusMessage(null);
    try {
      await fetchData(true); // force = true
      setStatusMessage('Data refreshed successfully.');
      setTimeout(() => {
        setStatusMessage((curr) => curr === 'Data refreshed successfully.' ? null : curr);
      }, 3000);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Refresh failed.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const executePublishAll = async () => {
    setIsProcessing(true);
    setStatusMessage('Publishing to Instagram...');
    try {
      const unpublishedRestaurants = Object.values(restaurants).filter(r => !r.instaPublished);
      if (unpublishedRestaurants.length === 0) {
        addToast('Everything is already published!', 'info');
        setStatusMessage(null);
        setIsProcessing(false);
        return;
      }

      let count = 0;
      for (const r of unpublishedRestaurants) {
        setStatusMessage(`Publishing ${r.name} (${count + 1}/${unpublishedRestaurants.length})...`);
        const rDishes = Object.values(dishes).filter(d => d.restaurantId === r.id);
        
        const payload = { restaurantImage: '', dishImages: {} as Record<string, string> };
        try {
          payload.restaurantImage = await processInstagramImage(r, 'restaurant');
        } catch (e) {
          console.warn('Failed to process image for', r.name, e);
        }

        for (const d of rDishes) {
          try {
            payload.dishImages[d.id] = await processInstagramImage(d, 'dish', r.cuisine);
          } catch (e) {
            console.warn('Failed to process image for dish', d.name, e);
          }
        }

        // Upload and publish
        const uploadedRestaurantUrl = payload.restaurantImage ? await api.uploadImage(payload.restaurantImage) : '';
        const uploadedDishUrls: Record<string, string> = {};
        for (const [dishId, dataUrl] of Object.entries(payload.dishImages)) {
          uploadedDishUrls[dishId] = await api.uploadImage(dataUrl);
        }

        const structuredPayload = {
          restaurantImageUrl: uploadedRestaurantUrl,
          dishImageUrls: uploadedDishUrls
        };

        const res = await api.publishToInstagram(r.id, structuredPayload);
        if (res.success) {
          updateRestaurant(r.id, { instaPublished: true, instaPublishedAt: new Date().toISOString(), instaEditedPhotoUrl: uploadedRestaurantUrl });
          for (const dishId of Object.keys(uploadedDishUrls)) {
            updateDish(dishId, { instaPublished: true, instaPublishedAt: new Date().toISOString(), instaEditedPhotoUrl: uploadedDishUrls[dishId] });
          }
          count++;
        } else {
          console.error(`Failed to publish ${r.name}`);
        }
      }
      addToast(`Published ${count} restaurants to Instagram!`, 'success');
      setStatusMessage(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to publish all to Instagram.', 'error');
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackfillInsights = async () => {
    setIsProcessing(true);
    setStatusMessage('Backfilling dish insights...');
    setShowSettings(false);
    try {
      const dishesToProcess = Object.values(dishes).filter(d => !d.pros || d.pros.length === 0);
      if (dishesToProcess.length === 0) {
        addToast('All dishes already have pros and cons!', 'info');
        setStatusMessage(null);
        setIsProcessing(false);
        return;
      }

      let count = 0;
      for (const d of dishesToProcess) {
        setStatusMessage(`Processing dish ${count + 1} of ${dishesToProcess.length}: ${d.name}...`);
        try {
           const dishData = {
              id: d.id,
              name: d.name,
              rating: d.rating,
              cuisine: d.cuisine || '',
              review: d.review || '',
              restaurantId: d.restaurantId
           };
           await api.analyzeDishes([dishData]);
           // Small delay to prevent hitting Gemini rate limits
           await new Promise(resolve => setTimeout(resolve, 1000));
           count++;
        } catch (e) {
           console.error("Failed to analyze dish", d.name, e);
        }
      }
      
      await fetchData(true);
      addToast(`Successfully generated insights for ${count} dishes!`, 'success');
      setStatusMessage(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to backfill insights.', 'error');
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePublishAllInstagram = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Publish All to Instagram',
      message: 'Publish all unpublished restaurants and dishes to Instagram? This may take a while.',
      isDestructive: false,
      action: executePublishAll
    });
  };

  // Realtime updates have been removed as part of API migration.

  const exportAllData = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const tables = await api.exportAll();

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

  const executeClearTransactionalData = async () => {
    setIsProcessing(true);
    setStatusMessage('Clearing transactional data...');
    try {
      for (const tableName of TRANSACTIONAL_TABLES) {
        await clearTableByIds(tableName);
      }
      await fetchData();
      addToast('Transactional data cleared.', 'success');
      setStatusMessage(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to clear transactional data.', 'error');
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearTransactionalData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Transactional Data',
      message: 'Are you sure you want to clear only transactional data (restaurants and dishes)? This cannot be undone.',
      isDestructive: true,
      action: executeClearTransactionalData
    });
  };

  const executeClearAllData = async () => {
    setIsProcessing(true);
    setStatusMessage('Clearing all data...');
    try {
      const clearOrder = [...IMPORT_ORDER].reverse();
      for (const tableName of clearOrder) {
        await clearTableByIds(tableName);
      }
      await fetchData();
      addToast('All data cleared.', 'success');
      setStatusMessage(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to clear all data.', 'error');
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear All Data',
      message: 'Are you sure you want to clear all data in all app tables? This cannot be undone.',
      isDestructive: true,
      action: executeClearAllData
    });
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
          await api.importTable(tableName, chunk, upsertKey);
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

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.loginAdmin(loginPassword.trim());
      if (res && res.success) {
        setEditMode(true);
        setShowLoginModal(false);
        setLoginPassword('');
        setLoginError(false);
      } else {
        setLoginError(true);
      }
    } catch (e) {
      setLoginError(true);
      console.error(e);
    }
  };

  const handleRegistrationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!regFirstName.trim()) return;
    setRegLoading(true);
    await registerDeviceUser(regFirstName.trim(), regLastName.trim());
    setRegLoading(false);
  };

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <header className="bg-white border-b border-gray-200 shadow-sm z-[3000] px-4 py-3 flex justify-between items-center relative">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/" className="inline-flex items-center gap-2.5 text-gray-800">
            <SoboiteIcon />
            <span className="soboite-wordmark">Soboite</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2">
            <Link
              to="/recommended"
              className={`rounded-full px-3 py-2 text-sm font-semibold ${currentPath === '/recommended' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              Recommended
            </Link>
            <Link
              to="/top-picks"
              className={`rounded-full px-3 py-2 text-sm font-semibold ${currentPath === '/top-picks' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              Top picks
            </Link>
            <Link
              to="/wishlist"
              className={`rounded-full px-3 py-2 text-sm font-semibold relative flex items-center gap-1.5 ${currentPath === '/wishlist' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              Wishlist
              {wishlist.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full shadow-sm" />}
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <div className="relative">
              <button
                type="button"
                onClick={handleBellClick}
                className="inline-flex items-center justify-center rounded-xl bg-transparent p-2 text-gray-700 hover:bg-gray-100 relative"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileMenu(true)}
              className="inline-flex items-center justify-center rounded-xl bg-transparent p-2 text-gray-700 hover:bg-gray-100 relative"
              aria-label="Open menu"
            >
              <Menu size={24} />
              {wishlist.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userFirstName && (
            <span className="hidden sm:inline font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500 mr-2 tracking-tight">
              👋 HELLO HELLO HELLO, {userFirstName.toUpperCase()}!
            </span>
          )}

          <div className="hidden sm:block relative">
            <button
              type="button"
              onClick={handleBellClick}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:scale-95 transition relative"
            >
              <Bell size={16} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>


          </div>
          <button
            type="button"
            disabled={isRefreshing || networkBusy || isProcessing}
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition"
            title="Fetch latest details from server"
          >
            <RotateCw size={14} className={`${isRefreshing ? 'animate-spin text-red-500' : 'text-gray-500 hover:text-gray-700'}`} />
            <span className="hidden sm:inline font-medium">Refresh</span>
          </button>

          <div className="hidden sm:flex items-center gap-3">
            {editMode ? (
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setShowSettings(false);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut size={14} />
                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogIn size={14} />
                Login
              </button>
            )}

            {editMode && (
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
                        onClick={() => { setShowSettings(false); void handlePublishAllInstagram(); }}
                        className="w-full inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                      >
                        <Share2 size={14} />
                        Publish All to Instagram
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void handleBackfillInsights()}
                        className="w-full inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700 hover:bg-purple-100 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                      >
                        <Sparkles size={14} />
                        Generate All Missing Pros & Cons
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
            )}
          </div>
        </div>

        {showNotifications && (
          <div className="absolute top-[calc(100%+0.25rem)] left-4 right-4 sm:left-auto sm:right-4 sm:w-80 rounded-2xl border border-gray-200 bg-white shadow-xl py-2 z-[3100] max-h-96 overflow-y-auto">
            <div className="px-4 py-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Notifications</h3>
            </div>
            {mergedEvents.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No recent events.
              </div>
            ) : (
              <div className="flex flex-col">
                {mergedEvents.map((evt) => (
                  <Link
                    key={evt.id}
                    to={evt.link_url || '#'}
                    onClick={() => setShowNotifications(false)}
                    className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${evt.id.startsWith('missing-') ? 'bg-amber-50/30' : ''}`}
                  >
                    <p className="text-sm font-medium text-gray-800 mb-1">{evt.message}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(evt.created_at).toLocaleDateString()} {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {showMobileMenu && (
        <div className="fixed inset-0 z-[4000] flex bg-black/40 backdrop-blur-sm">
          <aside className="ml-auto w-full max-w-xs bg-white shadow-2xl border-l border-gray-200 p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                {userFirstName && (
                  <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500 mt-1 tracking-tight">
                    👋 HELLO HELLO HELLO, {userFirstName.toUpperCase()}!
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="space-y-3">
              <Link
                to="/"
                onClick={() => setShowMobileMenu(false)}
                className={`block rounded-2xl px-4 py-3 text-sm font-semibold ${currentPath === '/' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Home
              </Link>
              <Link
                to="/recommended"
                onClick={() => setShowMobileMenu(false)}
                className={`block rounded-2xl px-4 py-3 text-sm font-semibold ${currentPath === '/recommended' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Recommended
              </Link>
              <Link
                to="/top-picks"
                onClick={() => setShowMobileMenu(false)}
                className={`block rounded-2xl px-4 py-3 text-sm font-semibold ${currentPath === '/top-picks' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Top picks
              </Link>
              <Link
                to="/wishlist"
                onClick={() => setShowMobileMenu(false)}
                className={`block rounded-2xl px-4 py-3 text-sm font-semibold relative flex items-center justify-between ${currentPath === '/wishlist' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Wishlist
                {wishlist.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full shadow-sm" />}
              </Link>
            </nav>

            <div className="mt-6 space-y-3">
              {editMode ? (
                <button
                  type="button"
                  onClick={() => setShowMobileAdmin((prev) => !prev)}
                  className="w-full inline-flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <span className="inline-flex items-center gap-2"><Settings2 size={16} /> Admin Settings</span>
                  <span className="text-gray-400">{showMobileAdmin ? '▲' : '▼'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(true);
                    setShowMobileMenu(false);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <LogIn size={16} />
                  Login
                </button>
              )}

              {editMode && showMobileAdmin && (
                <div className="pt-2 pb-4 space-y-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void exportAllData()}
                    className="w-full inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download size={14} /> Export all data
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => importFileRef.current?.click()}
                    className="w-full inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Upload size={14} /> Import data
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => { clearTransactionalData(); setShowMobileMenu(false); }}
                    className="w-full inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100"
                  >
                    <DatabaseZap size={14} /> Delete transactional data
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => { clearAllData(); setShowMobileMenu(false); }}
                    className="w-full inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                  >
                    <DatabaseZap size={14} /> Clear all data
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => { setShowMobileMenu(false); void handlePublishAllInstagram(); }}
                    className="w-full inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
                  >
                    <Share2 size={14} /> Publish All to Instagram
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => { setShowMobileMenu(false); void handleBackfillInsights(); }}
                    className="w-full inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700 hover:bg-purple-100 mt-2"
                  >
                    <Sparkles size={14} /> Generate All Missing Pros & Cons
                  </button>
                </div>
              )}

              <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 2000);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  <Upload size={16} />
                  {urlCopied ? 'Copied!' : 'Copy App URL'}
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode(!isDarkMode)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Settings2 size={16} />
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>

              {editMode && (
                <div className="pt-4 mt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      setShowSettings(false);
                      setShowMobileMenu(false);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}

              <div className="pt-6 pb-2 text-center text-xs text-gray-400">
                <p>Version 1.0.1</p>
                <p>Made By Rishabh Masani</p>
              </div>
            </div>
          </aside>
          <button
            type="button"
            className="flex-1"
            onClick={() => setShowMobileMenu(false)}
            aria-label="Close mobile menu overlay"
          />
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 auto py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Lock size={20} className="text-red-500" />
                  Admin Login
                </h2>
                <p className="text-xs text-gray-500 mt-1 ml-7">Only for administrators</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword('');
                  setLoginError(false);
                }}
                className="text-gray-400 hover:text-black p-1 rounded-full hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleLoginSubmit} className="p-6">
              {/* Hidden username to help password managers */}
              <input type="text" name="username" autoComplete="username" value="admin" className="hidden" readOnly />
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus
                    required
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginError(false);
                    }}
                    className={`w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border ${loginError ? 'border-red-300 focus:ring-red-500 text-red-900 bg-red-50' : 'border-gray-200 focus:ring-black'} focus:outline-none focus:ring-2 transition shadow-inner`}
                    placeholder="Enter profile password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginError && <p className="text-red-500 text-xs mt-2 font-medium">Incorrect password. Please try again.</p>}
              </div>
              <button
                type="submit"
                className="w-full bg-black text-white font-medium py-3 rounded-xl hover:bg-gray-800 transition active:scale-95 flex items-center justify-center gap-2"
              >
                Login to edit
              </button>
            </form>
          </div>
        </div>
      )}

      {hydrated && !userFirstName && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold">Welcome!</h2>
              <p className="text-sm text-gray-500 mt-1">We need just your name to get started.</p>
            </div>
            <form onSubmit={handleRegistrationSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  name="given-name"
                  autoComplete="given-name"
                  autoFocus
                  required
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black transition shadow-inner"
                  placeholder="e.g. John"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name (Optional)</label>
                <input
                  type="text"
                  name="family-name"
                  autoComplete="family-name"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black transition shadow-inner"
                  placeholder="e.g. Doe"
                />
              </div>
              <button
                type="submit"
                disabled={!regFirstName.trim() || regLoading}
                className="w-full bg-black text-white font-medium py-3 rounded-xl hover:bg-gray-800 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {regLoading ? <Loader2 size={18} className="animate-spin" /> : 'Continue'}
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 relative overflow-hidden bg-gray-50">
        <Outlet />
      </main>

      {networkBusy && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
            <Loader2 size={24} className="animate-spin text-red-500" />
            <span className="text-gray-800 font-semibold tracking-wide">Processing...</span>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={() => {
          if (confirmModal.action) void confirmModal.action();
        }}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Global AI Chat FAB */}
      {editMode && currentPath === '/' && (
        <button
          onClick={() => setShowChatModal(true)}
          className="fixed bottom-[110px] right-6 sm:bottom-[90px] sm:right-6 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl active:scale-95 transition-transform flex items-center justify-center z-[1000]"
          aria-label="Open AI Chat"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* AI Chat Modal */}
      {showChatModal && editMode && currentPath === '/' && (
        <AIChatModal onClose={() => setShowChatModal(false)} />
      )}
    </div>
  );
}
