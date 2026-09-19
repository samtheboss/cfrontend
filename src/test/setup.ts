import "@testing-library/jest-dom";

// This jsdom setup doesn't expose a working Storage on `window` (and newer Node versions
// ship their own experimental global `localStorage`/`sessionStorage` that's unusable
// without --localstorage-file), so both `window.localStorage`/`sessionStorage` and the
// bare globals used throughout the app's source can end up undefined. Install a minimal
// in-memory polyfill everywhere they'd be looked up.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  const storage = new MemoryStorage();
  Object.defineProperty(window, name, { configurable: true, value: storage });
  Object.defineProperty(globalThis, name, { configurable: true, value: storage });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
