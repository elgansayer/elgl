import { Test, TestingModule } from '@nestjs/testing';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('SafetyController', () => {
  let controller: SafetyController;
  let safetyService: SafetyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SafetyController],
      providers: [
        {
          provide: SafetyService,
          useValue: {
            reportUser: jest.fn(),
            blockUser: jest.fn(),
            getBlockedIds: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<SafetyController>(SafetyController);
    safetyService = module.get<SafetyService>(SafetyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reportUser', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.reportUser(null, {} as any);
      expect(result).toBeNull();
      expect(safetyService.reportUser).not.toHaveBeenCalled();
    });

    it('should call service reportUser when user is provided', async () => {
      const dto: any = { reported_id: 'bad-1', reason: 'spam' };
      const report: any = { id: 'report-1', ...dto };
      (safetyService.reportUser as jest.Mock).mockResolvedValue(report);

      const result = await controller.reportUser({ id: 'user-1' } as any, dto);
      expect(safetyService.reportUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(report);
    });
  });

  describe('blockUser', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.blockUser(null, {} as any);
      expect(result).toBeNull();
      expect(safetyService.blockUser).not.toHaveBeenCalled();
    });

    it('should call service blockUser when user is provided', async () => {
      const dto: any = { blocked_id: 'bad-2' };
      const response: any = { success: true, blocked_id: 'bad-2' };
      (safetyService.blockUser as jest.Mock).mockResolvedValue(response);

      const result = await controller.blockUser({ id: 'user-1' } as any, dto);
      expect(safetyService.blockUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('getBlockedIds', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getBlockedIds(null);
      expect(result).toEqual([]);
      expect(safetyService.getBlockedIds).not.toHaveBeenCalled();
    });

    it('should call service getBlockedIds when user is provided', async () => {
      const ids = ['bad-1', 'bad-2'];
      (safetyService.getBlockedIds as jest.Mock).mockResolvedValue(ids);

      const result = await controller.getBlockedIds({ id: 'user-1' } as any);
      expect(safetyService.getBlockedIds).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(ids);
    });
  });
});
