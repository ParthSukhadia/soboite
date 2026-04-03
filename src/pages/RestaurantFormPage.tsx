import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Loader2, LocateFixed } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';

function MapClickHandler({ onPick }: { onPick: (latlng: L.LatLng) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const normalizeOneWord = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
};

const getPreciseCurrentLocation = () => new Promise<L.LatLng>((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Geolocation is not supported by this browser.'));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve(L.latLng(position.coords.latitude, position.coords.longitude));
    },
    (error) => {
      reject(new Error(error.message));
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
});

export default function RestaurantFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    restaurants,
    restaurantTypes,
    cuisines,
    loading,
    fetchData,
    addRestaurant,
    updateRestaurant,
    ensureRestaurantType,
    ensureCuisine
  } = useStore();

  const isEditMode = Boolean(id && id !== 'new');
  const restaurant = isEditMode ? restaurants.find((entry) => entry.id === id) : undefined;

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [typeSelection, setTypeSelection] = useState('');
  const [customType, setCustomType] = useState('');
  const [cuisineSelection, setCuisineSelection] = useState('');
  const [customCuisine, setCustomCuisine] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [costForTwo, setCostForTwo] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [latLng, setLatLng] = useState<L.LatLng | null>(null);
  const [initialMapCenter, setInitialMapCenter] = useState<L.LatLng>(L.latLng(18.9442, 72.8276));
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = loading || isSaving || isLocating;

  const typeOptions = useMemo(() => {
    const values = [...restaurantTypes, ...restaurants.map((r) => r.type).filter((v): v is string => Boolean(v))];
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [restaurantTypes, restaurants]);

  const cuisineOptions = useMemo(() => {
    const values = [...cuisines, ...restaurants.map((r) => r.cuisine).filter((v): v is string => Boolean(v))];
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [cuisines, restaurants]);

  const locationOptions = useMemo(() => {
    const values = restaurants
      .map((restaurantEntry) => normalizeOneWord(restaurantEntry.locationName ?? ''))
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [restaurants]);

  useEffect(() => {
    if (restaurants.length > 0) return;
    void fetchData();
  }, [fetchData, restaurants.length]);

  useEffect(() => {
    if (!isEditMode) return;
    if (!restaurant) return;

    setName(restaurant.name ?? '');
    setNotes(restaurant.notes ?? '');
    setTypeSelection(restaurant.type ?? '');
    setCustomType('');
    setCuisineSelection(restaurant.cuisine ?? '');
    setCustomCuisine('');
    setLocationName(restaurant.locationName ?? '');
    setAddress(restaurant.address ?? '');
    setCostForTwo(typeof restaurant.costForTwo === 'number' ? String(restaurant.costForTwo) : '');
    setVegOnly(Boolean(restaurant.vegOnly));
    const position = L.latLng(restaurant.lat, restaurant.lng);
    setLatLng(position);
    setInitialMapCenter(position);
  }, [isEditMode, restaurant]);

  const handleUseCurrentLocation = async () => {
    setError(null);
    setIsLocating(true);
    try {
      const precise = await getPreciseCurrentLocation();
      setLatLng(precise);
      setInitialMapCenter(precise);
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'Unable to fetch current location.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;

    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Restaurant name is required.');
      return;
    }

    const resolvedType = (typeSelection === '__custom__' ? customType : typeSelection).trim();
    const resolvedCuisine = (cuisineSelection === '__custom__' ? customCuisine : cuisineSelection).trim();
    const parsedCost = costForTwo.trim() ? Number(costForTwo) : Number.NaN;

    setError(null);
    setIsSaving(true);
    try {
      if (resolvedType) {
        await ensureRestaurantType(resolvedType);
      }
      if (resolvedCuisine) {
        await ensureCuisine(resolvedCuisine);
      }

      const fallbackLocation = latLng ?? await getPreciseCurrentLocation().catch(() => L.latLng(18.9442, 72.8276));

      const payload = {
        name: normalizedName,
        notes: notes.trim() || undefined,
        type: resolvedType || undefined,
        cuisine: resolvedCuisine || undefined,
        locationName: normalizeOneWord(locationName) || undefined,
        address: address.trim() || undefined,
        costForTwo: Number.isFinite(parsedCost) ? parsedCost : undefined,
        vegOnly,
        lat: fallbackLocation.lat,
        lng: fallbackLocation.lng
      };

      if (isEditMode && restaurant) {
        await updateRestaurant(restaurant.id, payload);
        navigate(`/restaurant/${restaurant.id}`);
        return;
      }

      const newId = createId();
      await addRestaurant({
        id: newId,
        ...payload
      });
      navigate(`/restaurant/${newId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save restaurant.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditMode && !restaurant && !loading) {
    return <div className="p-6 text-center text-gray-500">Restaurant not found.</div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-white p-4 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => navigate(isEditMode && restaurant ? `/restaurant/${restaurant.id}` : '/')}
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-black disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Restaurant' : 'Add Restaurant'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Drop or redrop the pin on the map to make location accurate.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isBusy} className="space-y-4 disabled:opacity-70">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="Restaurant name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="Atmosphere, must-try dishes..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={typeSelection}
                  onChange={(event) => setTypeSelection(event.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <option value="">Select type</option>
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value="__custom__">Add new type...</option>
                </select>
                {typeSelection === '__custom__' && (
                  <input
                    value={customType}
                    onChange={(event) => setCustomType(event.target.value)}
                    className="mt-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                    placeholder="Enter new type"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuisine</label>
                <select
                  value={cuisineSelection}
                  onChange={(event) => setCuisineSelection(event.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <option value="">Select cuisine</option>
                  {cuisineOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value="__custom__">Add new cuisine...</option>
                </select>
                {cuisineSelection === '__custom__' && (
                  <input
                    value={customCuisine}
                    onChange={(event) => setCustomCuisine(event.target.value)}
                    className="mt-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                    placeholder="Enter new cuisine"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                <input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  list="existing-location-options"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  placeholder="Fort"
                />
                <datalist id="existing-location-options">
                  {locationOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-gray-500">One word area name, used for filtering.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  placeholder="Street and landmark"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost for two (₹)</label>
                <input
                  value={costForTwo}
                  onChange={(event) => setCostForTwo(event.target.value)}
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  placeholder="600"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 mt-7">
                <input
                  type="checkbox"
                  checked={vegOnly}
                  onChange={(event) => setVegOnly(event.target.checked)}
                />
                Veg only restaurant
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Pin Location</label>
                <button
                  type="button"
                  onClick={() => void handleUseCurrentLocation()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LocateFixed size={14} />
                  {isLocating ? 'Locating...' : 'Use exact current location'}
                </button>
              </div>
              <div className="h-72 overflow-hidden rounded-2xl border border-gray-200">
                <MapContainer
                  center={[initialMapCenter.lat, initialMapCenter.lng]}
                  zoom={15}
                  className="h-full w-full"
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <MapClickHandler onPick={setLatLng} />
                  {latLng && <Marker position={[latLng.lat, latLng.lng]} />}
                </MapContainer>
              </div>
              <p className="text-xs text-gray-500">
                Tap on the map to drop/redrop your pin. {latLng ? `Current pin: ${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}` : 'No pin selected yet.'}
              </p>
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            {isSaving ? 'Saving...' : (isEditMode ? 'Save Restaurant Changes' : 'Save Restaurant')}
          </button>
        </form>
      </div>
    </div>
  );
}
