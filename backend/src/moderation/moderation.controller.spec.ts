import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminCapabilityGuard } from '../admin/guards/admin-capability.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { ADMIN_CAPABILITIES_METADATA_KEY } from '../admin/decorators/require-admin-capabilities.decorator';

describe('ModerationController', () => {
  let controller: ModerationController;
  let moderationService: ModerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModerationController],
      providers: [
        {
          provide: ModerationService,
          useValue: {
            getItems: vi.fn(),
            reportUser: vi.fn(),
            approveItem: vi.fn(),
            rejectItem: vi.fn(),
            analyseUserForDatingBehaviour: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(AdminCapabilityGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ModerationController>(ModerationController);
    moderationService = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getItems', () => {
    it('should call service getItems with type and status', async () => {
      const items = [
        {
          id: 'r1',
          status: 'pending',
          reason: 'spam',
          created_at: '2026-01-01',
          description: 'Bad',
          reporter: { id: 'r1', display_name: 'Reporter' },
          reported_user: { id: 'b1', display_name: 'Bad User' },
          reportedMomentId: null,
        },
      ];
      (moderationService.getItems as Mock).mockResolvedValue(items);

      const result = await controller.getItems('profile', 'pending');

      expect(moderationService.getItems).toHaveBeenCalledWith(
        'profile',
        'pending',
        undefined,
        undefined,
      );
      expect(result).toEqual(items);
    });

    it('should call service with type only when status is undefined', async () => {
      (moderationService.getItems as Mock).mockResolvedValue([]);

      await controller.getItems('moment');

      expect(moderationService.getItems).toHaveBeenCalledWith(
        'moment',
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('reportUser', () => {
    it('should call service reportUser with reporter id and dto', async () => {
      const dto = {
        reportedUserId: '22222222-2222-4222-8222-222222222222',
        reasonCategory: 'spam' as const,
      };
      (moderationService.reportUser as Mock).mockResolvedValue({
        success: true,
        report_id: 'report-1',
        duplicate: false,
      });

      const result = await controller.reportUser(
        { user: { id: 'reporter-1' } },
        dto,
      );

      expect(moderationService.reportUser).toHaveBeenCalledWith(
        'reporter-1',
        dto,
      );
      expect(result).toEqual({
        success: true,
        report_id: 'report-1',
        duplicate: false,
      });
    });
  });

  describe('authorisation boundaries', () => {
    const guardsFor = (handler: keyof ModerationController) =>
      Reflect.getMetadata(
        '__guards__',
        ModerationController.prototype[handler],
      ) ?? [];
    const capabilitiesFor = (handler: keyof ModerationController) =>
      Reflect.getMetadata(
        ADMIN_CAPABILITIES_METADATA_KEY,
        ModerationController.prototype[handler],
      );

    it.each([
      ['getItems', ['moderation.cases.read']],
      ['analyseUser', ['moderation.cases.read']],
      ['approve', ['moderation.cases.manage']],
      ['reject', ['moderation.cases.manage']],
    ] as const)(
      'requires admin capabilities %s -> %j so any signed-in user cannot read the queue or resolve reports',
      (handler, capabilities) => {
        expect(guardsFor(handler)).toEqual([AdminGuard, AdminCapabilityGuard]);
        expect(capabilitiesFor(handler)).toEqual(capabilities);
      },
    );

    it('keeps report submission open to any authenticated user', () => {
      expect(guardsFor('reportUser')).toEqual([]);
      expect(capabilitiesFor('reportUser')).toBeUndefined();
      expect(Reflect.getMetadata('__guards__', ModerationController)).toEqual([
        SupabaseAuthGuard,
      ]);
    });

    it('throttles report submission to 5 requests a minute', () => {
      expect(
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          ModerationController.prototype.reportUser,
        ),
      ).toBe(5);
    });
  });

  describe('approve', () => {
    it('should call service approveItem with dto', async () => {
      const dto = { itemId: 'report-1', type: 'profile' };
      (moderationService.approveItem as Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.approve(dto);

      expect(moderationService.approveItem).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true });
    });
  });

  describe('reject', () => {
    it('should call service rejectItem with dto', async () => {
      const dto = { itemId: 'report-1', type: 'moment', reason: 'violation' };
      (moderationService.rejectItem as Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.reject(dto);

      expect(moderationService.rejectItem).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true });
    });
  });

  describe('analyseUser', () => {
    it('should call service analyseUserForDatingBehaviour with userId', async () => {
      const analysis = { riskScore: 30, flags: ['love'] };
      (
        moderationService.analyseUserForDatingBehaviour as Mock
      ).mockResolvedValue(analysis);

      const result = await controller.analyseUser('user-1');

      expect(
        moderationService.analyseUserForDatingBehaviour,
      ).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(analysis);
    });
  });
});
