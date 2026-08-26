import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { CentrifugoService } from './centrifugo.service';
import { ReadReceiptsService } from './read-receipts.service';
import { ChatMessageEvent } from '../notifications/events/notification.events';
import {
  RegisterChatE2eeDeviceDto,
  SendEncryptedChatMessageDto,
} from './dto/chat-e2ee.dto';

const MAX_ACTIVE_DEVICES_PER_USER = 8;

export interface ChatE2eeDevice {
  user_id: string;
  device_id: string;
  public_key: {
    kty: 'EC';
    crv: 'P-256';
    x: string;
    y: string;
  };
}

export interface ChatE2eeRoomState {
  direct: boolean;
  required: boolean;
  participants: string[];
  devices: ChatE2eeDevice[];
}

interface ChatRoomMemberRow {
  user_id: string;
}

interface ChatE2eeDeviceRow {
  user_id: string;
  device_id: string;
  public_key_jwk: ChatE2eeDevice['public_key'];
}

@Injectable()
export class ChatE2eeService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
    private readonly centrifugoService: CentrifugoService,
    private readonly readReceiptsService: ReadReceiptsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async registerDevice(
    userId: string,
    dto: RegisterChatE2eeDeviceDto,
  ): Promise<{ registered: true }> {
    const supabase = this.supabaseService.getClient();
    const { data: existing, error: listError } = await supabase
      .from('chat_e2ee_devices')
      .select('device_id')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .limit(MAX_ACTIVE_DEVICES_PER_USER + 1);

    if (listError) {
      throw new ServiceUnavailableException('Encryption device registry is unavailable.');
    }

    const existingIds = new Set(
      ((existing ?? []) as { device_id: string }[]).map((row) => row.device_id),
    );
    if (!existingIds.has(dto.device_id) && existingIds.size >= MAX_ACTIVE_DEVICES_PER_USER) {
      throw new BadRequestException('Too many active encrypted-chat devices.');
    }

    const { error } = await supabase.from('chat_e2ee_devices').upsert(
      {
        user_id: userId,
        device_id: dto.device_id,
        public_key_jwk: dto.public_key,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    );

    if (error) {
      throw new ServiceUnavailableException('Encryption device registration failed.');
    }

    return { registered: true };
  }

  async revokeDevice(userId: string, deviceId: string): Promise<{ revoked: true }> {
    const { error } = await this.supabaseService
      .getClient()
      .from('chat_e2ee_devices')
      .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .is('revoked_at', null);

    if (error) {
      throw new ServiceUnavailableException('Encryption device revocation failed.');
    }
    return { revoked: true };
  }

  async getRoomState(roomId: string, userId: string): Promise<ChatE2eeRoomState> {
    const participants = await this.getAuthorizedRoomParticipants(roomId, userId);
    if (participants.length !== 2) {
      return { direct: false, required: false, participants, devices: [] };
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_e2ee_devices')
      .select('user_id, device_id, public_key_jwk')
      .in('user_id', participants)
      .is('revoked_at', null)
      .order('created_at', { ascending: true })
      .limit(MAX_ACTIVE_DEVICES_PER_USER * 2);

    if (error) {
      throw new ServiceUnavailableException('Encryption key discovery is unavailable.');
    }

    const devices = ((data ?? []) as ChatE2eeDeviceRow[]).map((row) => ({
      user_id: row.user_id,
      device_id: row.device_id,
      public_key: row.public_key_jwk,
    }));
    const required = participants.every((participantId) =>
      devices.some((device) => device.user_id === participantId),
    );

    return { direct: true, required, participants, devices };
  }

  async assertLegacyMessageAllowed(roomId: string, userId: string): Promise<void> {
    const state = await this.getRoomState(roomId, userId);
    if (state.direct && state.required) {
      throw new BadRequestException(
        'End-to-end encryption is required for this direct conversation.',
      );
    }
  }

  async sendEncryptedMessage(
    senderId: string,
    dto: SendEncryptedChatMessageDto,
  ): Promise<Record<string, unknown>> {
    const state = await this.getRoomState(dto.room_id, senderId);
    if (!state.direct) {
      throw new BadRequestException('End-to-end encrypted personal messages require a direct chat.');
    }
    if (!state.required) {
      throw new BadRequestException('Both participants must register an encryption device first.');
    }

    const blockedIds = await this.safetyService.getBlockedAndBlockerIds(senderId);
    const receiverId = state.participants.find((id) => id !== senderId);
    if (!receiverId || blockedIds.includes(receiverId)) {
      throw new ForbiddenException('Message delivery is not permitted.');
    }

    const expectedDeviceIds = new Set(state.devices.map((device) => device.device_id));
    const envelopeDeviceIds = dto.envelopes.map((envelope) => envelope.device_id);
    const uniqueEnvelopeIds = new Set(envelopeDeviceIds);
    if (
      uniqueEnvelopeIds.size !== envelopeDeviceIds.length ||
      uniqueEnvelopeIds.size !== expectedDeviceIds.size ||
      [...expectedDeviceIds].some((deviceId) => !uniqueEnvelopeIds.has(deviceId))
    ) {
      throw new BadRequestException(
        'Encryption recipients changed. Refresh device keys and retry the message.',
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: dto.room_id,
        sender_id: senderId,
        message_type: 'encrypted',
        text_content: null,
        media_url: null,
        correction_payload: null,
        correction_request_payload: null,
        status_reply_payload: null,
        delivery_status: 'sent',
        encryption_version: 1,
        encrypted_payload: dto.ciphertext,
        encryption_iv: dto.iv,
        encryption_envelopes: dto.envelopes,
      })
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .single();

    if (error || !data) {
      throw new ServiceUnavailableException('Encrypted message could not be persisted.');
    }

    await this.centrifugoService.publish(`chat:${dto.room_id}`, { message: data });
    this.eventEmitter.emit(
      'chat.message',
      new ChatMessageEvent(
        senderId,
        receiverId,
        dto.room_id,
        'encrypted',
        'New encrypted message',
      ),
    );

    void this.readReceiptsService.setInitialSent(data.id as string);
    void this.readReceiptsService.markAsDelivered(
      data.id as string,
      dto.room_id,
      receiverId,
    );

    return data as Record<string, unknown>;
  }

  private async getAuthorizedRoomParticipants(
    roomId: string,
    userId: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .limit(21);

    if (error) {
      throw new ServiceUnavailableException('Chat membership could not be verified.');
    }

    const participants = ((data ?? []) as ChatRoomMemberRow[]).map((row) => row.user_id);
    if (!participants.includes(userId)) {
      throw new ForbiddenException('You are not a member of this chat room.');
    }
    return participants;
  }
}
