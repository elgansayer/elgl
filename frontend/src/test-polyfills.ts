import 'fake-indexeddb/auto';

// jsdom does not provide the Audio constructor, which is used by several
// components and services. Provide a minimal stub so tests don't throw.
if (typeof globalThis.Audio === 'undefined') {
  (globalThis as Record<string, unknown>).Audio = class Audio {
    src = '';
    currentTime = 0;
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
    addEventListener(_event: string, _cb: () => void) {}
    removeEventListener(_event: string, _cb: () => void) {}
  };
}