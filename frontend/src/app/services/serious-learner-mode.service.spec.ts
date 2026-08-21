import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SeriousLearnerModeService } from './serious-learner-mode.service';

describe('SeriousLearnerModeService', () => {
  const currentUser = signal<{ id: string } | null>({ id: 'user-a' });
  const http = {
    get: vi.fn(),
    patch: vi.fn(),
  };
  const auth = {
    currentUser,
    getAccessToken: vi.fn(() => 'token-a'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.set({ id: 'user-a' });
    auth.getAccessToken.mockReturnValue('token-a');
    http.get.mockReturnValue(of({ serious_learner_mode: false }));
    http.patch.mockReturnValue(of({ serious_learner_mode: true }));

    TestBed.configureTestingModule({
      providers: [
        SeriousLearnerModeService,
        { provide: HttpClient, useValue: http },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  it('loads the persisted preference for the authenticated account', async () => {
    http.get.mockReturnValue(of({ serious_learner_mode: true }));
    const service = TestBed.inject(SeriousLearnerModeService);

    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.enabled()).toBe(true);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('persists and independently verifies a mode change', async () => {
    const service = TestBed.inject(SeriousLearnerModeService);
    await vi.waitFor(() => expect(service.loading()).toBe(false));
    http.get.mockClear();
    http.get.mockReturnValue(of({ serious_learner_mode: true }));

    await expect(service.setEnabled(true)).resolves.toBe(true);

    expect(http.patch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me'),
      { serious_learner_mode: true },
      expect.any(Object),
    );
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(service.enabled()).toBe(true);
    expect(service.error()).toBeNull();
  });

  it('rolls back when persistence verification does not match the requested value', async () => {
    const service = TestBed.inject(SeriousLearnerModeService);
    await vi.waitFor(() => expect(service.loading()).toBe(false));
    http.get.mockClear();
    http.get.mockReturnValue(of({ serious_learner_mode: false }));

    await expect(service.setEnabled(true)).resolves.toBe(false);

    expect(service.enabled()).toBe(false);
    expect(service.error()).toBe('serious-learner-mode.save-failed');
  });

  it('resets on account switch and ignores a stale profile response', async () => {
    const stale = new Subject<{ serious_learner_mode: boolean }>();
    http.get.mockReturnValueOnce(stale).mockReturnValueOnce(of({ serious_learner_mode: false }));
    const service = TestBed.inject(SeriousLearnerModeService);

    currentUser.set({ id: 'user-b' });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    stale.next({ serious_learner_mode: true });
    stale.complete();
    await Promise.resolve();

    expect(service.enabled()).toBe(false);
  });

  it('does not write without an authenticated token', async () => {
    auth.getAccessToken.mockReturnValue(null as unknown as string);
    const service = TestBed.inject(SeriousLearnerModeService);

    await expect(service.setEnabled(true)).resolves.toBe(false);
    expect(http.patch).not.toHaveBeenCalled();
    expect(service.enabled()).toBe(false);
  });
});
