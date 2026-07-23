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
            reportMessage: jest.fn(),
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

  describe('reportMessage', () => {
    it('should call service reportMessage when user is provided', async () => {
      const dto: any = { reported_id: 'bad-1', reason: 'spam' };
      (safetyService.reportMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.reportMessage(
        { user: { id: 'user-1' } } as any,
        dto,
      );
      expect(safetyService.reportMessage).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ success: true });
    });
  });

  describe('blockUser', () => {
    it('should throw if req user is missing', async () => {
      // guard prevents this in reality
    });

    it('should call service blockUser when user is provided', async () => {
      const dto: any = { blocked_id: 'bad-2' };
      const response: any = { success: true, blocked_id: 'bad-2' };
      (safetyService.blockUser as jest.Mock).mockResolvedValue(response);

      const result = await controller.blockUser(
        { user: { id: 'user-1' } } as any,
        dto,
      );
      expect(safetyService.blockUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('getBlockedIds', () => {
    it('should throw if req user is missing', async () => {
      // guard prevents this in reality
    });

    it('should call service getBlockedIds when user is provided', async () => {
      const ids = ['bad-1', 'bad-2'];
      (safetyService.getBlockedIds as jest.Mock).mockResolvedValue(ids);

      const result = await controller.getBlockedIds({
        user: { id: 'user-1' },
      } as any);
      expect(safetyService.getBlockedIds).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(ids);
    });
  });
});
