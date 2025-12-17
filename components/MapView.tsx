"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker } from 'react-leaflet';
import { Icon } from 'leaflet';
// react-leaflet type variations across versions can cause strict TS complaints
// in this lightweight example we cast components to `any` to keep the file simple
// and avoid complex typing work while remaining functionally correct.
const MapContainerAny: any = MapContainer as any;
const TileLayerAny: any = TileLayer as any;
const CircleMarkerAny: any = CircleMarker as any;
const PopupAny: any = Popup as any;
const MarkerAny: any = Marker as any;
import { Restaurant } from './RestaurantCard';

type Props = {
  restaurants: Restaurant[];
  onViewDetails?: (id: string | number) => void;
};

export default function MapView({ restaurants, onViewDetails }: Props) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const points = restaurants
    .map((r) => {
      const lat = r.geo_lat ?? r.geo_lat;
      const lng = r.geo_lng ?? r.geo_lng;
      return lat && lng ? { ...r, lat: Number(lat), lng: Number(lng) } : null;
    })
    .filter(Boolean) as (Restaurant & { lat: number; lng: number })[];

  console.log('Restaurants:', restaurants);
  console.log('Points:', points);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
        }
      );
    }
  }, []);

  const center = useMemo(() => {
    if (!points.length) return { lat: 18.9431, lng: 72.8272 }; // fallback: India center
    const lat = points.reduce((s, p) => s + (p.lat ?? 0), 0) / points.length;
    const lng = points.reduce((s, p) => s + (p.lng ?? 0), 0) / points.length;
    return { lat, lng };
  }, [points]);

  const redIcon = useMemo(() => new Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }), []);

  const blueIcon = useMemo(() => new Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }), []);

  return (
    <div className="w-full h-full bg-white overflow-hidden">
      <MapContainerAny center={[center.lat, center.lng]} zoom={13} className="w-full h-full" style={{ height: '100%', width: '100%' }}>
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((p) => (
          <MarkerAny
            key={`${p.id ?? `${p.lat}-${p.lng}`}`}
            position={[p.lat, p.lng]}
            icon={redIcon}
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
          </MarkerAny>
        ))}

        {userLocation && (
          <MarkerAny position={[userLocation.lat, userLocation.lng]} icon={blueIcon}>
            <PopupAny>You are here</PopupAny>
          </MarkerAny>
        )}
      </MapContainerAny>
    </div>
  );
}
