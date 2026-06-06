const DB_NAME = 'SoboiteImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

const openImageCacheDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getCachedImageBlob = async (key: string): Promise<Blob | null> => {
  if (!key) return null;
  try {
    const db = await openImageCacheDB();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result instanceof Blob ? result : null);
      };

      request.onerror = () => {
        console.error('Image cache read failed:', request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Image cache read failed:', error);
    return null;
  }
};

export const setCachedImageBlob = async (key: string, blob: Blob): Promise<void> => {
  if (!key || !blob) return;
  try {
    const db = await openImageCacheDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(blob, key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Image cache write failed:', request.error);
        resolve();
      };
    });
  } catch (error) {
    console.error('Image cache write failed:', error);
  }
};

const ongoingLoadPromises = new Map<string, Promise<Blob | null>>();

export const loadCachedImageBlob = async (url: string): Promise<Blob | null> => {
  if (!url) return null;
  if (ongoingLoadPromises.has(url)) {
    return ongoingLoadPromises.get(url)!;
  }

  const promise = (async () => {
    const cached = await getCachedImageBlob(url);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      await setCachedImageBlob(url, blob);
      return blob;
    } catch (error) {
      console.error('Image fetch failed:', error);
      return null;
    }
  })();

  ongoingLoadPromises.set(url, promise);
  try {
    return await promise;
  } finally {
    ongoingLoadPromises.delete(url);
  }
};

export const prefetchCachedImages = async (urls: Array<string | undefined | null>): Promise<void> => {
  const uniqueUrls = Array.from(
    new Set(
      urls
        .filter((value): value is string => Boolean(value))
        .filter((url) => !url.startsWith('data:') && !url.startsWith('blob:'))
    )
  );

  await Promise.all(uniqueUrls.map(async (url) => {
    try {
      await loadCachedImageBlob(url);
    } catch (error) {
      console.error('Prefetch failed for image URL:', url, error);
    }
  }));
};
