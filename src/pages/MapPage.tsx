import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Star, Utensils, SlidersHorizontal, RotateCcw } from 'lucide-react';
import L from 'leaflet';
import { Restaurant } from '../types';
import TagSelector from '../components/TagSelector';

function LocationMarker({ onLocation }: { onLocation?: (pos: L.LatLng) => void }) {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
      return;
    }

    let hasCentered = false;
    const handleSuccess = (geo: GeolocationPosition) => {
      const next = L.latLng(geo.coords.latitude, geo.coords.longitude);
      setPosition(next);
      onLocation?.(next);
      if (!hasCentered) {
        map.setView(next, 14, { animate: false });
        hasCentered = true;
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Location error:', error.message);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    });

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [map, onLocation]);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const webkitHeading = (event as any).webkitCompassHeading;
      if (typeof webkitHeading === 'number') {
        setHeading(webkitHeading);
        return;
      }
      if (event.alpha !== null) {
        const normalized = (360 - event.alpha) % 360;
        setHeading(normalized);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, []);

  const icon = useMemo(() => {
    const className = heading === null ? 'location-marker location-marker--no-heading' : 'location-marker';
    return L.divIcon({
      className,
      html: `<div class="location-marker__dot"><div class="location-marker__arrow" style="--heading:${heading ?? 0}deg"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }, [heading]);

  return position === null ? null : (
    <>
      <Marker position={position} icon={icon} zIndexOffset={2000}>
        <Popup>You are here</Popup>
      </Marker>
      {/* Pulsing effect ring */}
      <CircleMarker center={position} radius={25} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 0 }} />
    </>
  );
}

function MapClickHandler({ onClick }: { onClick: (e: any) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

function SelectedRestaurantFlyTo({ restaurant }: { restaurant?: Restaurant | null }) {
  const map = useMap();

  useEffect(() => {
    if (!restaurant) return;
    map.setView([restaurant.lat, restaurant.lng], Math.max(map.getZoom(), 16), { animate: false });
  }, [map, restaurant]);

  return null;
}

export default function MapPage() {
  const {
    restaurants,
    dishes,
    restaurantTypes,
    cuisines,
    flavorTags,
    editMode,
    addRestaurant,
    addDish,
    fetchData,
    ensureRestaurantType,
    ensureCuisine,
    ensureFlavorTag
  } = useStore();
  const [selectedRest, setSelectedRest] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [latLng, setLatLng] = useState<{lat: number, lng: number} | null>(null);
  const [currentPosition, setCurrentPosition] = useState<L.LatLng | null>(null);
  const [addStep, setAddStep] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterCuisines, setFilterCuisines] = useState<string[]>([]);
  const [costRange, setCostRange] = useState({ min: '', max: '' });
  const [restaurantPhoto, setRestaurantPhoto] = useState('');
  const [restaurantTypeSelection, setRestaurantTypeSelection] = useState('');
  const [restaurantCuisineSelection, setRestaurantCuisineSelection] = useState('');
  const [customRestaurantType, setCustomRestaurantType] = useState('');
  const [customRestaurantCuisine, setCustomRestaurantCuisine] = useState('');
  const [restaurantPhotoPosition, setRestaurantPhotoPosition] = useState({ x: 50, y: 50 });
  const [isDraggingRestaurantPhoto, setIsDraggingRestaurantPhoto] = useState(false);
  const [showDishBuilder, setShowDishBuilder] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [dishPhotos, setDishPhotos] = useState<Array<{
    id: string;
    imageUrl: string;
    name: string;
    rating: number;
    priceLevel: number;
    review: string;
    cuisine: string;
    flavorTags: string[];
    isCustomCuisine: boolean;
  }>>([]);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollTimeoutRef = useRef<number | null>(null);
  const restaurantPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const dishPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const restaurantPhotoPreviewRef = useRef<HTMLDivElement | null>(null);
  const restaurantPhotoDragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ratingsByRestaurant = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    dishes.forEach((dish) => {
      const current = totals.get(dish.restaurantId) ?? { sum: 0, count: 0 };
      totals.set(dish.restaurantId, { sum: current.sum + dish.rating, count: current.count + 1 });
    });

    const result = new Map<string, number>();
    totals.forEach((value, key) => {
      const avg = value.count > 0 ? value.sum / value.count : 0;
      result.set(key, Math.round(avg * 10) / 10);
    });
    return result;
  }, [dishes]);

  const typeOptions = useMemo(() => {
    const values = [...restaurantTypes, ...restaurants.map((r) => r.type).filter((v): v is string => Boolean(v))];
    return Array.from(new Set(values)).sort();
  }, [restaurants, restaurantTypes]);

  const cuisineOptions = useMemo(() => {
    const values = [
      ...cuisines,
      ...restaurants.map((r) => r.cuisine).filter((v): v is string => Boolean(v)),
      ...dishes.map((d) => d.cuisine).filter((v): v is string => Boolean(v))
    ];
    return Array.from(new Set(values)).sort();
  }, [restaurants, dishes, cuisines]);

  const costOptions = useMemo(() => {
    const values = restaurants
      .map((r) => r.costForTwo)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    return Array.from(new Set(values)).sort((a, b) => a - b);
  }, [restaurants]);

  const matchesFilters = (restaurant: Restaurant) => {
    const matchesType = filterTypes.length === 0 || (restaurant.type ? filterTypes.includes(restaurant.type) : false);
    const matchesCuisine = filterCuisines.length === 0 || (restaurant.cuisine ? filterCuisines.includes(restaurant.cuisine) : false);

    const minCost = costRange.min ? Number(costRange.min) : null;
    const maxCost = costRange.max ? Number(costRange.max) : null;
    const hasCostFilter = minCost !== null || maxCost !== null;
    const costValue = restaurant.costForTwo ?? null;
    const matchesCost = !hasCostFilter
      || (costValue !== null
        && (minCost === null || costValue >= minCost)
        && (maxCost === null || costValue <= maxCost));

    return matchesType && matchesCuisine && matchesCost;
  };

  const toggleTypeFilter = (value: string) => {
    setFilterTypes((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const toggleCuisineFilter = (value: string) => {
    setFilterCuisines((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const clearFilters = () => {
    setFilterTypes([]);
    setFilterCuisines([]);
    setCostRange({ min: '', max: '' });
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const openAddForm = () => {
    setShowAddForm(true);
    setAddStep(1);
    setAddFormError(null);
    setRestaurantPhoto('');
    setRestaurantTypeSelection('');
    setRestaurantCuisineSelection('');
    setCustomRestaurantType('');
    setCustomRestaurantCuisine('');
    setRestaurantPhotoPosition({ x: 50, y: 50 });
    setDishPhotos([]);
    setShowDishBuilder(false);
    setLatLng(null);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setAddFormError(null);
    setLatLng(null);
  };

  const handleFormFocusCapture = (event: React.FocusEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
  };

  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

  const handleRestaurantPhotoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!restaurantPhoto) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDraggingRestaurantPhoto(true);
    restaurantPhotoDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: restaurantPhotoPosition.x,
      y: restaurantPhotoPosition.y
    };
  };

  const handleRestaurantPhotoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!restaurantPhotoDragRef.current || !restaurantPhotoPreviewRef.current) return;
    const previewWidth = restaurantPhotoPreviewRef.current.clientWidth || 1;
    const previewHeight = restaurantPhotoPreviewRef.current.clientHeight || 1;
    const deltaX = event.clientX - restaurantPhotoDragRef.current.startX;
    const deltaY = event.clientY - restaurantPhotoDragRef.current.startY;

    setRestaurantPhotoPosition({
      x: clampPercent(restaurantPhotoDragRef.current.x - (deltaX / previewWidth) * 100),
      y: clampPercent(restaurantPhotoDragRef.current.y - (deltaY / previewHeight) * 100)
    });
  };

  const handleRestaurantPhotoPointerUp = () => {
    restaurantPhotoDragRef.current = null;
    setIsDraggingRestaurantPhoto(false);
  };

  const buildPositionedRestaurantPhoto = async () => {
    if (!restaurantPhoto) return undefined;

    const image = new Image();
    image.src = restaurantPhoto;
    await image.decode();

    const targetWidth = 1200;
    const targetHeight = 675;
    const targetRatio = targetWidth / targetHeight;
    const imageRatio = image.naturalWidth / image.naturalHeight;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (imageRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) * (restaurantPhotoPosition.x / 100);
    } else {
      sourceHeight = image.naturalWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceHeight) * (restaurantPhotoPosition.y / 100);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return restaurantPhoto;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleRestaurantPhotoUpload = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setRestaurantPhoto(dataUrl);
    setRestaurantPhotoPosition({ x: 50, y: 50 });
    setAddFormError(null);
  };

  const handleDishPhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const urls = await Promise.all(Array.from(files).map(fileToDataUrl));
    setDishPhotos((prev) => [
      ...prev,
      ...urls.map((url) => ({
        id: createId(),
        imageUrl: url,
        name: '',
        rating: 5,
        priceLevel: 2,
        review: '',
        cuisine: '',
        flavorTags: [],
        isCustomCuisine: false
      }))
    ]);
  };

  const addEmptyDishCard = () => {
    setDishPhotos((prev) => [
      ...prev,
      {
        id: createId(),
        imageUrl: '',
        name: '',
        rating: 5,
        priceLevel: 2,
        review: '',
        cuisine: '',
        flavorTags: [],
        isCustomCuisine: false
      }
    ]);
  };

  const updateDishCard = (id: string, updates: Partial<typeof dishPhotos[number]>) => {
    setDishPhotos((prev) => prev.map((dish) => dish.id === id ? { ...dish, ...updates } : dish));
  };

  const removeDishCard = (id: string) => {
    setDishPhotos((prev) => prev.filter((dish) => dish.id !== id));
  };

  const getRatingColor = (rating?: number) => {
    if (rating === undefined) return '#9ca3af';
    if (rating >= 4.5) return '#16a34a';
    if (rating >= 3.5) return '#22c55e';
    if (rating >= 2.5) return '#f59e0b';
    return '#ef4444';
  };

  const truncateName = (name: string) => {
    if (name.length <= 18) return name;
    return `${name.slice(0, 18)}...`;
  };

  const activeRest = restaurants.find(r => r.id === selectedRest);
  const filteredRestaurants = useMemo(
    () => restaurants.filter(matchesFilters),
    [restaurants, filterTypes, filterCuisines, costRange]
  );
  const displayRestaurants = useMemo(() => {
    if (!selectedRest) return filteredRestaurants;
    if (filteredRestaurants.some((rest) => rest.id === selectedRest)) {
      return filteredRestaurants;
    }
    const selected = restaurants.find((rest) => rest.id === selectedRest);
    return selected ? [selected, ...filteredRestaurants] : filteredRestaurants;
  }, [filteredRestaurants, restaurants, selectedRest]);

  const setCardRef = (id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      cardRefs.current.set(id, node);
    } else {
      cardRefs.current.delete(id);
    }
  };

  const handleMapClick = (e: any) => {
    if (editMode && showAddForm) {
      setLatLng(e.latlng);
    } else if (!showAddForm) {
      setSelectedRest(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = data.get('name') as string;
    const notes = data.get('notes') as string;
    const selectedType = restaurantTypeSelection === '__custom__' ? customRestaurantType : restaurantTypeSelection;
    const selectedCuisine = restaurantCuisineSelection === '__custom__' ? customRestaurantCuisine : restaurantCuisineSelection;
    const type = selectedType.trim();
    const cuisine = selectedCuisine.trim();
    const costForTwoInput = data.get('costForTwo') as string;
    const costForTwo = costForTwoInput ? Number(costForTwoInput) : undefined;

    if (!name) {
      setAddFormError('Please enter a restaurant name.');
      return;
    }

    try {
      setAddFormError(null);
      const restaurantId = createId();
      const resolvedLatLng = latLng
        ?? (currentPosition ? { lat: currentPosition.lat, lng: currentPosition.lng } : { lat: 18.9442, lng: 72.8276 });
      const positionedRestaurantPhoto = restaurantPhoto ? await buildPositionedRestaurantPhoto() : undefined;

      if (type) {
        await ensureRestaurantType(type);
      }
      if (cuisine) {
        await ensureCuisine(cuisine);
      }

      await addRestaurant({
        id: restaurantId,
        name,
        notes,
        imageUrl: positionedRestaurantPhoto || restaurantPhoto || undefined,
        type: type || undefined,
        cuisine: cuisine || undefined,
        costForTwo: Number.isFinite(costForTwo) ? costForTwo : undefined,
        lat: resolvedLatLng.lat,
        lng: resolvedLatLng.lng
      });

      for (const dish of dishPhotos) {
        if (!dish.name.trim()) continue;
        const tags = dish.flavorTags.filter(Boolean);
        if (dish.cuisine) {
          await ensureCuisine(dish.cuisine);
        }
        if (tags.length > 0) {
          await Promise.all(tags.map((tag) => ensureFlavorTag(tag)));
        }
        await addDish({
          id: createId(),
          restaurantId,
          name: dish.name,
          rating: Math.min(5, Math.max(1, dish.rating)),
          priceLevel: Math.min(4, Math.max(1, dish.priceLevel)) as 1 | 2 | 3 | 4,
          review: dish.review,
          cuisine: dish.cuisine || undefined,
          flavorTags: tags.length > 0 ? tags : undefined,
          imageUrl: dish.imageUrl || undefined
        });
      }

      await fetchData();
      closeAddForm();
      setSelectedRest(restaurantId);
    } catch (error) {
      setAddFormError(error instanceof Error ? error.message : 'Could not save restaurant.');
    }
  };

  useEffect(() => {
    if (selectedRest && !restaurants.find((rest) => rest.id === selectedRest)) {
      setSelectedRest(null);
    }
  }, [selectedRest, restaurants]);

  useEffect(() => {
    if (!selectedRest) return;
    const container = cardContainerRef.current;
    const card = cardRefs.current.get(selectedRest);
    if (!container || !card) return;
    const left = card.offsetLeft - (container.clientWidth - card.clientWidth) / 2;
    container.scrollTo({ left, behavior: 'smooth' });
  }, [selectedRest, displayRestaurants.length]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleCardScroll = () => {
    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const container = cardContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      let closestId: string | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      cardRefs.current.forEach((card, id) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(centerX - cardCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = id;
        }
      });

      if (closestId && closestId !== selectedRest) {
        setSelectedRest(closestId);
      }
    }, 120);
  };

  const buildRestaurantIcon = (restaurant: Restaurant, rating?: number, isDim?: boolean, isSelected?: boolean) => {
    const ratingText = rating === undefined ? '--' : rating.toFixed(1);
    const color = getRatingColor(rating);
    const label = truncateName(restaurant.name);
    const className = [
      'restaurant-marker',
      isDim ? 'restaurant-marker--dim' : '',
      isSelected ? 'restaurant-marker--selected' : ''
    ].filter(Boolean).join(' ');

    return L.divIcon({
      className,
      html: `<div class="restaurant-marker__pin" style="--pin-color:${color}"><span class="restaurant-marker__rating">${ratingText}</span></div><div class="restaurant-marker__label">${label}</div>`,
      iconSize: [140, 44],
      iconAnchor: [16, 34]
    });
  };

  const selectedFilters = [
    ...filterTypes.map((type) => ({
      key: `type:${type}`,
      label: type,
      onRemove: () => toggleTypeFilter(type)
    })),
    ...filterCuisines.map((cuisine) => ({
      key: `cuisine:${cuisine}`,
      label: cuisine,
      onRemove: () => toggleCuisineFilter(cuisine)
    })),
    ...(costRange.min || costRange.max ? [{
      key: 'cost',
      label: `₹${costRange.min || '0'} - ₹${costRange.max || 'max'}`,
      onRemove: () => setCostRange({ min: '', max: '' })
    }] : [])
  ];

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setShowFilters(true)}
          className="bg-white/95 backdrop-blur border border-gray-200 rounded-full shadow-lg p-3 text-gray-700 hover:text-black"
          aria-label="Open filters"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {selectedFilters.length > 0 && (
        <div className="absolute top-16 right-4 z-[1000] max-w-[70vw]">
          <div className="flex flex-wrap gap-2">
            {selectedFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={filter.onRemove}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-black"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1100]"
          >
            <button
              className="absolute inset-0 bg-black/30"
              onClick={() => setShowFilters(false)}
              aria-label="Close filters"
            />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 w-[min(94%,520px)] bg-white rounded-2xl shadow-2xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
                <div className="flex items-center gap-2">
                  <button onClick={clearFilters} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" aria-label="Clear filters">
                    <RotateCcw size={16} />
                  </button>
                  <button onClick={() => setShowFilters(false)} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-2">Type</label>
                    <div className="flex flex-wrap gap-2">
                      {typeOptions.map((type) => {
                        const isActive = filterTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggleTypeFilter(type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${isActive ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-2">Cuisine</label>
                    <div className="flex flex-wrap gap-2">
                      {cuisineOptions.map((cuisine) => {
                        const isActive = filterCuisines.includes(cuisine);
                        return (
                          <button
                            key={cuisine}
                            type="button"
                            onClick={() => toggleCuisineFilter(cuisine)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${isActive ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
                          >
                            {cuisine}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-2">Cost for two (₹)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={costRange.min}
                        onChange={(e) => setCostRange((prev) => ({ ...prev, min: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                        placeholder={costOptions.length > 0 ? `Min ${costOptions[0]}` : 'Min'}
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        min="0"
                        value={costRange.max}
                        onChange={(e) => setCostRange((prev) => ({ ...prev, max: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                        placeholder={costOptions.length > 0 ? `Max ${costOptions[costOptions.length - 1]}` : 'Max'}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2">Selected</label>
                  {selectedFilters.length === 0 ? (
                    <p className="text-xs text-gray-400">No filters applied</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedFilters.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={filter.onRemove}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-black"
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <MapContainer center={[18.9442, 72.8276]} zoom={15} className="h-full w-full" attributionControl={false}>
        <TileLayer 
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <LocationMarker onLocation={setCurrentPosition} />
        <SelectedRestaurantFlyTo restaurant={activeRest} />
        <MapClickHandler onClick={handleMapClick} />
        {restaurants.map(rest => (
          <Marker 
            key={rest.id} 
            position={[rest.lat, rest.lng]}
            icon={buildRestaurantIcon(
              rest,
              ratingsByRestaurant.get(rest.id),
              !matchesFilters(rest),
              rest.id === selectedRest
            )}
            eventHandlers={{ click: () => setSelectedRest(rest.id) }}
          />
        ))}
        {latLng && showAddForm && editMode && (
          <Marker position={[latLng.lat, latLng.lng]} opacity={0.5} />
        )}
      </MapContainer>

      {!showAddForm && displayRestaurants.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[900] h-[30dvh] min-h-[220px]"
          style={{
            bottom: 'env(safe-area-inset-bottom)',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
          }}
        >
          <div className="h-full px-4 pb-4 pt-2">
            <div
              ref={cardContainerRef}
              onScroll={handleCardScroll}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 h-full"
            >
              {displayRestaurants.map((rest) => {
                const rating = ratingsByRestaurant.get(rest.id);
                const isSelected = rest.id === selectedRest;
                return (
                  <div
                    key={rest.id}
                    ref={setCardRef(rest.id)}
                    className={`snap-center min-w-[200px] max-w-[220px] bg-white rounded-2xl shadow-lg border overflow-hidden transition h-full ${isSelected ? 'border-black' : 'border-gray-200'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRest(rest.id)}
                      className="w-full h-full text-left flex flex-col"
                    >
                      <div className="relative h-full">
                        {rest.imageUrl ? (
                          <img src={rest.imageUrl} alt={rest.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute inset-x-3 bottom-2 flex items-end justify-between text-white">
                          <div>
                            <div className="text-sm font-semibold drop-shadow">{rest.name}</div>
                            <div className="flex items-center gap-2 text-[11px] text-white/90">
                              <span className="flex items-center gap-1">
                                <Star size={11} fill="currentColor" />
                                {rating ? rating.toFixed(1) : '--'}
                              </span>
                              <span>{rest.cuisine ?? rest.type ?? 'Restaurant'}</span>
                            </div>
                            <div className="text-[11px] text-white/80">
                              {rest.costForTwo ? `₹${rest.costForTwo} for two` : 'Cost unknown'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/restaurant/${rest.id}`);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 text-gray-900 text-[11px]"
                          >
                            <Utensils size={12} />
                            Details
                          </button>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Add Button */}
      {editMode && !showAddForm && (
        <button 
          onClick={openAddForm}
          className="absolute right-6 z-[1000] bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-xl active:scale-95 transition-transform"
          style={{ bottom: 'calc(28vh + 16px)' }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Add form sheet */}
      <AnimatePresence>
        {showAddForm && editMode && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[1000] p-6 max-w-md mx-auto h-[92dvh] overflow-y-auto overscroll-contain [touch-action:pan-y]"
            style={{
              paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Restaurant</h2>
              <button onClick={closeAddForm} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddSubmit} onFocusCapture={handleFormFocusCapture} className="space-y-4 pb-24">
              <div className={addStep === 1 ? '' : 'hidden'}>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Restaurant Photo</label>
                <input
                  ref={restaurantPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleRestaurantPhotoUpload(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => restaurantPhotoInputRef.current?.click()}
                  className="w-full bg-black text-white font-medium py-2.5 rounded-xl hover:bg-gray-800"
                >
                  Upload photo
                </button>
                {restaurantPhoto && (
                  <div
                    ref={restaurantPhotoPreviewRef}
                    className={`mt-3 rounded-xl overflow-hidden h-44 relative ${isDraggingRestaurantPhoto ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onPointerDown={handleRestaurantPhotoPointerDown}
                    onPointerMove={handleRestaurantPhotoPointerMove}
                    onPointerUp={handleRestaurantPhotoPointerUp}
                    onPointerCancel={handleRestaurantPhotoPointerUp}
                  >
                    <img
                      src={restaurantPhoto}
                      alt="Restaurant preview"
                      className="w-full h-full object-cover pointer-events-none select-none"
                      style={{ objectPosition: `${restaurantPhotoPosition.x}% ${restaurantPhotoPosition.y}%` }}
                      draggable={false}
                    />
                    <div className="absolute left-2 right-2 bottom-2 text-[11px] bg-black/60 text-white px-2 py-1 rounded-md text-center">
                      Drag photo to set framing
                    </div>
                  </div>
                )}
                {!restaurantPhoto && (
                  <p className="mt-2 text-xs text-gray-500">You can skip photo and continue.</p>
                )}
              </div>

              <div className={addStep === 2 ? '' : 'hidden'}>
                <label className="block text-sm font-medium text-gray-700 mb-2">Set Location</label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentPosition) {
                        setLatLng({ lat: currentPosition.lat, lng: currentPosition.lng });
                      }
                    }}
                    className="w-full bg-gray-100 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-200"
                  >
                    Use current location
                  </button>
                  <button
                    type="button"
                    onClick={() => setLatLng(null)}
                    className="w-full bg-gray-100 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-200"
                  >
                    Place pin on map
                  </button>
                  {!latLng ? (
                    <div className="p-3 bg-orange-50 border border-orange-200 text-orange-600 rounded-xl text-center text-sm">
                      No pin selected. You can skip and we will use your current/default location.
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-center text-sm">
                      Pin set at {latLng.lat.toFixed(4)}, {latLng.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              </div>

              <div className={addStep === 3 ? '' : 'hidden'}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input required name="name" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="Restaurant name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea name="notes" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="Atmosphere, cuisine type..." />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={restaurantTypeSelection}
                        onChange={(event) => setRestaurantTypeSelection(event.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                      >
                        <option value="">Select type (optional)</option>
                        {typeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                        <option value="__custom__">Add new type...</option>
                      </select>
                      {restaurantTypeSelection === '__custom__' && (
                        <input
                          value={customRestaurantType}
                          onChange={(event) => setCustomRestaurantType(event.target.value)}
                          className="mt-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                          placeholder="Enter new type"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cuisine</label>
                      <select
                        value={restaurantCuisineSelection}
                        onChange={(event) => setRestaurantCuisineSelection(event.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                      >
                        <option value="">Select cuisine (optional)</option>
                        {cuisineOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                        <option value="__custom__">Add new cuisine...</option>
                      </select>
                      {restaurantCuisineSelection === '__custom__' && (
                        <input
                          value={customRestaurantCuisine}
                          onChange={(event) => setCustomRestaurantCuisine(event.target.value)}
                          className="mt-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                          placeholder="Enter new cuisine"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost for two (₹)</label>
                    <input name="costForTwo" type="number" min="0" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="600" />
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowDishBuilder((prev) => !prev)}
                      className="text-sm font-semibold text-gray-700"
                    >
                      {showDishBuilder ? 'Hide dish editor' : 'Add dishes now (optional)'}
                    </button>

                    {showDishBuilder && (
                      <div className="space-y-3 mt-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-700">Dish cards</h3>
                          <button
                            type="button"
                            onClick={addEmptyDishCard}
                            className="text-sm font-semibold text-red-500"
                          >
                            + Add card
                          </button>
                        </div>
                        <input
                          ref={dishPhotoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleDishPhotoUpload(e.target.files)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => dishPhotoInputRef.current?.click()}
                          className="w-full bg-gray-100 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-200"
                        >
                          Upload dish photos
                        </button>

                        {dishPhotos.length === 0 ? (
                          <p className="text-xs text-gray-400">You can skip this and add dishes later from details page.</p>
                        ) : (
                          <div className="space-y-3">
                            {dishPhotos.map((dish) => (
                              <div key={dish.id} className="border border-gray-200 rounded-xl p-3 space-y-3">
                                {dish.imageUrl && (
                                  <img src={dish.imageUrl} alt="Dish" className="w-full h-28 object-cover rounded-lg" />
                                )}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Dish Name</label>
                                  <input
                                    value={dish.name}
                                    onChange={(e) => updateDishCard(dish.id, { name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                    placeholder="Dish name"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={dish.rating}
                                      onChange={(e) => updateDishCard(dish.id, { rating: Number(e.target.value) })}
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Level</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="4"
                                      value={dish.priceLevel}
                                      onChange={(e) => updateDishCard(dish.id, { priceLevel: Number(e.target.value) })}
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                  <textarea
                                    value={dish.review}
                                    onChange={(e) => updateDishCard(dish.id, { review: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                    placeholder="Short description"
                                  />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Dish Cuisine</label>
                                    <select
                                      value={dish.isCustomCuisine ? '__custom__' : dish.cuisine}
                                      onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                          updateDishCard(dish.id, { isCustomCuisine: true, cuisine: '' });
                                          return;
                                        }
                                        updateDishCard(dish.id, { isCustomCuisine: false, cuisine: e.target.value });
                                      }}
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                    >
                                      <option value="">Select cuisine (optional)</option>
                                      {cuisineOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                      <option value="__custom__">Add new cuisine...</option>
                                    </select>
                                    {dish.isCustomCuisine && (
                                      <input
                                        value={dish.cuisine}
                                        onChange={(e) => updateDishCard(dish.id, { cuisine: e.target.value })}
                                        className="mt-2 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                        placeholder="Enter new cuisine"
                                      />
                                    )}
                                  </div>
                                  <div>
                                    <TagSelector
                                      label="Flavor Tags"
                                      selectedTags={dish.flavorTags}
                                      availableTags={flavorTags}
                                      onChange={(nextTags) => updateDishCard(dish.id, { flavorTags: nextTags })}
                                      onCreateTag={ensureFlavorTag}
                                      placeholder="Type to search or add"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeDishCard(dish.id)}
                                  className="text-xs text-red-500 font-semibold"
                                >
                                  Remove dish
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {addFormError && (
                <p className="text-sm text-red-600 font-medium">{addFormError}</p>
              )}

              <div className="sticky bottom-0 bg-white/95 backdrop-blur flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddStep((prev) => Math.max(1, prev - 1))}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
                >
                  Back
                </button>
                {addStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setAddStep((prev) => Math.min(3, prev + 1))}
                    className="flex-[2] py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex-[2] py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600"
                  >
                    Save Restaurant
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}