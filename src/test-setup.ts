// JSDOM does not implement ResizeObserver. Spartan Brain uses it only after
// rendering to keep connected overlays sized; this no-op keeps unit tests
// deterministic without affecting browser or SSR production behavior.
class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as typeof globalThis & { ResizeObserver: typeof TestResizeObserver }).ResizeObserver = TestResizeObserver;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

// Some non-LTS Node releases expose an incomplete localStorage object unless
// a backing file is configured. Tests need the browser Storage contract, not
// that partial Node implementation.
if (typeof globalThis.localStorage?.getItem !== 'function') {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
}
