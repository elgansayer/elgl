import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DmcaController } from './dmca.controller';
import { DmcaService } from './dmca.service';
import { CreateCounterNoticeDto } from './dto/create-counter-notice.dto';
import { CreateDmcaNoticeDto } from './dto/create-dmca-notice.dto';

const NOTICE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('DmcaController', () => {
  const user = { id: 'user-1' } as User;
  const service = {
    submitNotice: vi.fn(),
    verifyNotice: vi.fn(),
    listOwnerNotices: vi.fn(),
    submitCounterNotice: vi.fn(),
  };
  let controller: DmcaController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new DmcaController(service as unknown as DmcaService);
  });

  it('hands a submitted notice to the service unchanged', async () => {
    const dto = new CreateDmcaNoticeDto();
    service.submitNotice.mockResolvedValue({
      references: ['DMCA-AAAAAAAAAA'],
      status: 'pending_verification',
    });

    await expect(controller.submit(dto)).resolves.toEqual({
      references: ['DMCA-AAAAAAAAAA'],
      status: 'pending_verification',
    });
    expect(service.submitNotice).toHaveBeenCalledWith(dto);
  });

  it('confirms a notice with the emailed token', async () => {
    service.verifyNotice.mockResolvedValue({ notices: [] });

    await controller.verify({ token: 'T'.repeat(43) });

    expect(service.verifyNotice).toHaveBeenCalledWith('T'.repeat(43));
  });

  it('lists notices for the authenticated owner only, with paging', async () => {
    service.listOwnerNotices.mockResolvedValue([]);

    await controller.listMine(user, { page: 2, pageSize: 10 });

    expect(service.listOwnerNotices).toHaveBeenCalledWith('user-1', 2, 10);
  });

  it('files a counter-notification as the authenticated owner', async () => {
    const dto = new CreateCounterNoticeDto();
    service.submitCounterNotice.mockResolvedValue({ id: NOTICE_ID });

    await controller.counterNotice(user, NOTICE_ID, dto);

    expect(service.submitCounterNotice).toHaveBeenCalledWith(
      'user-1',
      NOTICE_ID,
      dto,
    );
  });

  it('rejects owner endpoints without an authenticated user', async () => {
    await expect(controller.listMine(null, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.counterNotice(null, NOTICE_ID, new CreateCounterNoticeDto()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.listOwnerNotices).not.toHaveBeenCalled();
    expect(service.submitCounterNotice).not.toHaveBeenCalled();
  });

  describe('route protection', () => {
    const reflector = new Reflector();
    const guardsOf = (handler: object): unknown[] =>
      (Reflect.getMetadata('__guards__', handler) as unknown[] | undefined) ??
      [];

    it.each(['submit', 'verify'] as const)(
      'leaves %s public, because copyright owners are not users',
      (name) => {
        expect(guardsOf(DmcaController.prototype[name])).not.toContain(
          SupabaseAuthGuard,
        );
      },
    );

    it.each(['listMine', 'counterNotice'] as const)(
      'requires authentication for %s',
      (name) => {
        expect(guardsOf(DmcaController.prototype[name])).toContain(
          SupabaseAuthGuard,
        );
      },
    );

    it.each(['submit', 'verify', 'listMine', 'counterNotice'] as const)(
      'never caches %s responses',
      (name) => {
        expect(
          Reflect.getMetadata('__headers__', DmcaController.prototype[name]),
        ).toEqual([{ name: 'Cache-Control', value: 'no-store' }]);
      },
    );

    it('throttles the public submission far below the global default', () => {
      const limit = reflector.get<number>(
        'THROTTLER:LIMITdefault',
        DmcaController.prototype.submit,
      );
      const ttl = reflector.get<number>(
        'THROTTLER:TTLdefault',
        DmcaController.prototype.submit,
      );

      expect(limit).toBe(5);
      expect(ttl).toBe(3_600_000);
    });

    it('answers 202 for a recorded notice', () => {
      expect(
        Reflect.getMetadata('__httpCode__', DmcaController.prototype.submit),
      ).toBe(202);
    });
  });
});
