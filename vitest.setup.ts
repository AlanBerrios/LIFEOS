/**
 * vitest.setup.ts
 * Global setup for vitest - defines required globals for Expo and other packages
 */

// Define __DEV__ globally for Expo compatibility
Object.defineProperty(globalThis, '__DEV__', {
  value: true,
  writable: true,
  configurable: true
});

// Mock console methods if needed
if (typeof globalThis.console === 'undefined') {
  globalThis.console = {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
    debug: () => {}
  } as any;
}
