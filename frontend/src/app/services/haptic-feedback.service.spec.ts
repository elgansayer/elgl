import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticFeedbackService } from './haptic-feedback.service';

describe('HapticFeedbackService', () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });
  });

  it('preserves the existing enabled default when no preference has been stored', () => {
    const service = new HapticFeedbackService();

    expect(service.isEnabled()).toBe(true);
  });

  it('persists an opt-out and suppresses vibration', () => {
    const service = new HapticFeedbackService();

    service.setEnabled(false);
    service.trigger('selection');

    expect(localStorage.getItem('app_vibration_enabled')).toBe('false');
    expect(service.isEnabled()).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('restores a persisted opt-out before any haptic can fire', () => {
    localStorage.setItem('app_vibration_enabled', 'false');

    const service = new HapticFeedbackService();
    service.trigger('medium');

    expect(service.isEnabled()).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it.each([
    ['light', 10],
    ['medium', 20],
    ['heavy', 40],
    ['selection', [5, 10, 5]],
  ] as const)('maps %s feedback to the expected vibration pattern', (intensity, expected) => {
    const service = new HapticFeedbackService();

    service.trigger(intensity);

    expect(vibrate).toHaveBeenCalledWith(expected);
  });

  it('never lets a vibration API failure escape to the grading action', () => {
    vibrate.mockImplementation(() => {
      throw new Error('vibration unavailable');
    });
    const service = new HapticFeedbackService();

    expect(() => service.trigger('selection')).not.toThrow();
  });
});
