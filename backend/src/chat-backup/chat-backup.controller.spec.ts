import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { ChatBackupController } from './chat-backup.controller';
import { ChatBackupService } from './chat-backup.service';

const ROOM_ID = '11111111-2222-4333-8444-555555555555';
const USER_ID = '99999999-8888-4777-8666-555555555555';
const user = { id: USER_ID } as never;

describe('ChatBackupController', () => {
  let controller: ChatBackupController;
  let service: {
    exportRoomBackup: Mock;
    importRoomBackup: Mock;
  };

  beforeEach(() => {
    service = {
      exportRoomBackup: vi.fn(),
      importRoomBackup: vi.fn(),
    };
    controller = new ChatBackupController(
      service as unknown as ChatBackupService,
    );
  });

  it('returns an export document for the authenticated member', async () => {
    const document = {
      room_id: ROOM_ID,
      exported_at: '2026-11-14T00:00:00.000Z',
      messages: [],
    };
    service.exportRoomBackup.mockResolvedValue(document);
    const setHeader = vi.fn();

    const result = await controller.exportBackup(ROOM_ID, user, {
      setHeader,
    } as never);

    expect(service.exportRoomBackup).toHaveBeenCalledWith(USER_ID, ROOM_ID);
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="chat-backup-${ROOM_ID}.json"`,
    );
    expect(result).toBe(document);
  });

  it('propagates an unauthorised export without writing headers', async () => {
    service.exportRoomBackup.mockRejectedValue(new Error('not a member'));
    const setHeader = vi.fn();

    await expect(
      controller.exportBackup(ROOM_ID, user, { setHeader } as never),
    ).rejects.toThrow('not a member');
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('rejects an export without an authenticated user', async () => {
    await expect(
      controller.exportBackup(ROOM_ID, null, { setHeader: vi.fn() } as never),
    ).rejects.toThrow(UnauthorizedException);
    expect(service.exportRoomBackup).not.toHaveBeenCalled();
  });

  it('imports a validated payload for the authenticated member', async () => {
    service.importRoomBackup.mockResolvedValue(3);

    const result = await controller.importBackup(
      ROOM_ID,
      { messages: [{ text_content: 'hola' }] },
      user,
    );

    expect(service.importRoomBackup).toHaveBeenCalledWith(USER_ID, ROOM_ID, [
      { text_content: 'hola' },
    ]);
    expect(result).toEqual({ importedCount: 3 });
  });

  it('propagates an oversized import rejection', async () => {
    service.importRoomBackup.mockRejectedValue(
      new BadRequestException('Import payload exceeds 98304 bytes'),
    );

    await expect(
      controller.importBackup(
        ROOM_ID,
        { messages: [{ text_content: 'hola' }] },
        user,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an import without an authenticated user', async () => {
    await expect(
      controller.importBackup(
        ROOM_ID,
        { messages: [{ text_content: 'hola' }] },
        null,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(service.importRoomBackup).not.toHaveBeenCalled();
  });
});
