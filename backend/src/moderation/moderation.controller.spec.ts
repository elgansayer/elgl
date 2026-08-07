import { Test, TestingModule } from '@nestjs/testing';
import { ModerationController } from './moderation.controller';
import { ModerationItemsResult, ModerationService } from './moderation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ModerationQueryDto } from './dto/moderation-query.dto';

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
            getItems: jest.fn(),
            reportUser: jest.fn(),
            approveItem: jest.fn(),
            rejectItem: jest.fn(),
            analyseUserForDatingBehaviour: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ModerationController>(ModerationController);
    moderationService = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getItems', () => {
    it('should call service getItems with query dto', async () => {
      const result: ModerationItemsResult = {
        items: [
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
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      (moderationService.getItems as jest.Mock).mockResolvedValue(result);

      const query: ModerationQueryDto = { type: 'profile', status: 'pending' };
      const response = await controller.getItems(query);

      expect(moderationService.getItems).toHaveBeenCalledWith(query);
      expect(response).toEqual(result);
    });

    it('should pass pagination params', async () => {
      (moderationService.getItems as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
      });

      const query: ModerationQueryDto = {
        type: 'moment',
        page: 2,
        pageSize: 10,
      };
      await controller.getItems(query);

      expect(moderationService.getItems).toHaveBeenCalledWith(query);
    });
  });

  describe('reportUser', () => {
    it('should call service reportUser with reporter id and dto', async () => {
      const dto = { reportedUserId: 'bad-user', reasonCategory: 'spam' };
      (moderationService.reportUser as jest.Mock).mockResolvedValue({
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
      (moderationService.approveItem as jest.Mock).mockResolvedValue({
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
      (moderationService.rejectItem as jest.Mock).mockResolvedValue({
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
        moderationService.analyseUserForDatingBehaviour as jest.Mock
      ).mockResolvedValue(analysis);

      const result = await controller.analyseUser('user-1');

      expect(
        moderationService.analyseUserForDatingBehaviour,
      ).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(analysis);
    });
  });
});
