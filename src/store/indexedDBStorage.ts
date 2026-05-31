import { StateStorage } from 'zustand/middleware';

export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('SoboiteDB', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction('store', 'readonly');
          const store = tx.objectStore('store');
          const getReq = store.get(name);

          getReq.onsuccess = () => {
            const data = getReq.result;
            resolve(data ? JSON.stringify(data) : null);
          };

          getReq.onerror = () => {
            console.error('Error reading from IndexedDB:', getReq.error);
            resolve(null);
          };
        } catch (e) {
          console.error('IndexedDB transaction failed:', e);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        resolve(null);
      };
    });
  },

  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      const parsedValue = JSON.parse(value);
      const request = indexedDB.open('SoboiteDB', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction('store', 'readwrite');
          const store = tx.objectStore('store');
          store.put(parsedValue, name);

          tx.oncomplete = () => {
            resolve();
          };

          tx.onerror = () => {
            console.error('Error writing to IndexedDB:', tx.error);
            resolve();
          };
        } catch (e) {
          console.error('IndexedDB write transaction failed:', e);
          resolve();
        }
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB for write:', request.error);
        resolve();
      };
    });
  },

  removeItem: async (name: string): Promise<void> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('SoboiteDB', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction('store', 'readwrite');
          const store = tx.objectStore('store');
          store.delete(name);

          tx.oncomplete = () => {
            resolve();
          };

          tx.onerror = () => {
            console.error('Error removing from IndexedDB:', tx.error);
            resolve();
          };
        } catch (e) {
          console.error('IndexedDB delete transaction failed:', e);
          resolve();
        }
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB for delete:', request.error);
        resolve();
      };
    });
  }
};
