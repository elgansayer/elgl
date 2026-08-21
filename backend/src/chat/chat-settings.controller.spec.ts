import { Test, TestingModule } from '@nestjs/testing';
import { ChatSettingsController } from './chat-settings.controller';
import { ChatSettingsService } from './chat-settings.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatSettingsDto } from './dto/chat-settings.dto';

describe('ChatSettingsController', () => {
  let controller: ChatSettingsController;
  let service: ChatSettingsService;

  const mockSettings: ChatSettingsDto = {
    autoTranslate: false,
    readReceipts: false,
    enterToSend: false,
  };

  beforeEach(async () => {
    const mockService = {
      getSettings: vi.fn().mockResolvedValue(mockSettings),
      updateSettings: vi
        .fn()
        .mockImplementation((_userId: string, settings: unknown) =>
          Promise.resolve(settings as ChatSettingsDto),
        ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChatSettingsController],
      providers: [{ provide: ChatSettingsService, useValue: mockService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get<ChatSettingsController>(ChatSettingsController);
    service = moduleRef.get<ChatSettingsService>(ChatSettingsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return chat settings for the authenticated user', async () => {
      const req = { user: { sub: 'user-123' } };

      const result = await controller.getSettings(req);

      expect(result).toEqual(mockSettings);
      expect(service.getSettings).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updateSettings', () => {
    it('should update chat settings for the authenticated user', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto: ChatSettingsDto = { autoTranslate: true };

      const result = await controller.updateSettings(req, dto);

      expect(result).toEqual(dto);
      expect(service.updateSettings).toHaveBeenCalledWith('user-123', dto);
    });
  });
});
