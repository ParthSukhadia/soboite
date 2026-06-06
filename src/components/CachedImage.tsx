import { useEffect, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { loadCachedImageBlob } from '../lib/imageCache';

const objectUrlCache = new Map<string, { url: string; count: number }>();

const getCachedObjectUrl = (source: string) => objectUrlCache.get(source)?.url;
const retainCachedObjectUrl = (source: string, url: string) => {
  const entry = objectUrlCache.get(source);
  if (entry) {
    entry.count += 1;
  } else {
    objectUrlCache.set(source, { url, count: 1 });
  }
};
const releaseCachedObjectUrl = (source: string) => {
  const entry = objectUrlCache.get(source);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count <= 0) {
    URL.revokeObjectURL(entry.url);
    objectUrlCache.delete(source);
  }
};

interface CachedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  fallbackSrc?: string;
}

export default function CachedImage({ src, fallbackSrc, onError, ...props }: CachedImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src || fallbackSrc);

  useEffect(() => {
    let active = true;
    let createdObjectUrl: string | null = null;

    if (!src) {
      setCurrentSrc(fallbackSrc);
      return;
    }

    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setCurrentSrc(src);
      return;
    }

    const existingObjectUrl = getCachedObjectUrl(src);
    if (existingObjectUrl) {
      retainCachedObjectUrl(src, existingObjectUrl);
      setCurrentSrc(existingObjectUrl);
      return () => {
        releaseCachedObjectUrl(src);
      };
    }

    setCurrentSrc(src);

    loadCachedImageBlob(src)
      .then((blob) => {
        if (!active || !blob) return;
        createdObjectUrl = URL.createObjectURL(blob);
        retainCachedObjectUrl(src, createdObjectUrl);
        setCurrentSrc(createdObjectUrl);
      })
      .catch(() => {
        if (!active) return;
        setCurrentSrc(src);
      });

    return () => {
      active = false;
      if (createdObjectUrl) {
        releaseCachedObjectUrl(src);
      }
    };
  }, [src, fallbackSrc]);

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (currentSrc !== src) {
      setCurrentSrc(src || fallbackSrc);
    }
    if (onError) {
      onError(event);
    }
  };

  return (
    <img
      src={currentSrc || fallbackSrc}
      onError={handleError}
      {...props}
    />
  );
}
