"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface QueueItem {
  id: string;
  url: string;
  method: string;
  body: unknown;
  addedAt: number;
}

export interface EnqueueResult {
  ok: boolean;
  data?: unknown;
  queued?: boolean;
  error?: string;
}

const KEY_PREFIX = "sh-offline-queue-";

export function useOfflineQueue(gameId: string) {
  const storageKey = `${KEY_PREFIX}${gameId}`;

  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== "undefined" ? window.navigator.onLine : true
  );
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]"); }
    catch { return []; }
  });
  const [syncing,   setSyncing]   = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const processing = useRef(false);

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(storageKey, JSON.stringify(queue)); }
    catch { /* storage full — ignore */ }
  }, [queue, storageKey]);

  // Online / offline events
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline  = () => { setIsOnline(true);  setSyncError(null); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Flush queue sequentially — called when online and items pending
  const flushQueue = useCallback(async (pending: QueueItem[]) => {
    if (processing.current || pending.length === 0) return;
    processing.current = true;
    setSyncing(true);
    setSyncError(null);

    const remaining = [...pending];
    while (remaining.length > 0) {
      const item = remaining[0];
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
        if (res.ok) {
          remaining.shift(); // success — remove from queue
          continue;
        }
        const err = await res.json().catch(() => ({}));
        if (res.status >= 400 && res.status < 500) {
          // Client error (validation) — drop item, show message, continue
          remaining.shift();
          setSyncError(err.error ?? "A queued action was rejected by the server");
          continue;
        }
        // Server error — stop, will retry when online again
        setSyncError(err.error ?? "Server error during sync — will retry");
        break;
      } catch {
        // Network error — stop processing
        break;
      }
    }

    setQueue(remaining);
    setSyncing(false);
    processing.current = false;
  }, []);

  // Trigger flush when coming online or queue gains items while online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !processing.current) {
      flushQueue(queue);
    }
  }, [isOnline, queue, flushQueue]);

  /**
   * Enqueue an action. If online with no pending items, attempt immediately.
   * Otherwise buffer in localStorage for later sync.
   * Returns { ok, data } on immediate success or { ok, queued } when buffered.
   */
  const enqueue = useCallback(async (
    url: string,
    method: string,
    body: unknown,
  ): Promise<EnqueueResult> => {
    // Attempt immediately if online and queue is empty
    if (isOnline && queue.length === 0 && !processing.current) {
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          return { ok: true, data };
        }
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error ?? "Request failed" };
      } catch {
        // Network error — fall through to queue
      }
    }

    // Buffer action
    const item: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url, method, body,
      addedAt: Date.now(),
    };
    setQueue(prev => [...prev, item]);
    return { ok: true, queued: true };
  }, [isOnline, queue]);

  return {
    isOnline,
    queueLength: queue.length,
    syncing,
    syncError,
    clearSyncError: () => setSyncError(null),
    enqueue,
  };
}
