import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface SavedContent {
  id: string;
  user_id: string;
  item_type: string;
  item_payload: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class SavedContentService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly dbName = 'hellotalk_offline';
  private readonly storeName = 'saved_content';

  /**
   * Opens (or creates) the IndexedDB database used for offline caching.
   */
  private async openDb(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Reads all cached saved‑content items from IndexedDB.
   */
  private async getCached(): Promise<SavedContent[]> {
    const db = await this.openDb();
    return new Promise<SavedContent[]>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const result: SavedContent[] = request.result ?? [];
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Persists the supplied items into the local IndexedDB cache.
   */
  private async setCache(items: SavedContent[]): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Fetches the user’s saved content from the API.
   * If the request fails because the device is offline, cached data is returned
   * as a fallback. Authorisation errors are re‑thrown.
   */
  async getSavedContent(): Promise<SavedContent[]> {
    const token = this.authService.getAccessToken();
    if (!token) {
      // No token → cannot contact API; fall back to cache immediately
      return this.getCached();
    }
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const items = await firstValueFrom(
        this.http.get<SavedContent[]>(`${environment.apiUrl}/favourites`, {
          headers,
        }),
      );
      // Cache the response for offline use
      this.setCache(items).catch(() => {});
      return items;
    } catch (err: unknown) {
      // If the network is unavailable, serve cached data
      if (!navigator.onLine) {
        return this.getCached();
      }
      // For any other error (e.g. 401) we re‑throw it
      throw err;
    }
  }

  /**
   * Removes all locally cached saved‑content items.
   */
  async clearCache(): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
