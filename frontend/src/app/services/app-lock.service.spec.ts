import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AppLockService } from './app-lock.service';
import { AuthService } from './auth.service';
import { CallAudioSessionService } from './call-audio-session.service';

const LOCK_ENABLED_KEY = 'hellotalk-biometric-lock';
const CREDENTIAL_ID_KEY = 'hellotalk-biometric-credential-id';

interface AppLockInternals {
  authenticateCredential(storedCredentialId: string): Promise<boolean>;
}

describe('AppLockService background lock', () => {
  let service: AppLockService;
  let callActive: ReturnType<typeof signal<boolean>>;

  /** Starts with the lock enabled and the app unlocked, as after a normal sign-in. */
  async function createUnlockedService(options: { biometricEnabled: boolean }): Promise<void> {
    localStorage.clear();
    if (options.biometricEnabled) {
      localStorage.setItem(LOCK_ENABLED_KEY, 'true');
      localStorage.setItem(CREDENTIAL_ID_KEY, 'credential-1');
    }
    callActive = signal(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: CallAudioSessionService, useValue: { isCallActive: callActive.asReadonly() } },
      ],
    });
    service = TestBed.inject(AppLockService);
    if (options.biometricEnabled) {
      // A stored lock starts locked. Unlock it the way a person would after authenticating.
      vi.spyOn(service as unknown as AppLockInternals, 'authenticateCredential').mockResolvedValue(
        true,
      );
      await service.unlock();
    }
  }

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('without a live call', () => {
    it('locks as soon as the app goes to the background when the lock is on', async () => {
      await createUnlockedService({ biometricEnabled: true });
      expect(service.appLocked()).toBe(false);

      service.lockNow();

      expect(service.appLocked()).toBe(true);
    });

    it('never locks when the biometric lock is off', async () => {
      await createUnlockedService({ biometricEnabled: false });

      service.lockNow();

      expect(service.appLocked()).toBe(false);
    });
  });

  describe('during a live call', () => {
    beforeEach(async () => {
      await createUnlockedService({ biometricEnabled: true });
      callActive.set(true);
      TestBed.tick();
    });

    it('does not lock, because locking would hang up the call', () => {
      service.lockNow();
      TestBed.tick();

      expect(service.appLocked()).toBe(false);
    });

    it('keeps waiting for as long as the call lasts', () => {
      service.lockNow();
      TestBed.tick();
      service.lockNow();
      TestBed.tick();

      expect(service.appLocked()).toBe(false);
    });

    it('locks the moment the call ends', () => {
      service.lockNow();
      TestBed.tick();

      callActive.set(false);
      TestBed.tick();

      expect(service.appLocked()).toBe(true);
    });

    it('does not lock after the call when the app never went to the background', () => {
      callActive.set(false);
      TestBed.tick();

      expect(service.appLocked()).toBe(false);
    });

    it('does not lock after the call when the lock was switched off in the meantime', async () => {
      service.lockNow();
      TestBed.tick();
      await service.disableBiometricLock();

      callActive.set(false);
      TestBed.tick();

      expect(service.appLocked()).toBe(false);
    });

    it('applies the waiting lock once and leaves a later unlock alone', async () => {
      service.lockNow();
      TestBed.tick();
      callActive.set(false);
      TestBed.tick();
      expect(service.appLocked()).toBe(true);

      vi.spyOn(service as unknown as AppLockInternals, 'authenticateCredential').mockResolvedValue(
        true,
      );
      await service.unlock();
      TestBed.tick();

      expect(service.appLocked()).toBe(false);
    });

    it('waits again during the next call', async () => {
      service.lockNow();
      TestBed.tick();
      callActive.set(false);
      TestBed.tick();
      vi.spyOn(service as unknown as AppLockInternals, 'authenticateCredential').mockResolvedValue(
        true,
      );
      await service.unlock();
      expect(service.appLocked()).toBe(false);

      callActive.set(true);
      TestBed.tick();
      service.lockNow();
      TestBed.tick();

      expect(service.appLocked()).toBe(false);
    });
  });
});
