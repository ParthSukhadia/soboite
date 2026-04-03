import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Star, Utensils, SlidersHorizontal, RotateCcw, ImagePlus, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { Restaurant } from '../types';
import TagSelector from '../components/TagSelector';
import PriceLevelIcon from '../components/PriceLevelIcon';

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
      timeout: 20000,
      maximumAge: 0
    });

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
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
    const target = L.latLng(restaurant.lat, restaurant.lng);
    const nextZoom = Math.max(map.getZoom(), 16);
    map.flyTo(target, nextZoom, {
      animate: true,
      duration: 0.75,
      easeLinearity: 0.2
    });
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
    loading,
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
  const [filterLocations, setFilterLocations] = useState<string[]>([]);
  const [filterVegOnly, setFilterVegOnly] = useState(false);
  const [costRange, setCostRange] = useState({ min: '', max: '' });
  const [restaurantPhoto, setRestaurantPhoto] = useState('');
  const [restaurantTypeSelection, setRestaurantTypeSelection] = useState('');
  const [restaurantCuisineSelection, setRestaurantCuisineSelection] = useState('');
  const [customRestaurantType, setCustomRestaurantType] = useState('');
  const [customRestaurantCuisine, setCustomRestaurantCuisine] = useState('');
  const [restaurantPhotoPosition, setRestaurantPhotoPosition] = useState({ x: 50, y: 50 });
  const [restaurantPhotoZoom, setRestaurantPhotoZoom] = useState(1);
  const [isDraggingRestaurantPhoto, setIsDraggingRestaurantPhoto] = useState(false);
  const [showDishBuilder, setShowDishBuilder] = useState(false);
  const [isSavingRestaurant, setIsSavingRestaurant] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [dishPhotos, setDishPhotos] = useState<Array<{
    id: string;
    imageUrl: string;
    photoPosition: { x: number; y: number };
    photoZoom: number;
    name: string;
    rating: number;
    priceLevel: number;
    actualPrice: string;
    review: string;
    reviewDate: string;
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
  const restaurantPhotoTouchRef = useRef<{
    mode: 'pan' | 'pinch';
    startX: number;
    startY: number;
    x: number;
    y: number;
    startDistance: number;
    startZoom: number;
    midpointX: number;
    midpointY: number;
  } | null>(null);
  const restaurantPhotoRafRef = useRef<number | null>(null);
  const restaurantPhotoNextPositionRef = useRef({ x: 50, y: 50 });
  const dishPhotoDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const dishPhotoRafRef = useRef<number | null>(null);
  const dishPhotoNextPositionRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const dishPhotoTouchRef = useRef<{
    id: string;
    mode: 'pan' | 'pinch';
    startX: number;
    startY: number;
    x: number;
    y: number;
    startDistance: number;
    startZoom: number;
    midpointX: number;
    midpointY: number;
  } | null>(null);
  const [draggingDishPhotoId, setDraggingDishPhotoId] = useState<string | null>(null);
  const isApiBusy = loading || isSavingRestaurant;
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

  const locationOptions = useMemo(() => {
    const values = restaurants
      .map((r) => r.locationName)
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [restaurants]);

  const matchesFilters = (restaurant: Restaurant) => {
    const matchesType = filterTypes.length === 0 || (restaurant.type ? filterTypes.includes(restaurant.type) : false);
    const matchesCuisine = filterCuisines.length === 0 || (restaurant.cuisine ? filterCuisines.includes(restaurant.cuisine) : false);
    const matchesLocation = filterLocations.length === 0 || (restaurant.locationName ? filterLocations.includes(restaurant.locationName) : false);
    const matchesVegOnly = !filterVegOnly || Boolean(restaurant.vegOnly);

    const minCost = costRange.min ? Number(costRange.min) : null;
    const maxCost = costRange.max ? Number(costRange.max) : null;
    const hasCostFilter = minCost !== null || maxCost !== null;
    const costValue = restaurant.costForTwo ?? null;
    const matchesCost = !hasCostFilter
      || (costValue !== null
        && (minCost === null || costValue >= minCost)
        && (maxCost === null || costValue <= maxCost));

    return matchesType && matchesCuisine && matchesLocation && matchesVegOnly && matchesCost;
  };

  const toggleTypeFilter = (value: string) => {
    setFilterTypes((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const toggleCuisineFilter = (value: string) => {
    setFilterCuisines((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const toggleLocationFilter = (value: string) => {
    setFilterLocations((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const clearFilters = () => {
    setFilterTypes([]);
    setFilterCuisines([]);
    setFilterLocations([]);
    setFilterVegOnly(false);
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
    navigate('/restaurant/new');
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

  const getTouchDistance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const getTouchMidpoint = (a: React.Touch, b: React.Touch) => ({
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2
  });

  const handleRestaurantPhotoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!restaurantPhoto) return;
    event.preventDefault();
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

    restaurantPhotoNextPositionRef.current = {
      x: clampPercent(restaurantPhotoDragRef.current.x - (deltaX / previewWidth) * 100),
      y: clampPercent(restaurantPhotoDragRef.current.y - (deltaY / previewHeight) * 100)
    };

    if (restaurantPhotoRafRef.current === null) {
      restaurantPhotoRafRef.current = window.requestAnimationFrame(() => {
        setRestaurantPhotoPosition(restaurantPhotoNextPositionRef.current);
        restaurantPhotoRafRef.current = null;
      });
    }
  };

  const handleRestaurantPhotoPointerUp = () => {
    if (restaurantPhotoRafRef.current !== null) {
      window.cancelAnimationFrame(restaurantPhotoRafRef.current);
      restaurantPhotoRafRef.current = null;
    }
    setRestaurantPhotoPosition(restaurantPhotoNextPositionRef.current);
    restaurantPhotoDragRef.current = null;
    setIsDraggingRestaurantPhoto(false);
  };

  const handleRestaurantPhotoTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!restaurantPhoto || !restaurantPhotoPreviewRef.current) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      restaurantPhotoTouchRef.current = {
        mode: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        x: restaurantPhotoPosition.x,
        y: restaurantPhotoPosition.y,
        startDistance: 0,
        startZoom: restaurantPhotoZoom,
        midpointX: 0,
        midpointY: 0
      };
      setIsDraggingRestaurantPhoto(true);
      return;
    }

    if (event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const midpoint = getTouchMidpoint(first, second);
      restaurantPhotoTouchRef.current = {
        mode: 'pinch',
        startX: midpoint.x,
        startY: midpoint.y,
        x: restaurantPhotoPosition.x,
        y: restaurantPhotoPosition.y,
        startDistance: getTouchDistance(first, second),
        startZoom: restaurantPhotoZoom,
        midpointX: midpoint.x,
        midpointY: midpoint.y
      };
      setIsDraggingRestaurantPhoto(true);
    }
  };

  const handleRestaurantPhotoTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const active = restaurantPhotoTouchRef.current;
    const preview = restaurantPhotoPreviewRef.current;
    if (!active || !preview) return;

    event.preventDefault();

    const width = preview.clientWidth || 1;
    const height = preview.clientHeight || 1;

    if (active.mode === 'pan' && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - active.startX;
      const deltaY = touch.clientY - active.startY;
      const next = {
        x: clampPercent(active.x - (deltaX / width) * 100),
        y: clampPercent(active.y - (deltaY / height) * 100)
      };
      restaurantPhotoNextPositionRef.current = next;
      setRestaurantPhotoPosition(next);
      return;
    }

    if (active.mode === 'pinch' && event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const distance = getTouchDistance(first, second);
      const midpoint = getTouchMidpoint(first, second);
      const zoomRatio = active.startDistance > 0 ? distance / active.startDistance : 1;
      const nextZoom = Math.min(3, Math.max(1, active.startZoom * zoomRatio));
      const deltaX = midpoint.x - active.midpointX;
      const deltaY = midpoint.y - active.midpointY;
      const next = {
        x: clampPercent(active.x - (deltaX / width) * 100),
        y: clampPercent(active.y - (deltaY / height) * 100)
      };
      restaurantPhotoNextPositionRef.current = next;
      setRestaurantPhotoZoom(nextZoom);
      setRestaurantPhotoPosition(next);
    }
  };

  const handleRestaurantPhotoTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) {
      restaurantPhotoTouchRef.current = null;
      setIsDraggingRestaurantPhoto(false);
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      restaurantPhotoTouchRef.current = {
        mode: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        x: restaurantPhotoPosition.x,
        y: restaurantPhotoPosition.y,
        startDistance: 0,
        startZoom: restaurantPhotoZoom,
        midpointX: 0,
        midpointY: 0
      };
    }
  };

  const buildPositionedRestaurantPhoto = async () => {
    if (!restaurantPhoto) return undefined;

    const image = new Image();
    image.src = restaurantPhoto;
    await image.decode();

    const targetWidth = 1200;
    const targetHeight = 1200;
    const targetRatio = targetWidth / targetHeight;
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const safeZoom = Math.min(3, Math.max(1, restaurantPhotoZoom));

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (imageRatio > targetRatio) {
      sourceHeight = image.naturalHeight / safeZoom;
      sourceWidth = sourceHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) * (restaurantPhotoPosition.x / 100);
      sourceY = (image.naturalHeight - sourceHeight) * (restaurantPhotoPosition.y / 100);
    } else {
      sourceWidth = image.naturalWidth / safeZoom;
      sourceHeight = sourceWidth / targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) * (restaurantPhotoPosition.x / 100);
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

  const buildPositionedDishPhoto = async (
    imageUrl: string,
    photoPosition: { x: number; y: number },
    photoZoom: number
  ) => {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();

    const targetWidth = 1200;
    const targetHeight = 1200;
    const targetRatio = targetWidth / targetHeight;
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const safeZoom = Math.min(3, Math.max(1, photoZoom));

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (imageRatio > targetRatio) {
      sourceHeight = image.naturalHeight / safeZoom;
      sourceWidth = sourceHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) * (photoPosition.x / 100);
      sourceY = (image.naturalHeight - sourceHeight) * (photoPosition.y / 100);
    } else {
      sourceWidth = image.naturalWidth / safeZoom;
      sourceHeight = sourceWidth / targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) * (photoPosition.x / 100);
      sourceY = (image.naturalHeight - sourceHeight) * (photoPosition.y / 100);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return imageUrl;

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
    setRestaurantPhotoZoom(1);
    restaurantPhotoNextPositionRef.current = { x: 50, y: 50 };
    if (restaurantPhotoInputRef.current) {
      restaurantPhotoInputRef.current.value = '';
    }
    setAddFormError(null);
  };

  const handleDishPhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const urls = await Promise.all(Array.from(files).map(fileToDataUrl));
    const today = new Date().toISOString().slice(0, 10);
    setDishPhotos((prev) => [
      ...prev,
      ...urls.map((url) => ({
        id: createId(),
        imageUrl: url,
        photoPosition: { x: 50, y: 50 },
        photoZoom: 1,
        name: '',
        rating: 5,
        priceLevel: 2,
        actualPrice: '',
        review: '',
        reviewDate: today,
        cuisine: '',
        flavorTags: [],
        isCustomCuisine: false
      }))
    ]);
    if (dishPhotoInputRef.current) {
      dishPhotoInputRef.current.value = '';
    }
  };

  const addEmptyDishCard = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDishPhotos((prev) => [
      ...prev,
      {
        id: createId(),
        imageUrl: '',
        photoPosition: { x: 50, y: 50 },
        photoZoom: 1,
        name: '',
        rating: 5,
        priceLevel: 2,
        actualPrice: '',
        review: '',
        reviewDate: today,
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

  const handleDishPhotoPointerDown = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    const dish = dishPhotos.find((item) => item.id === id);
    if (!dish || !dish.imageUrl) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingDishPhotoId(id);

    dishPhotoDragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      x: dish.photoPosition.x,
      y: dish.photoPosition.y,
      width: event.currentTarget.clientWidth || 1,
      height: event.currentTarget.clientHeight || 1
    };
  };

  const handleDishPhotoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dishPhotoDragRef.current) return;

    const drag = dishPhotoDragRef.current;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const next = {
      id: drag.id,
      x: clampPercent(drag.x - (deltaX / drag.width) * 100),
      y: clampPercent(drag.y - (deltaY / drag.height) * 100)
    };

    dishPhotoNextPositionRef.current = next;

    if (dishPhotoRafRef.current === null) {
      dishPhotoRafRef.current = window.requestAnimationFrame(() => {
        if (!dishPhotoNextPositionRef.current) return;
        const current = dishPhotoNextPositionRef.current;
        updateDishCard(current.id, { photoPosition: { x: current.x, y: current.y } });
        dishPhotoRafRef.current = null;
      });
    }
  };

  const handleDishPhotoPointerUp = () => {
    if (dishPhotoRafRef.current !== null) {
      window.cancelAnimationFrame(dishPhotoRafRef.current);
      dishPhotoRafRef.current = null;
    }

    if (dishPhotoNextPositionRef.current) {
      const current = dishPhotoNextPositionRef.current;
      updateDishCard(current.id, { photoPosition: { x: current.x, y: current.y } });
    }

    dishPhotoDragRef.current = null;
    dishPhotoNextPositionRef.current = null;
    setDraggingDishPhotoId(null);
  };

  const handleDishPhotoTouchStart = (id: string, event: React.TouchEvent<HTMLDivElement>) => {
    const dish = dishPhotos.find((item) => item.id === id);
    if (!dish || !dish.imageUrl) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      dishPhotoTouchRef.current = {
        id,
        mode: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        x: dish.photoPosition.x,
        y: dish.photoPosition.y,
        startDistance: 0,
        startZoom: dish.photoZoom,
        midpointX: 0,
        midpointY: 0
      };
      setDraggingDishPhotoId(id);
      return;
    }

    if (event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const midpoint = getTouchMidpoint(first, second);
      dishPhotoTouchRef.current = {
        id,
        mode: 'pinch',
        startX: midpoint.x,
        startY: midpoint.y,
        x: dish.photoPosition.x,
        y: dish.photoPosition.y,
        startDistance: getTouchDistance(first, second),
        startZoom: dish.photoZoom,
        midpointX: midpoint.x,
        midpointY: midpoint.y
      };
      setDraggingDishPhotoId(id);
    }
  };

  const handleDishPhotoTouchMove = (id: string, event: React.TouchEvent<HTMLDivElement>) => {
    const active = dishPhotoTouchRef.current;
    if (!active || active.id !== id) return;

    event.preventDefault();

    const previewWidth = event.currentTarget.clientWidth || 1;
    const previewHeight = event.currentTarget.clientHeight || 1;

    if (active.mode === 'pan' && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - active.startX;
      const deltaY = touch.clientY - active.startY;
      updateDishCard(id, {
        photoPosition: {
          x: clampPercent(active.x - (deltaX / previewWidth) * 100),
          y: clampPercent(active.y - (deltaY / previewHeight) * 100)
        }
      });
      return;
    }

    if (active.mode === 'pinch' && event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const distance = getTouchDistance(first, second);
      const midpoint = getTouchMidpoint(first, second);
      const zoomRatio = active.startDistance > 0 ? distance / active.startDistance : 1;
      const nextZoom = Math.min(3, Math.max(1, active.startZoom * zoomRatio));
      const deltaX = midpoint.x - active.midpointX;
      const deltaY = midpoint.y - active.midpointY;
      updateDishCard(id, {
        photoZoom: nextZoom,
        photoPosition: {
          x: clampPercent(active.x - (deltaX / previewWidth) * 100),
          y: clampPercent(active.y - (deltaY / previewHeight) * 100)
        }
      });
    }
  };

  const handleDishPhotoTouchEnd = (id: string, event: React.TouchEvent<HTMLDivElement>) => {
    const active = dishPhotoTouchRef.current;
    if (!active || active.id !== id) return;

    if (event.touches.length === 0) {
      dishPhotoTouchRef.current = null;
      setDraggingDishPhotoId(null);
      return;
    }

    if (event.touches.length === 1) {
      const dish = dishPhotos.find((item) => item.id === id);
      if (!dish) return;
      const touch = event.touches[0];
      dishPhotoTouchRef.current = {
        id,
        mode: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        x: dish.photoPosition.x,
        y: dish.photoPosition.y,
        startDistance: 0,
        startZoom: dish.photoZoom,
        midpointX: 0,
        midpointY: 0
      };
    }
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
    [restaurants, filterTypes, filterCuisines, filterLocations, filterVegOnly, costRange]
  );

  const distanceScore = (a: Restaurant, b: Restaurant) => {
    const lat = a.lat - b.lat;
    const lng = a.lng - b.lng;
    return (lat * lat) + (lng * lng);
  };

  const displayRestaurants = useMemo(() => {
    if (!selectedRest) return [];
    const selected = restaurants.find((rest) => rest.id === selectedRest);
    if (!selected) return [];

    const pool = filteredRestaurants.some((rest) => rest.id === selected.id)
      ? filteredRestaurants
      : [selected, ...filteredRestaurants];

    const sortedByDistance = pool
      .map((rest) => ({ rest, score: distanceScore(rest, selected) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map((item) => item.rest);

    const selectedCard = sortedByDistance.find((rest) => rest.id === selected.id);
    if (!selectedCard) return sortedByDistance;

    const others = sortedByDistance.filter((rest) => rest.id !== selected.id);
    const leftCards = others.slice(0, 2);
    const rightCards = others.slice(2, 4);

    return [...leftCards, selectedCard, ...rightCards];
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
    if (isApiBusy) return;
    const data = new FormData(e.currentTarget);
    const name = data.get('name') as string;
    const notes = data.get('notes') as string;
    const selectedType = restaurantTypeSelection === '__custom__' ? customRestaurantType : restaurantTypeSelection;
    const selectedCuisine = restaurantCuisineSelection === '__custom__' ? customRestaurantCuisine : restaurantCuisineSelection;
    const type = selectedType.trim();
    const cuisine = selectedCuisine.trim();
    const locationName = String(data.get('locationName') ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
    const address = String(data.get('address') ?? '').trim();
    const costForTwoInput = data.get('costForTwo') as string;
    const costForTwo = costForTwoInput ? Number(costForTwoInput) : undefined;

    if (!name) {
      setAddFormError('Please enter a restaurant name.');
      return;
    }

    const invalidDish = dishPhotos.find((dish) => {
      const hasAnyContent = Boolean(
        dish.name.trim() || dish.review.trim() || dish.imageUrl || dish.cuisine.trim() || dish.actualPrice.trim() || dish.flavorTags.length > 0
      );
      if (!hasAnyContent) return false;
      return !dish.name.trim() || !dish.review.trim();
    });
    if (invalidDish) {
      setAddFormError('For each dish card you fill, name and description are required.');
      return;
    }

    try {
      setIsSavingRestaurant(true);
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
        locationName: locationName || undefined,
        address: address || undefined,
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
        const parsedActualPrice = dish.actualPrice ? Number(dish.actualPrice) : Number.NaN;
        const reviewText = dish.review.trim();
        const reviewDate = dish.reviewDate || new Date().toISOString().slice(0, 10);
        const positionedDishPhoto = dish.imageUrl
          ? await buildPositionedDishPhoto(dish.imageUrl, dish.photoPosition, dish.photoZoom)
          : undefined;
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
          priceLevel: Math.min(3, Math.max(1, dish.priceLevel)) as 1 | 2 | 3,
          actualPrice: Number.isFinite(parsedActualPrice) ? parsedActualPrice : undefined,
          review: reviewText || undefined,
          reviewDate: reviewDate,
          reviews: [{ id: createId(), text: reviewText, date: reviewDate, createdAt: Date.now() }],
          cuisine: dish.cuisine || undefined,
          flavorTags: tags.length > 0 ? tags : undefined,
          imageUrl: positionedDishPhoto || dish.imageUrl || undefined
        });
      }

      await fetchData();
      closeAddForm();
      setSelectedRest(restaurantId);
    } catch (error) {
      setAddFormError(error instanceof Error ? error.message : 'Could not save restaurant.');
    } finally {
      setIsSavingRestaurant(false);
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
      if (restaurantPhotoRafRef.current !== null) {
        window.cancelAnimationFrame(restaurantPhotoRafRef.current);
      }
      if (dishPhotoRafRef.current !== null) {
        window.cancelAnimationFrame(dishPhotoRafRef.current);
      }
      restaurantPhotoTouchRef.current = null;
      dishPhotoTouchRef.current = null;
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
    ...filterLocations.map((location) => ({
      key: `location:${location}`,
      label: location,
      onRemove: () => toggleLocationFilter(location)
    })),
    ...(filterVegOnly ? [{
      key: 'vegOnly',
      label: 'Veg only',
      onRemove: () => setFilterVegOnly(false)
    }] : []),
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
          disabled={isApiBusy}
          className="bg-white/95 backdrop-blur border border-gray-200 rounded-full shadow-lg p-3 text-gray-700 hover:text-black disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Open filters"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {selectedFilters.length > 0 && (
        <div className="absolute top-16 right-4 z-[1000] max-w-[70vw]">
          <div className="flex flex-col items-end gap-2">
            {selectedFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                disabled={isApiBusy}
                onClick={filter.onRemove}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/70 backdrop-blur border border-white/70 text-gray-800 hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                {filter.label}
                <X size={12} />
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
              className="absolute top-16 left-1/2 -translate-x-1/2 w-[min(94%,520px)] max-h-[78dvh] overflow-y-auto overscroll-contain [touch-action:pan-y] bg-white/88 backdrop-blur rounded-2xl shadow-2xl border border-white/70 p-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
                <div className="flex items-center gap-2">
                  <button onClick={clearFilters} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" aria-label="Clear filters">
                    <RotateCcw size={16} />
                  </button>
                  <button disabled={isApiBusy} onClick={() => setShowFilters(false)} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed" aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
              </div>
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
                          disabled={isApiBusy}
                          onClick={() => toggleTypeFilter(type)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-60 disabled:cursor-not-allowed ${isActive ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
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
                          disabled={isApiBusy}
                          onClick={() => toggleCuisineFilter(cuisine)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-60 disabled:cursor-not-allowed ${isActive ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
                        >
                          {cuisine}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2">Location</label>
                  <div className="flex flex-wrap gap-2">
                    {locationOptions.map((location) => {
                      const isActive = filterLocations.includes(location);
                      return (
                        <button
                          key={location}
                          type="button"
                          disabled={isApiBusy}
                          onClick={() => toggleLocationFilter(location)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-60 disabled:cursor-not-allowed ${isActive ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
                        >
                          {location}
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
                      disabled={isApiBusy}
                      value={costRange.min}
                      onChange={(e) => setCostRange((prev) => ({ ...prev, min: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder={costOptions.length > 0 ? `Min ${costOptions[0]}` : 'Min'}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      min="0"
                      disabled={isApiBusy}
                      value={costRange.max}
                      onChange={(e) => setCostRange((prev) => ({ ...prev, max: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder={costOptions.length > 0 ? `Max ${costOptions[costOptions.length - 1]}` : 'Max'}
                    />
                  </div>
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterVegOnly}
                      onChange={(event) => setFilterVegOnly(event.target.checked)}
                    />
                    Veg only
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2">Selected</label>
                  {selectedFilters.length === 0 ? (
                    <p className="text-xs text-gray-400">No filters applied</p>
                  ) : (
                    <div className="flex flex-col items-start gap-2">
                      {selectedFilters.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          disabled={isApiBusy}
                          onClick={filter.onRemove}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/75 backdrop-blur border border-white/70 text-gray-800 hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {filter.label}
                          <X size={12} />
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
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 h-full px-[12vw]"
            >
              {displayRestaurants.map((rest) => {
                const rating = ratingsByRestaurant.get(rest.id);
                const isSelected = rest.id === selectedRest;
                return (
                  <div
                    key={rest.id}
                    ref={setCardRef(rest.id)}
                    className={`snap-center w-[76vw] max-w-[320px] min-w-[260px] flex-none bg-white rounded-2xl shadow-lg border overflow-hidden transition h-full ${isSelected ? 'border-black' : 'border-gray-200'}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRest(rest.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedRest(rest.id);
                        }
                      }}
                      className="w-full h-full text-left flex flex-col cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
                              {rest.locationName && <span>• {rest.locationName}</span>}
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
                    </div>
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
          disabled={isApiBusy}
          className="absolute right-6 z-[1000] bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-xl active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ bottom: displayRestaurants.length > 0 ? 'calc(28vh + 16px)' : 'calc(16px + env(safe-area-inset-bottom))' }}
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
              <button disabled={isApiBusy} onClick={closeAddForm} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddSubmit} onFocusCapture={handleFormFocusCapture} className="space-y-4 pb-24">
              <fieldset disabled={isApiBusy} className="space-y-4 disabled:opacity-70">
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
                  disabled={isApiBusy}
                  className="w-full bg-black text-white font-medium py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Upload photo
                </button>
                {restaurantPhoto && (
                  <div
                    ref={restaurantPhotoPreviewRef}
                    className={`mt-3 rounded-xl overflow-hidden aspect-square relative [touch-action:none] ${isDraggingRestaurantPhoto ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onPointerDown={handleRestaurantPhotoPointerDown}
                    onPointerMove={handleRestaurantPhotoPointerMove}
                    onPointerUp={handleRestaurantPhotoPointerUp}
                    onPointerCancel={handleRestaurantPhotoPointerUp}
                    onTouchStart={handleRestaurantPhotoTouchStart}
                    onTouchMove={handleRestaurantPhotoTouchMove}
                    onTouchEnd={handleRestaurantPhotoTouchEnd}
                  >
                    <img
                      src={restaurantPhoto}
                      alt="Restaurant preview"
                      className="w-full h-full object-cover pointer-events-none select-none"
                      style={{ objectPosition: `${restaurantPhotoPosition.x}% ${restaurantPhotoPosition.y}%`, transform: `scale(${restaurantPhotoZoom})` }}
                      draggable={false}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRestaurantPhoto('');
                        setRestaurantPhotoPosition({ x: 50, y: 50 });
                        setRestaurantPhotoZoom(1);
                        restaurantPhotoNextPositionRef.current = { x: 50, y: 50 };
                        if (restaurantPhotoInputRef.current) {
                          restaurantPhotoInputRef.current.value = '';
                        }
                      }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
                      aria-label="Remove restaurant photo"
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute left-2 right-2 bottom-2 text-[11px] bg-black/60 text-white px-2 py-1 rounded-md text-center">
                      Drag to pan, pinch to zoom
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                      <input
                        name="locationName"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                        placeholder="Fort"
                      />
                      <p className="mt-1 text-xs text-gray-500">One word area name, used in filters.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input
                        name="address"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                        placeholder="Street and landmark"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={restaurantTypeSelection}
                        onChange={(event) => setRestaurantTypeSelection(event.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                      >
                        <option value="">Select type</option>
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
                        <option value="">Select cuisine</option>
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
                      {showDishBuilder ? 'Hide dish editor' : 'Add dishes now'}
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
                          disabled={isApiBusy}
                          aria-label="Upload dish photos"
                          title="Upload dish photos"
                          className="h-11 w-11 rounded-full border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <ImagePlus size={18} />
                        </button>

                        {dishPhotos.length === 0 ? (
                          <p className="text-xs text-gray-400">You can skip this and add dishes later from details page.</p>
                        ) : (
                          <div className="space-y-3">
                            {dishPhotos.map((dish) => (
                              <div key={dish.id} className="border border-gray-200 rounded-xl p-3 space-y-3">
                                {dish.imageUrl && (
                                  <div
                                    className={`w-full rounded-lg overflow-hidden aspect-square relative [touch-action:none] ${draggingDishPhotoId === dish.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                                    onPointerDown={(event) => handleDishPhotoPointerDown(dish.id, event)}
                                    onPointerMove={handleDishPhotoPointerMove}
                                    onPointerUp={handleDishPhotoPointerUp}
                                    onPointerCancel={handleDishPhotoPointerUp}
                                    onTouchStart={(event) => handleDishPhotoTouchStart(dish.id, event)}
                                    onTouchMove={(event) => handleDishPhotoTouchMove(dish.id, event)}
                                    onTouchEnd={(event) => handleDishPhotoTouchEnd(dish.id, event)}
                                  >
                                    <img
                                      src={dish.imageUrl}
                                      alt="Dish"
                                      className="w-full h-full object-cover pointer-events-none select-none"
                                      style={{ objectPosition: `${dish.photoPosition.x}% ${dish.photoPosition.y}%`, transform: `scale(${dish.photoZoom})` }}
                                      draggable={false}
                                    />
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateDishCard(dish.id, {
                                          imageUrl: '',
                                          photoPosition: { x: 50, y: 50 },
                                          photoZoom: 1
                                        });
                                      }}
                                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
                                      aria-label="Remove dish photo"
                                    >
                                      <X size={12} />
                                    </button>
                                    <div className="absolute left-2 right-2 bottom-2 text-[10px] bg-black/60 text-white px-2 py-1 rounded text-center">
                                      Drag to pan, pinch to zoom
                                    </div>
                                  </div>
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
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Actual Price (₹)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={dish.actualPrice}
                                    onChange={(e) => updateDishCard(dish.id, { actualPrice: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                    placeholder="250"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Icons</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={dish.priceLevel}
                                    onChange={(e) => updateDishCard(dish.id, { priceLevel: Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                  />
                                  <p className="mt-1 text-xs text-gray-500 inline-flex items-center gap-1">
                                    Preview:
                                    <PriceLevelIcon level={Math.min(3, Math.max(1, dish.priceLevel))} />
                                  </p>
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
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Review Date</label>
                                  <input
                                    type="date"
                                    value={dish.reviewDate}
                                    onChange={(e) => updateDishCard(dish.id, { reviewDate: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
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
                                      <option value="">Select cuisine</option>
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
              </fieldset>

              {addFormError && (
                <p className="text-sm text-red-600 font-medium">{addFormError}</p>
              )}

              <div className="sticky bottom-0 bg-white/95 backdrop-blur flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={isApiBusy}
                  onClick={() => setAddStep((prev) => Math.max(1, prev - 1))}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                {addStep < 3 ? (
                  <button
                    type="button"
                    disabled={isApiBusy}
                    onClick={() => setAddStep((prev) => Math.min(3, prev + 1))}
                    className="flex-[2] py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isApiBusy}
                    className="flex-[2] py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSavingRestaurant ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isSavingRestaurant ? 'Saving...' : 'Save Restaurant'}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}

      </AnimatePresence>

      {isApiBusy && (
        <div className="fixed inset-0 z-[1200] bg-black/10 pointer-events-auto">
          <div className="absolute top-4 right-4 bg-white rounded-full p-2 shadow">
            <Loader2 size={16} className="animate-spin text-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
}