import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AnkiiIntegrationController } from './ankii-integration.controller';
import { AnkiiIntegrationService } from './ankii-integration.service';

function user(): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('AnkiiIntegrationController', () => {
  const exportUserFlashcards = vi.fn();
  const importTsv = vi.fn();
  let controller: AnkiiIntegrationController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnkiiIntegrationController],
      providers: [
        {
          provide: AnkiiIntegrationService,
          useValue: { exportUserFlashcards, importTsv },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(AnkiiIntegrationController);
  });

  it('exports only the authenticated user flashcards', async () => {
    exportUserFlashcards.mockResolvedValue({
      content: '#separator:tab\nbonjour\thello\n',
      exported: 1,
      truncated: false,
    });
    const response = { header: vi.fn() };

    const result = await controller.exportFlashcards(
      user(),
      response as never,
    );

    expect(exportUserFlashcards).toHaveBeenCalledWith('user-1');
    expect(response.header).toHaveBeenCalledWith('X-Anki-Exported', '1');
    expect(response.header).toHaveBeenCalledWith('X-Anki-Truncated', 'false');
    expect(result).toContain('bonjour\thello');
  });

  it('imports only into the authenticated user library', async () => {
    importTsv.mockResolvedValue({ imported: 1, skipped: 0, errors: [] });

    await expect(
      controller.importFlashcards(user(), { content: 'bonjour\thello' }),
    ).resolves.toEqual({ imported: 1, skipped: 0, errors: [] });
    expect(importTsv).toHaveBeenCalledWith('user-1', 'bonjour\thello');
  });

  it('fails closed without an authenticated user', async () => {
    await expect(controller.exportFlashcards(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.importFlashcards(null, { content: 'bonjour\thello' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});