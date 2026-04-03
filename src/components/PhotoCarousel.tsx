import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Trash2 } from 'lucide-react';
import { PhotoEntry } from '../types';

interface PhotoCarouselProps {
  photos: PhotoEntry[];
  primaryPhotoId?: string;
  onPrimaryChange?: (photoId: string) => void;
  onRemovePhoto?: (photoId: string) => void;
  className?: string;
  showDate?: boolean;
  editable?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function PhotoCarousel({
  photos,
  primaryPhotoId,
  onPrimaryChange,
  onRemovePhoto,
  className = '',
  showDate = true,
  editable = false
}: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const touchRef = useRef<{
    mode: 'pan' | 'pinch';
    startDistance: number;
    startScale: number;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);

  const safePhotos = useMemo(() => photos.filter((photo) => Boolean(photo.url)), [photos]);
  const activePhoto = safePhotos[index];

  const showPrevious = () => setIndex((prev) => (prev - 1 + safePhotos.length) % safePhotos.length);
  const showNext = () => setIndex((prev) => (prev + 1) % safePhotos.length);

  useEffect(() => {
    if (index > safePhotos.length - 1) {
      setIndex(Math.max(0, safePhotos.length - 1));
    }
  }, [index, safePhotos.length]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [index]);

  const clampOffset = (nextX: number, nextY: number, targetScale: number) => {
    if (!frameRef.current || targetScale <= 1) {
      return { x: 0, y: 0 };
    }

    const rect = frameRef.current.getBoundingClientRect();
    const maxX = ((targetScale - 1) * rect.width) / 2;
    const maxY = ((targetScale - 1) * rect.height) / 2;

    return {
      x: clamp(nextX, -maxX, maxX),
      y: clamp(nextY, -maxY, maxY)
    };
  };

  const formatUploadedAt = (value: string) => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    return new Date(parsed).toLocaleDateString();
  };

  const getDistance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  if (safePhotos.length === 0) {
    return (
      <div className={`aspect-square rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-400 flex items-center justify-center text-sm ${className}`}>
        No photos yet
      </div>
    );
  }

  return (
    <div className={`relative aspect-square rounded-2xl overflow-hidden border border-gray-100 bg-gray-100 ${className}`}>
      <div
        ref={frameRef}
        className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} [touch-action:none]`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsDragging(true);
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            ox: offset.x,
            oy: offset.y
          };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          const deltaX = event.clientX - dragRef.current.x;
          const deltaY = event.clientY - dragRef.current.y;

          if (safePhotos.length > 1 && scale <= 1.02 && Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) + 10) {
            if (deltaX < 0) {
              showNext();
            } else {
              showPrevious();
            }
            dragRef.current = null;
            setIsDragging(false);
            return;
          }

          setOffset(clampOffset(dragRef.current.ox + deltaX, dragRef.current.oy + deltaY, scale));
        }}
        onPointerUp={() => {
          dragRef.current = null;
          setIsDragging(false);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setIsDragging(false);
        }}
        onTouchStart={(event) => {
          if (event.touches.length === 1) {
            const touch = event.touches[0];
            touchRef.current = {
              mode: 'pan',
              startDistance: 0,
              startScale: scale,
              startX: touch.clientX,
              startY: touch.clientY,
              ox: offset.x,
              oy: offset.y
            };
            setIsDragging(true);
            return;
          }

          if (event.touches.length === 2) {
            const first = event.touches[0];
            const second = event.touches[1];
            touchRef.current = {
              mode: 'pinch',
              startDistance: getDistance(first, second),
              startScale: scale,
              startX: (first.clientX + second.clientX) / 2,
              startY: (first.clientY + second.clientY) / 2,
              ox: offset.x,
              oy: offset.y
            };
            setIsDragging(true);
          }
        }}
        onTouchMove={(event) => {
          const active = touchRef.current;
          if (!active) return;

          event.preventDefault();

          if (active.mode === 'pan' && event.touches.length === 1) {
            const touch = event.touches[0];
            const deltaX = touch.clientX - active.startX;
            const deltaY = touch.clientY - active.startY;

            if (safePhotos.length > 1 && scale <= 1.02 && Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) + 10) {
              if (deltaX < 0) {
                showNext();
              } else {
                showPrevious();
              }
              touchRef.current = null;
              setIsDragging(false);
              return;
            }

            setOffset(clampOffset(
              active.ox + deltaX,
              active.oy + deltaY,
              scale
            ));
            return;
          }

          if (active.mode === 'pinch' && event.touches.length === 2) {
            const first = event.touches[0];
            const second = event.touches[1];
            const distance = getDistance(first, second);
            const ratio = active.startDistance > 0 ? distance / active.startDistance : 1;
            const nextScale = clamp(active.startScale * ratio, 1, 4);
            setScale(nextScale);
            setOffset((prev) => clampOffset(prev.x, prev.y, nextScale));
          }
        }}
        onTouchEnd={(event) => {
          if (event.touches.length === 0) {
            touchRef.current = null;
            setIsDragging(false);
            return;
          }

          if (event.touches.length === 1) {
            const touch = event.touches[0];
            touchRef.current = {
              mode: 'pan',
              startDistance: 0,
              startScale: scale,
              startX: touch.clientX,
              startY: touch.clientY,
              ox: offset.x,
              oy: offset.y
            };
          }
        }}
      >
        <img
          src={activePhoto.url}
          alt="Photo"
          className="absolute inset-0 h-full w-full object-cover select-none"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          draggable={false}
        />
      </div>

      {showDate && (
        <div className="absolute top-2 left-2 rounded-md bg-black/60 text-white text-[11px] px-2 py-1">
          {formatUploadedAt(activePhoto.uploadedAt)}
        </div>
      )}

      {primaryPhotoId === activePhoto.id && (
        <div className="absolute top-2 right-2 rounded-md bg-amber-500/90 text-white text-[11px] px-2 py-1 inline-flex items-center gap-1">
          <Star size={11} fill="currentColor" />
          Cover
        </div>
      )}

      {safePhotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 text-white p-1.5"
            aria-label="Previous photo"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 text-white p-1.5"
            aria-label="Next photo"
          >
            <ChevronRight size={14} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 text-white text-[11px] px-2 py-0.5">
            {index + 1}/{safePhotos.length}
          </div>
        </>
      )}

      {editable && (
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          {onPrimaryChange && primaryPhotoId !== activePhoto.id && (
            <button
              type="button"
              onClick={() => onPrimaryChange(activePhoto.id)}
              className="rounded-lg bg-white/90 text-gray-800 px-2 py-1 text-xs font-semibold"
            >
              Set cover
            </button>
          )}
          {onRemovePhoto && (
            <button
              type="button"
              onClick={() => onRemovePhoto(activePhoto.id)}
              className="rounded-lg bg-red-500/90 text-white p-1.5"
              aria-label="Remove photo"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
