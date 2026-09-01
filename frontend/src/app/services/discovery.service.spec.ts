import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { DiscoveryService } from './discovery.service';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { ChatService } from './chat.service';
import { UserService } from './user.service';
import { OfflineDiscoveryCacheService } from './offline-discovery-cache.service';

describe('DiscoveryService offline privacy boundary', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('returns no profiles without contacting or reading the API while offline', async () => {
    const get = vi.fn();
    const getCachedSearchResults = vi.fn();
    const getAllCachedPartners = vi.fn();

    await TestBed.configureTestingModule({
      providers: [
        DiscoveryService,
        { provide: HttpClient, useValue: { get } },
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn(), currentUser: signal(null) },
        },
        {
          provide: SafetyService,
          useValue: { getBlockedAndBlockerIdsStrict: vi.fn() },
        },
        { provide: ChatService, useValue: {} },
        { provide: UserService, useValue: {} },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: {
            isOnline: signal(false),
            getCachedSearchResults,
            getAllCachedPartners,
          },
        },
      ],
    }).compileComponents();

    const service = TestBed.inject(DiscoveryService);
    await expect(service.findPartners({})).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
    expect(getCachedSearchResults).not.toHaveBeenCalled();
    expect(getAllCachedPartners).not.toHaveBeenCalled();
  });

  it('returns no profiles when the partners API fails online', async () => {
    const get = vi.fn(() => throwError(() => new Error('service unavailable')));

    await TestBed.configureTestingModule({
      providers: [
        DiscoveryService,
        { provide: HttpClient, useValue: { get } },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: vi.fn(() => 'token'),
            currentUser: signal({ id: 'viewer-1' }),
          },
        },
        {
          provide: SafetyService,
          useValue: { getBlockedAndBlockerIdsStrict: vi.fn() },
        },
        { provide: ChatService, useValue: {} },
        { provide: UserService, useValue: {} },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: { isOnline: signal(true) },
        },
      ],
    }).compileComponents();

    const service = TestBed.inject(DiscoveryService);
    await expect(service.findPartners({})).resolves.toEqual([]);
  });

  it('returns no profiles when the client block graph cannot be verified', async () => {
    const get = vi.fn(() => of([{ id: 'partner-1' }]));
    const getBlockedAndBlockerIdsStrict = vi.fn(() =>
      Promise.reject(new Error('block graph unavailable')),
    );

    await TestBed.configureTestingModule({
      providers: [
        DiscoveryService,
        { provide: HttpClient, useValue: { get } },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: vi.fn(() => 'token'),
            currentUser: signal({ id: 'viewer-1' }),
          },
        },
        {
          provide: SafetyService,
          useValue: { getBlockedAndBlockerIdsStrict },
        },
        { provide: ChatService, useValue: {} },
        { provide: UserService, useValue: {} },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: { isOnline: signal(true) },
        },
      ],
    }).compileComponents();

    const service = TestBed.inject(DiscoveryService);
    await expect(service.findPartners({})).resolves.toEqual([]);
    expect(getBlockedAndBlockerIdsStrict).toHaveBeenCalledWith('viewer-1');
  });
});
