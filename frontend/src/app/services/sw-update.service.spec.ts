import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SwUpdateService } from './sw-update.service';

describe('SwUpdateService', () => {
  let service: SwUpdateService;
  let versionUpdatesSubject: Subject<unknown>;
  let unrecoverableSubject: Subject<unknown>;
  let mockSwUpdate: { isEnabled: boolean; versionUpdates: Subject<unknown>; unrecoverable: Subject<unknown>; checkForUpdate: ReturnType<typeof vi.fn>; activateUpdate: ReturnType<typeof vi.fn> };
  let mockAppRef: { isStable: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();

    versionUpdatesSubject = new Subject();
    unrecoverableSubject = new Subject();

    mockSwUpdate = {
      isEnabled: true,
      versionUpdates: versionUpdatesSubject,
      unrecoverable: unrecoverableSubject,
      checkForUpdate: vi.fn().mockResolvedValue(false),
      activateUpdate: vi.fn().mockResolvedValue(undefined),
    };

    mockAppRef = {
      isStable: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SwUpdateService,
        { provide: SwUpdate, useValue: mockSwUpdate },
        { provide: ApplicationRef, useValue: mockAppRef },
      ],
    });

    service = TestBed.inject(SwUpdateService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set updateAvailable signal on VERSION_READY event', () => {
    expect(service.updateAvailable()).toBe(false);

    service.initialise();

    const event: VersionReadyEvent = {
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc123' },
      latestVersion: { hash: 'def456' },
    };
    versionUpdatesSubject.next(event);

    expect(service.updateAvailable()).toBe(true);
  });

  it('should not react to non-VERSION_READY events', () => {
    service.initialise();
    versionUpdatesSubject.next({ type: 'NO_NEW_VERSION_DETECTED' });

    expect(service.updateAvailable()).toBe(false);
  });

  it('subscribes to the service worker streams once however often initialise is called', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const event: VersionReadyEvent = {
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc123' },
      latestVersion: { hash: 'def456' },
    };

    service.initialise();
    service.initialise();
    service.initialise();
    versionUpdatesSubject.next(event);

    expect(versionUpdatesSubject.observers).toHaveLength(1);
    expect(unrecoverableSubject.observers).toHaveLength(1);
    expect(warn).toHaveBeenCalledOnce();
    expect(mockSwUpdate.checkForUpdate).toHaveBeenCalledOnce();
  });

  it('does not subscribe at all while the service worker is disabled', () => {
    mockSwUpdate.isEnabled = false;

    service.initialise();

    expect(versionUpdatesSubject.observers).toHaveLength(0);
    expect(unrecoverableSubject.observers).toHaveLength(0);
  });

  it('releases both subscriptions when the injector is destroyed', () => {
    service.initialise();
    expect(versionUpdatesSubject.observers).toHaveLength(1);

    TestBed.resetTestingModule();

    expect(versionUpdatesSubject.observers).toHaveLength(0);
    expect(unrecoverableSubject.observers).toHaveLength(0);
  });

  it('should reload on unrecoverable event', () => {
    service.initialise();
    unrecoverableSubject.next({ reason: 'SW state corrupted' });

    expect(service.updateAvailable()).toBe(false);
  });

  it('should check for updates and update signal when found', async () => {
    mockSwUpdate.checkForUpdate.mockResolvedValue(true);
    expect(service.updateAvailable()).toBe(false);

    const result = await service.checkForUpdate();
    expect(result).toBe(true);
    expect(service.updateAvailable()).toBe(true);
  });

  it('should return false when update check fails', async () => {
    mockSwUpdate.checkForUpdate.mockRejectedValue(new Error('Network error'));
    const result = await service.checkForUpdate();
    expect(result).toBe(false);
  });

  it('should activate update and set updateActivated signal', async () => {
    mockSwUpdate.activateUpdate.mockResolvedValue(undefined);
    expect(service.updateActivated()).toBe(false);

    await service.activateUpdate();
    expect(service.updateActivated()).toBe(true);
  });

  it('should not proceed when service worker is disabled', async () => {
    mockSwUpdate.isEnabled = false;

    const result = await service.checkForUpdate();
    expect(result).toBe(false);
    expect(mockSwUpdate.checkForUpdate).not.toHaveBeenCalled();
  });

  it('should not call activateUpdate when SW is disabled', async () => {
    mockSwUpdate.isEnabled = false;

    await service.activateUpdate();
    expect(mockSwUpdate.activateUpdate).not.toHaveBeenCalled();
  });
});