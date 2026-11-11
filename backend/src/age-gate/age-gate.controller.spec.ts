import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '@supabase/supabase-js';
import { PrivacyController } from '../privacy/privacy.controller';
import { AGE_GATE_EXEMPT_METADATA_KEY } from './age-gate-exempt.decorator';
import { AgeGateController } from './age-gate.controller';
import { AgeGateService } from './age-gate.service';

describe('AgeGateController', () => {
  const user = { id: 'user-1', email: 'person@example.com' } as User;
  const view = { status: 'passed', required: false, blocked: false } as const;
  const getStatus = vi.fn();
  const submitDateOfBirth = vi.fn();
  let controller: AgeGateController;

  beforeEach(() => {
    vi.clearAllMocks();
    getStatus.mockResolvedValue(view);
    submitDateOfBirth.mockResolvedValue(view);
    controller = new AgeGateController({
      getStatus,
      submitDateOfBirth,
    } as unknown as AgeGateService);
  });

  it('returns the caller state for the authenticated account only', async () => {
    await expect(controller.getStatus(user)).resolves.toEqual(view);
    expect(getStatus).toHaveBeenCalledWith('user-1');
  });

  it('passes the declared date and the account email to the service', async () => {
    await expect(
      controller.submit(user, { dateOfBirth: '1990-05-17' }),
    ).resolves.toEqual(view);

    expect(submitDateOfBirth).toHaveBeenCalledWith(
      { id: 'user-1', email: 'person@example.com' },
      { dateOfBirth: '1990-05-17' },
    );
  });

  it('treats a missing email as no email rather than undefined', async () => {
    await controller.submit({ id: 'user-2' } as User, {
      dateOfBirth: '1990-05-17',
    });

    expect(submitDateOfBirth).toHaveBeenCalledWith(
      { id: 'user-2', email: null },
      { dateOfBirth: '1990-05-17' },
    );
  });

  it('rejects requests without an authenticated user', async () => {
    await expect(controller.getStatus(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.submit(null, { dateOfBirth: '1990-05-17' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getStatus).not.toHaveBeenCalled();
    expect(submitDateOfBirth).not.toHaveBeenCalled();
  });

  describe('route metadata', () => {
    const reflector = new Reflector();

    it('exempts the whole age-gate controller so blocked accounts can reach it', () => {
      expect(
        reflector.get<boolean>(AGE_GATE_EXEMPT_METADATA_KEY, AgeGateController),
      ).toBe(true);
    });

    it('never caches the per-user responses', () => {
      for (const handler of [
        AgeGateController.prototype.getStatus,
        AgeGateController.prototype.submit,
      ]) {
        expect(Reflect.getMetadata('__headers__', handler)).toEqual([
          { name: 'Cache-Control', value: 'no-store' },
        ]);
      }
    });

    it('keeps account deletion reachable without leaving the rest of privacy open', () => {
      expect(
        reflector.get<boolean>(
          AGE_GATE_EXEMPT_METADATA_KEY,
          PrivacyController.prototype.deleteAccount,
        ),
      ).toBe(true);
      expect(
        reflector.get<boolean>(
          AGE_GATE_EXEMPT_METADATA_KEY,
          PrivacyController.prototype.requestArchive,
        ),
      ).toBeUndefined();
      expect(
        reflector.get<boolean>(
          AGE_GATE_EXEMPT_METADATA_KEY,
          PrivacyController.prototype.cancelDeletion,
        ),
      ).toBeUndefined();
    });
  });
});
