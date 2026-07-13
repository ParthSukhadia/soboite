import { useEffect, useRef, useState } from 'react';
import { useMap, CircleMarker, Tooltip } from 'react-leaflet';

type POI = {
  id: number;
  lat: number;
  lng: number;
  name: string;
  type: string;
};

export default function NearbyPOIs() {
  const map = useMap();
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchPOIs = async () => {
      if (map.getZoom() < 16) {
        setPois([]);
        return;
      }
      
      const bounds = map.getBounds();
      const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
      
      const query = `
        [out:json][timeout:10];
        (
          nwr["amenity"="restaurant"](${bbox});
          nwr["amenity"="cafe"](${bbox});
          nwr["tourism"="hotel"](${bbox});
        );
        out center;
      `;
      
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      controllerRef.current = new AbortController();

      setLoading(true);
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'data=' + encodeURIComponent(query),
          signal: controllerRef.current.signal
        });
        if (!res.ok) throw new Error('Failed to fetch from Overpass');
        const data = await res.json();
        
        const results = data.elements
          .map((el: any) => ({
            id: el.id,
            lat: el.lat ?? el.center?.lat,
            lng: el.lon ?? el.center?.lon,
            name: el.tags?.name || '',
            type: el.tags?.amenity || el.tags?.tourism || 'place'
          }))
          .filter((el: any) => el.name.trim() !== '' && el.lat && el.lng);
          
        console.log('Overpass API returned', data.elements.length, 'elements');
        console.log('Filtered to', results.length, 'POIs:', results);
        setPois(results);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Failed to fetch POIs', e);
        }
      } finally {
        setLoading(false);
      }
    };

    const handleMoveEnd = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(fetchPOIs, 800);
    };

    map.on('moveend', handleMoveEnd);
    // Initial fetch
    handleMoveEnd();

    return () => {
      map.off('moveend', handleMoveEnd);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [map]);

  const getPoiColor = (type: string) => {
    if (type === 'cafe') return { color: '#d97706', fill: '#fcd34d' };
    if (type === 'hotel') return { color: '#4f46e5', fill: '#818cf8' };
    return { color: '#e11d48', fill: '#fb7185' }; // restaurant
  };

  return (
    <>
      <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none', right: '10px', top: '10px', position: 'absolute', zIndex: 1000 }}>
        {loading && (
          <div className="bg-white/90 px-2 py-1 rounded text-xs font-medium text-gray-600 shadow-sm mb-1">
            Loading places...
          </div>
        )}
      </div>
      {pois.map(poi => {
        const colors = getPoiColor(poi.type);
        return (
          <CircleMarker
            key={poi.id}
            center={[poi.lat, poi.lng]}
            radius={5}
            pathOptions={{ color: colors.color, fillColor: colors.fill, fillOpacity: 0.9, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -5]} opacity={1}>
              <span className="text-xs font-bold text-gray-800">{poi.name}</span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
