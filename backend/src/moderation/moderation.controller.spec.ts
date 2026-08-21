import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

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
      const dto = { reportedUserId: 'bad-user', reasonCategory: 'spam' };
      (moderationService.reportUser as Mock).mockResolvedValue({
        id: 'report-1',
      });

      const result = await controller.reportUser(
        { user: { id: 'reporter-1' } },
        dto,
      );

      expect(moderationService.reportUser).toHaveBeenCalledWith(
        'reporter-1',
        dto,
      );
      expect(result).toEqual({ id: 'report-1' });
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
