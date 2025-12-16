import '@testing-library/jest-dom'

// JSDOM environment polyfills/stubs for UI libraries (Radix, etc.)
if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
  }

  if (!window.matchMedia) {
    (window as unknown as { matchMedia: () => MediaQueryList }).matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  }

  // Always stub scrollTo in JSDOM (the default throws Not Implemented)
  window.scrollTo = (() => {}) as typeof window.scrollTo
}
