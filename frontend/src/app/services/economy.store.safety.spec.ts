import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { EconomyStore } from './economy.store';
import { GiftAnimationService } from './gift-animation.service';
import { I18nService } from './i18n.service';
import { NetworkStatusService } from './network-status.service';
import { OfflineEconomyService } from './offline-economy.service';
import { SafetyService } from './safety.service';
import { toastsSignal } from './toast.service';

const TARGET_ID = '22222222-2222-4222-8222-222222222222';

describe('EconomyStore trust and safety actions', () => {
  let store: EconomyStore;
  let safety: {
    reportUser: ReturnType<typeof vi.fn>;
    blockUserAsync: ReturnType<typeof vi.fn>;
  };

  const toastMessages = (): string[] =>
    toastsSignal().map((toast) => `${toast.type}:${toast.message}`);

  beforeEach(() => {
    toastsSignal.set([]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    safety = {
      reportUser: vi.fn().mockResolvedValue({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: false,
      }),
      blockUserAsync: vi.fn().mockResolvedValue({
        success: true,
        blocked_id: TARGET_ID,
        already_blocked: false,
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: signal(null), getAccessToken: vi.fn(() => null) },
        },
        { provide: CentrifugeService, useValue: {} },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: SafetyService, useValue: safety },
        { provide: GiftAnimationService, useValue: { playAnimation: vi.fn() } },
        { provide: OfflineEconomyService, useValue: {} },
        { provide: NetworkStatusService, useValue: { isOnline: signal(true) } },
      ],
    });
    store = TestBed.inject(EconomyStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('reportUser', () => {
    it('files the report with the chosen reason and confirms with translated copy', async () => {
      await store.reportUser(TARGET_ID, 'spam', 'Sells followers');

      expect(safety.reportUser).toHaveBeenCalledWith({
        reported_id: TARGET_ID,
        reason_category: 'spam',
        description: 'Sells followers',
      });
      expect(toastMessages()).toEqual(['success:economy.reportSubmitted']);
    });

    it('tells the reporter when an open report already exists', async () => {
      safety.reportUser.mockResolvedValueOnce({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: true,
      });

      await store.reportUser(TARGET_ID, 'harassment');

      expect(toastMessages()).toEqual(['success:report.toast_duplicate']);
    });

    it('shows a failure instead of a false success when the report is rejected', async () => {
      safety.reportUser.mockRejectedValueOnce(new Error('service unavailable'));

      await store.reportUser(TARGET_ID, 'harassment');

      expect(toastMessages()).toEqual(['error:economy.reportFailed']);
    });
  });

  describe('blockUser', () => {
    it('records the block locally once the API accepted it and confirms it', async () => {
      await store.blockUser(TARGET_ID);

      expect(safety.blockUserAsync).toHaveBeenCalledWith(TARGET_ID);
      expect(store.blockedUserIds().has(TARGET_ID)).toBe(true);
      expect(toastMessages()).toEqual(['success:economy.blockSucceeded']);
    });

    it('does not record a block that the API refused', async () => {
      safety.blockUserAsync.mockRejectedValueOnce(new Error('service unavailable'));

      await store.blockUser(TARGET_ID);

      expect(store.blockedUserIds().has(TARGET_ID)).toBe(false);
      expect(toastMessages()).toEqual(['error:economy.blockFailed']);
    });
  });
});
