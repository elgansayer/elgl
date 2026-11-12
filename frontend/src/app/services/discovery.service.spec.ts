import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defer, of, throwError } from 'rxjs';

import { DiscoverySearchFailureKind, DiscoveryService } from './discovery.service';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { ChatService } from './chat.service';
import { UserService } from './user.service';
import { OfflineDiscoveryCacheService } from './offline-discovery-cache.service';

describe('DiscoveryService offline privacy boundary', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

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

  it.each([
    { status: 401, kind: 'unauthorised' },
    { status: 429, kind: 'rate_limited' },
    { status: 400, kind: 'invalid_request' },
  ] satisfies readonly { status: number; kind: DiscoverySearchFailureKind }[])(
    'classifies an HTTP $status partner-search failure as $kind',
    async ({ status, kind }) => {
      const get = vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status,
              url: 'https://api.example/discovery/partners?latitude=51.5&longitude=-0.1',
            }),
        ),
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
      await expect(service.findPartners({})).rejects.toMatchObject({
        name: 'DiscoverySearchError',
        kind,
        status,
      });
      expect(get).toHaveBeenCalledTimes(1);
    },
  );

  it('retries one transient server failure before returning a sanitised unavailable error', async () => {
    vi.useFakeTimers();
    let subscriptions = 0;
    const get = vi.fn(() =>
      defer(() => {
        subscriptions += 1;
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 503,
              url: 'https://api.example/discovery/partners?latitude=51.5&longitude=-0.1',
            }),
        );
      }),
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
    const rejection = expect(service.findPartners({})).rejects.toMatchObject({
      name: 'DiscoverySearchError',
      kind: 'unavailable',
      status: 503,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(get).toHaveBeenCalledTimes(1);
    expect(subscriptions).toBe(2);
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

  it('keeps only partners with an audio intro when has_audio_intro is required', async () => {
    const get = vi.fn((url: string) =>
      of(
        url.includes('/partners')
          ? [
              { id: 'with-intro', audio_intro_url: 'https://cdn.example/intro.m4a' },
              { id: 'blank-intro', audio_intro_url: '   ' },
              { id: 'no-intro', audio_intro_url: null },
            ]
          : [],
      ),
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
          useValue: { getBlockedAndBlockerIdsStrict: vi.fn(() => Promise.resolve([])) },
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
    const results = await service.findPartners({ has_audio_intro: true });
    expect(results.map((user) => user.id)).toEqual(['with-intro']);
  });

  it('maps proficiency levels and language filters to uppercase CEFR query parameters', async () => {
    let capturedParams: unknown = null;
    const get = vi.fn((_url: string, options?: { params?: unknown }) => {
      capturedParams = options?.params;
      return of([]);
    });

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
          useValue: { getBlockedAndBlockerIdsStrict: vi.fn(() => Promise.resolve([])) },
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
    await service.findPartners({
      native_languages: 'es',
      target_language: 'fr',
      proficiency_level: 'b1',
    });

    expect(get).toHaveBeenCalled();
    const params = capturedParams as { get: (key: string) => string | null };
    expect(params.get('native_languages')).toBe('es');
    expect(params.get('target_language')).toBe('fr');
    expect(params.get('level')).toBe('B1');
  });
});
