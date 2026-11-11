import { type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { interval, map, of, startWith, switchMap } from 'rxjs';

/** How often the elapsed counter re-reads the wall clock while active. */
export const ELAPSED_TICK_MS = 1000;

/**
 * Whole seconds since `active` last became true: it ticks once per second while `active` stays
 * true and resets to 0 as soon as it turns false.
 *
 * This replaces hand-managed `interval(...).subscribe(...)` handles. The timer is a `toSignal`
 * subscription owned by the calling injection context, so it is torn down with that component or
 * service and can never be started after it has been destroyed. Elapsed time is read from the wall
 * clock instead of counting ticks, so a throttled background timer does not under-report a call.
 *
 * Call it from an injection context (a field initialiser or a constructor).
 */
export function elapsedSeconds(active: Signal<boolean>): Signal<number> {
  return toSignal(
    toObservable(active).pipe(
      switchMap((isActive) => {
        if (!isActive) return of(0);
        const startedAt = Date.now();
        return interval(ELAPSED_TICK_MS).pipe(
          startWith(0),
          map(() => Math.floor((Date.now() - startedAt) / 1000)),
        );
      }),
    ),
    { initialValue: 0 },
  );
}

/** Formats whole seconds as `mm:ss`; the minutes keep growing past 99 rather than wrapping. */
export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
