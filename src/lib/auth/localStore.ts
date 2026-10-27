/**
 * A tiny localStorage-backed store that works with `useSyncExternalStore`:
 * it returns the same object until the stored value really changes, notifies subscribers
 * on writes (including from other tabs), and falls back to memory if storage is unavailable.
 */
export function createLocalStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let memoryRaw: string | null = null;
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  const readRaw = (): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryRaw;
    }
  };

  const notify = () => listeners.forEach((l) => l());

  return {
    /** Current value (stable between changes). */
    read(): T {
      const raw = readRaw();
      if (raw === cachedRaw) return cachedValue;
      cachedRaw = raw;
      try {
        cachedValue = raw === null ? fallback : (JSON.parse(raw) as T);
      } catch {
        cachedValue = fallback;
      }
      return cachedValue;
    },
    /** Saves a value; `null` removes the entry. */
    write(value: T | null) {
      const raw = value === null ? null : JSON.stringify(value);
      memoryRaw = raw;
      try {
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch {
        // Storage blocked (e.g. private mode): the in-memory copy keeps this tab working.
      }
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
