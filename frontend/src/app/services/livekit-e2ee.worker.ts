// Local entry point for the LiveKit end-to-end encryption worker.
// `new URL(specifier, import.meta.url)` cannot resolve a bare package specifier such as
// 'livekit-client/e2ee-worker', so the worker is re-exported from a file inside src/ and
// referenced by relative URL instead. See livekit.service.ts.
import 'livekit-client/e2ee-worker';
