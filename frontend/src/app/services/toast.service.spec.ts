import { toastsSignal, showToast, showErrorToast, notImplementedToast, removeToast } from './toast.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ToastService Functions', () => {
  beforeEach(() => {
    // Reset the signal before each test
    toastsSignal.set([]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('showToast', () => {
    it('should add a toast with default info type', () => {
      showToast('Test message');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('info');
      expect(typeof toasts[0].id).toBe('number');
    });

    it('should add a toast with specific type and automatically remove it after durationMs', () => {
      showToast('Success!', 'success', 2000);
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Success!');
      expect(toasts[0].type).toBe('success');

      // Advance time by less than duration
      vi.advanceTimersByTime(1000);
      expect(toastsSignal().length).toBe(1);

      // Advance time past the duration
      vi.advanceTimersByTime(1000);
      expect(toastsSignal().length).toBe(0);
    });
  });

  describe('showErrorToast', () => {
    it('should add an error toast with default 5000ms duration', () => {
      showErrorToast('Error occurred');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Error occurred');
      expect(toasts[0].type).toBe('error');

      vi.advanceTimersByTime(4999);
      expect(toastsSignal().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(toastsSignal().length).toBe(0);
    });

    it('should accept custom duration', () => {
      showErrorToast('Error occurred', 1000);

      vi.advanceTimersByTime(1000);
      expect(toastsSignal().length).toBe(0);
    });
  });

  describe('notImplementedToast', () => {
    it('should show generic message when no featureName provided', () => {
      notImplementedToast();
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Not implemented yet');
      expect(toasts[0].type).toBe('info');
    });

    it('should show feature specific message', () => {
      notImplementedToast('Settings');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Settings is not implemented yet');
      expect(toasts[0].type).toBe('info');
    });
  });

  describe('removeToast', () => {
    it('should remove specific toast by id without affecting others', () => {
      showToast('First');
      showToast('Second');
      showToast('Third');

      const toasts = toastsSignal();
      expect(toasts.length).toBe(3);
      const secondId = toasts[1].id;

      removeToast(secondId);

      const updatedToasts = toastsSignal();
      expect(updatedToasts.length).toBe(2);
      expect(updatedToasts[0].message).toBe('First');
      expect(updatedToasts[1].message).toBe('Third');
    });
  });
});
