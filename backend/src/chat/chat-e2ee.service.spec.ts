import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ChatE2eeService, ChatE2eeRoomState } from './chat-e2ee.service';

const senderId = '11111111-1111-4111-8111-111111111111';
const receiverId = '22222222-2222-4222-8222-222222222222';
const senderDevice = '33333333-3333-4333-8333-333333333333';
const receiverDevice = '44444444-4444-4444-8444-444444444444';
const publicKey = { kty: 'EC' as const, crv: 'P-256' as const, x: 'x'.repeat(43), y: 'y'.repeat(43) };

function directState(required = true): ChatE2eeRoomState {
  return {
    direct: true,
    required,
    participants: [senderId, receiverId],
    devices: required
      ? [
          { user_id: senderId, device_id: senderDevice, public_key: publicKey },
          { user_id: receiverId, device_id: receiverDevice, public_key: publicKey },
        ]
      : [{ user_id: senderId, device_id: senderDevice, public_key: publicKey }],
  };
}

function makeService() {
  const saved = {
    id: '55555555-5555-4555-8555-555555555555',
    room_id: 'room-1',
    sender_id: senderId,
    message_type: 'encrypted',
    encryption_version: 1,
  };
  const single = vi.fn().mockResolvedValue({ data: saved, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const supabase = { from: vi.fn().mockReturnValue({ insert }) };
  const centrifugo = { publish: vi.fn().mockResolvedValue(undefined) };
  const receipts = {
    setInitialSent: vi.fn().mockResolvedValue(undefined),
    markAsDelivered: vi.fn().mockResolvedValue(undefined),
  };
  const events = { emit: vi.fn() };
  const safety = { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) };
  const service = new ChatE2eeService(
    { getClient: () => supabase } as never,
    safety as never,
    centrifugo as never,
    receipts as never,
    events as never,
  );
  return { service, insert, centrifugo, receipts, events };
}

describe('ChatE2eeService', () => {
  it('blocks plaintext downgrade after both direct-chat participants have registered keys', async () => {
    const { service } = makeService();
    vi.spyOn(service, 'getRoomState').mockResolvedValue(directState(true));

    await expect(service.assertLegacyMessageAllowed('room-1', senderId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows mixed-version plaintext only until both participants have active devices', async () => {
    const { service } = makeService();
    vi.spyOn(service, 'getRoomState').mockResolvedValue(directState(false));

    await expect(service.assertLegacyMessageAllowed('room-1', senderId)).resolves.toBeUndefined();
  });

  it('rejects stale recipient envelopes before persisting ciphertext', async () => {
    const { service, insert } = makeService();
    vi.spyOn(service, 'getRoomState').mockResolvedValue(directState(true));

    await expect(
      service.sendEncryptedMessage(senderId, {
        room_id: 'room-1',
        encryption_version: 1,
        ciphertext: 'abc',
        iv: 'def',
        envelopes: [
          {
            device_id: senderDevice,
            ephemeral_public_key: publicKey,
            iv: 'ghi',
            wrapped_key: 'jkl',
          },
          {
            device_id: '66666666-6666-4666-8666-666666666666',
            ephemeral_public_key: publicKey,
            iv: 'mno',
            wrapped_key: 'pqr',
          },
        ],
      }),
    ).rejects.toThrow('Refresh device keys');
    expect(insert).not.toHaveBeenCalled();
  });

  it('persists only ciphertext/envelopes and publishes a generic notification preview', async () => {
    const { service, insert, centrifugo, receipts, events } = makeService();
    vi.spyOn(service, 'getRoomState').mockResolvedValue(directState(true));
    const envelopes = [senderDevice, receiverDevice].map((deviceId) => ({
      device_id: deviceId,
      ephemeral_public_key: publicKey,
      iv: 'a'.repeat(16),
      wrapped_key: 'b'.repeat(64),
    }));

    await service.sendEncryptedMessage(senderId, {
      room_id: 'room-1',
      encryption_version: 1,
      ciphertext: 'ciphertext',
      iv: 'c'.repeat(16),
      envelopes,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message_type: 'encrypted',
        text_content: null,
        media_url: null,
        encrypted_payload: 'ciphertext',
        encryption_envelopes: envelopes,
      }),
    );
    expect(centrifugo.publish).toHaveBeenCalledWith(
      'chat:room-1',
      expect.objectContaining({ message: expect.any(Object) }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'chat.message',
      expect.objectContaining({ preview: 'New encrypted message' }),
    );
    expect(receipts.setInitialSent).toHaveBeenCalled();
  });
});
