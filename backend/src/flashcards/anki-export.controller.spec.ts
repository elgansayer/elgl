import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { AnkiExportController } from './anki-export.controller';
import { AnkiExportService } from './anki-export.service';

function mockUser(): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  };
}

function mockResponse(): Response {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  } as unknown as Response;
}

describe('AnkiExportController', () => {
  it('fails closed when the authenticated principal is missing', async () => {
    const service = {
      exportUserFlashcards: vi.fn(),
    } as unknown as AnkiExportService;
    const controller = new AnkiExportController(service);

    await expect(
      controller.exportForAnki(null, mockResponse()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.exportUserFlashcards).not.toHaveBeenCalled();
  });

  it('returns a private no-store attachment for the current user only', async () => {
    const exportUserFlashcards = vi.fn().mockResolvedValue({
      content: '#separator:tab\nfront\tback\n',
      count: 1,
      truncated: false,
    });
    const service = { exportUserFlashcards } as unknown as AnkiExportService;
    const response = mockResponse();
    const controller = new AnkiExportController(service);

    await controller.exportForAnki(mockUser(), response);

    expect(exportUserFlashcards).toHaveBeenCalledWith('user-1');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Anki-Export-Count', '1');
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Anki-Export-Truncated',
      'false',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/tab-separated-values; charset=utf-8',
    );
    expect(response.send).toHaveBeenCalledWith('#separator:tab\nfront\tback\n');
  });
});
