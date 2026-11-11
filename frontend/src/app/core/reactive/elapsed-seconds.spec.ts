import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ELAPSED_TICK_MS, elapsedSeconds, formatClock } from './elapsed-seconds';

describe('elapsedSeconds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  function create(initiallyActive = false) {
    const active = signal(initiallyActive);
    const seconds = TestBed.runInInjectionContext(() => elapsedSeconds(active));
    TestBed.tick();
    return { active, seconds };
  }

  it('stays at zero and schedules no timer while inactive', () => {
    const { seconds } = create();

    vi.advanceTimersByTime(10 * ELAPSED_TICK_MS);

    expect(seconds()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts whole seconds while active', () => {
    const { active, seconds } = create();

    active.set(true);
    TestBed.tick();
    expect(seconds()).toBe(0);

    vi.advanceTimersByTime(3 * ELAPSED_TICK_MS);
    expect(seconds()).toBe(3);
  });

  it('starts counting immediately when it is created already active', () => {
    const { seconds } = create(true);

    vi.advanceTimersByTime(2 * ELAPSED_TICK_MS);

    expect(seconds()).toBe(2);
  });

  it('reads the wall clock so a throttled timer does not under-report the duration', () => {
    const { active, seconds } = create();
    active.set(true);
    TestBed.tick();

    // A backgrounded tab can skip ticks; the next tick must catch up to real elapsed time.
    vi.setSystemTime(Date.now() + 120_000);
    vi.advanceTimersByTime(ELAPSED_TICK_MS);

    expect(seconds()).toBe(121);
  });

  it('resets to zero and clears the timer when it turns inactive', () => {
    const { active, seconds } = create(true);
    vi.advanceTimersByTime(4 * ELAPSED_TICK_MS);
    expect(seconds()).toBe(4);

    active.set(false);
    TestBed.tick();

    expect(seconds()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts from zero when it becomes active again', () => {
    const { active, seconds } = create(true);
    vi.advanceTimersByTime(5 * ELAPSED_TICK_MS);
    active.set(false);
    TestBed.tick();

    active.set(true);
    TestBed.tick();
    vi.advanceTimersByTime(ELAPSED_TICK_MS);

    expect(seconds()).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('never leaves more than one timer running across repeated toggles', () => {
    const { active } = create();

    for (let toggle = 0; toggle < 5; toggle += 1) {
      active.set(true);
      TestBed.tick();
      active.set(false);
      TestBed.tick();
    }
    active.set(true);
    TestBed.tick();

    expect(vi.getTimerCount()).toBe(1);
  });

  it('releases its timer when the owning injector is destroyed', () => {
    const { seconds } = create(true);
    vi.advanceTimersByTime(ELAPSED_TICK_MS);
    expect(seconds()).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [5, '00:05'],
    [65, '01:05'],
    [3599, '59:59'],
    [6000, '100:00'],
  ])('formats %i seconds as %s', (totalSeconds, expected) => {
    expect(formatClock(totalSeconds)).toBe(expected);
  });

  it('floors fractions and clamps negative values to zero', () => {
    expect(formatClock(61.9)).toBe('01:01');
    expect(formatClock(-3)).toBe('00:00');
  });
});
