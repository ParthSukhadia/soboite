"use client";

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
// react-leaflet type variations across versions can cause strict TS complaints
// in this lightweight example we cast components to `any` to keep the file simple
// and avoid complex typing work while remaining functionally correct.
const MapContainerAny: any = MapContainer as any;
const TileLayerAny: any = TileLayer as any;
const CircleMarkerAny: any = CircleMarker as any;
const PopupAny: any = Popup as any;
import { Restaurant } from './RestaurantCard';

type Props = {
  restaurants: Restaurant[];
  onViewDetails?: (id: string | number) => void;
};

export default function MapView({ restaurants, onViewDetails }: Props) {
  const points = restaurants
    .map((r) => (r.lat && r.lng ? { ...r, lat: Number(r.lat), lng: Number(r.lng) } : null))
    .filter(Boolean) as (Restaurant & { lat: number; lng: number })[];

  const center = useMemo(() => {
    if (!points.length) return { lat: 20.5937, lng: 78.9629 }; // fallback: India center
    const lat = points.reduce((s, p) => s + (p.lat ?? 0), 0) / points.length;
    const lng = points.reduce((s, p) => s + (p.lng ?? 0), 0) / points.length;
    return { lat, lng };
  }, [points]);

  return (
    <div className="w-full h-96 md:h-[80vh] rounded bg-white overflow-hidden">
      <MapContainerAny center={[center.lat, center.lng]} zoom={13} className="w-full h-full">
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((p) => (
          <CircleMarkerAny
            key={`${p.id ?? `${p.lat}-${p.lng}`}`}
            center={[p.lat, p.lng]}
            radius={8}
            pathOptions={{ color: '#1f2937', fillColor: '#ef4444', fillOpacity: 1 }}
          >
            <PopupAny>
              <div className="min-w-[160px]">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-600">Rating: {p.rating ?? '—'}</div>
                <div className="mt-2">
                  <button
                    onClick={() => onViewDetails?.(p.id)}
                    className="rl-popup-button"
                  >
                    View details
                  </button>
                </div>
              </div>
            </PopupAny>
          </CircleMarkerAny>
        ))}
      </MapContainerAny>
    </div>
  );
}
