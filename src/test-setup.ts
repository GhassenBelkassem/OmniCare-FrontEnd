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
