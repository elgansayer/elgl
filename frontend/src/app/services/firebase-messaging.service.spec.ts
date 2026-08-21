import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FirebaseMessagingService } from './firebase-messaging.service';

describe('FirebaseMessagingService', () => {
  let service: FirebaseMessagingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FirebaseMessagingService],
    });
    service = TestBed.inject(FirebaseMessagingService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise fcmToken and permissionGranted signals to null/false', () => {
    expect(service.fcmToken()).toBeNull();
    expect(service.permissionGranted()).toBeFalsy();
  });

  it('should not change signals when requestPermissionAndGetToken runs (stub)', async () => {
    await service.requestPermissionAndGetToken();
    expect(service.fcmToken()).toBeNull();
    expect(service.permissionGranted()).toBeFalsy();
  });

  it('should resolve persistFcmToken without calling backend (stub)', async () => {
    await expect(service.persistFcmToken('user-123')).resolves.toBeUndefined();
    expect(service.fcmToken()).toBeNull();
  });

  it('should be SSR-safe when window is undefined', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', undefined);

    const ssrService = new FirebaseMessagingService();
    expect(ssrService.fcmToken()).toBeNull();
    expect(ssrService.permissionGranted()).toBeFalsy();

    await expect(ssrService.requestPermissionAndGetToken()).resolves.toBeUndefined();
    await expect(ssrService.persistFcmToken('user-ssr')).resolves.toBeUndefined();
  });

  it('should remain stable across multiple calls to requestPermissionAndGetToken (stub)', async () => {
    await service.requestPermissionAndGetToken();
    await service.requestPermissionAndGetToken();
    expect(service.fcmToken()).toBeNull();
    expect(service.permissionGranted()).toBeFalsy();
  });

  it('should handle missing navigator gracefully', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', undefined);

    const browserLikeService = new FirebaseMessagingService();
    expect(browserLikeService.fcmToken()).toBeNull();
    expect(browserLikeService.permissionGranted()).toBe(false);

    await expect(browserLikeService.requestPermissionAndGetToken()).resolves.toBeUndefined();
    await expect(browserLikeService.persistFcmToken('user-missing-nav')).resolves.toBeUndefined();
  });

  it('should handle missing navigator.serviceWorker gracefully', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});

    const partialService = new FirebaseMessagingService();
    expect(partialService.fcmToken()).toBeNull();
    expect(partialService.permissionGranted()).toBe(false);

    await expect(partialService.requestPermissionAndGetToken()).resolves.toBeUndefined();
    await expect(partialService.persistFcmToken('user-no-sw')).resolves.toBeUndefined();
  });
});
