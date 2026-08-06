<<<<<<< HEAD
import { toastsSignal, showToast, showErrorToast, notImplementedToast, removeToast } from './toast.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ToastService Functions', () => {
  beforeEach(() => {
    // Reset the signal before each test
    toastsSignal.set([]);
    vi.useFakeTimers();
=======
import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  showToast,
  showErrorToast,
  notImplementedToast,
  removeToast,
  toastsSignal
} from './toast.service';

describe('ToastService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
    // Reset signal state before each test
    toastsSignal.set([]);
>>>>>>> origin/main
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('showToast', () => {
<<<<<<< HEAD
    it('should add a toast with default info type', () => {
      showToast('Test message');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Test message');
=======
    it('should add an info toast by default', () => {
      showToast('Test info message');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Test info message');
>>>>>>> origin/main
      expect(toasts[0].type).toBe('info');
      expect(typeof toasts[0].id).toBe('number');
    });

<<<<<<< HEAD
    it('should add a toast with specific type and automatically remove it after durationMs', () => {
      showToast('Success!', 'success', 2000);
      let toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Success!');
      expect(toasts[0].type).toBe('success');

      // Advance time by less than duration
      vi.advanceTimersByTime(1000);
      expect(toastsSignal().length).toBe(1);

      // Advance time past the duration
      vi.advanceTimersByTime(1000);
=======
    it('should add a toast of specified type', () => {
      showToast('Test success message', 'success');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Test success message');
      expect(toasts[0].type).toBe('success');
    });

    it('should automatically remove the toast after default duration (3000ms)', () => {
      showToast('Test message');
      expect(toastsSignal().length).toBe(1);

      vi.advanceTimersByTime(2999);
      expect(toastsSignal().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(toastsSignal().length).toBe(0);
    });

    it('should automatically remove the toast after custom duration', () => {
      showToast('Test message', 'info', 1000);
      expect(toastsSignal().length).toBe(1);

      vi.advanceTimersByTime(999);
      expect(toastsSignal().length).toBe(1);

      vi.advanceTimersByTime(1);
>>>>>>> origin/main
      expect(toastsSignal().length).toBe(0);
    });
  });

  describe('showErrorToast', () => {
    it('should add an error toast with default 5000ms duration', () => {
<<<<<<< HEAD
      showErrorToast('Error occurred');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Error occurred');
=======
      showErrorToast('Error message');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Error message');
>>>>>>> origin/main
      expect(toasts[0].type).toBe('error');

      vi.advanceTimersByTime(4999);
      expect(toastsSignal().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(toastsSignal().length).toBe(0);
    });

<<<<<<< HEAD
    it('should accept custom duration', () => {
      showErrorToast('Error occurred', 1000);

      vi.advanceTimersByTime(1000);
=======
    it('should add an error toast with custom duration', () => {
      showErrorToast('Error message', 2000);
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);

      vi.advanceTimersByTime(1999);
      expect(toastsSignal().length).toBe(1);

      vi.advanceTimersByTime(1);
>>>>>>> origin/main
      expect(toastsSignal().length).toBe(0);
    });
  });

  describe('notImplementedToast', () => {
<<<<<<< HEAD
    it('should show generic message when no featureName provided', () => {
=======
    it('should display generic not implemented message if no feature name is provided', () => {
>>>>>>> origin/main
      notImplementedToast();
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Not implemented yet');
      expect(toasts[0].type).toBe('info');
    });

<<<<<<< HEAD
    it('should show feature specific message', () => {
=======
    it('should display feature specific not implemented message if feature name is provided', () => {
>>>>>>> origin/main
      notImplementedToast('Settings');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Settings is not implemented yet');
      expect(toasts[0].type).toBe('info');
    });
  });

  describe('removeToast', () => {
<<<<<<< HEAD
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
=======
    it('should remove a specific toast by id', () => {
      showToast('Message 1');
      showToast('Message 2');

      const toasts = toastsSignal();
      expect(toasts.length).toBe(2);

      const idToRemove = toasts[0].id;
      const idToKeep = toasts[1].id;

      removeToast(idToRemove);

      const updatedToasts = toastsSignal();
      expect(updatedToasts.length).toBe(1);
      expect(updatedToasts[0].id).toBe(idToKeep);
    });

    it('should not do anything if toast id is not found', () => {
      showToast('Message');
      const toasts = toastsSignal();
      expect(toasts.length).toBe(1);

      removeToast(999); // Invalid ID

      expect(toastsSignal().length).toBe(1);
>>>>>>> origin/main
    });
  });
});
