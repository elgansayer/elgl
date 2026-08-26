import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { XpService } from '../xp/xp.service';
import { ChatMessageEvent } from '../notifications/events/notification.events';
import { CentrifugoService } from './centrifugo.service';
import { ReadReceiptsService } from './read-receipts.service';
import {
  RegisterE2eeDeviceDto,
  SendEncryptedMessageDto,
} from './dto/chat-e2ee.dto';
import { ChatMessage } from './interfaces/chat-message.interface';

const MAX_DEVICES_PER_USER = 10;
const DEVICE_STALE_AFTER_MS = 180 * 24 * 60 * 60 * 1000;

export interface E2eeDeviceDirectoryEntry {
  user_id: string;
  device_id: string;
  public_key_jwk: {
    kty: 'EC';
    crv: 'P-256';
    x: string;
    y: string;
  };
}

export interface E2eeRoomDirectory {
  personal: boolean;
  devices: E2eeDeviceDirectoryEntry[];
}

interface RoomMemberRow {
  user_id: string;
}

interface DeviceRow extends E2eeDeviceDirectoryEntry {
  last_seen_at?: string | null;
}

@Injectable()
export class ChatE2eeService {
  private readonly logger = new Logger(ChatE2eeService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
    private readonly centrifugoService: CentrifugoService,
    private readonly readReceiptsService: ReadReceiptsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly xpService: XpService,
  ) {}

  async registerDevice(
    userId: string,
    dto: RegisterE2eeDeviceDto,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date();
    const staleBefore = new Date(now.getTime() - DEVICE_STALE_AFTER_MS).toISOString();

    // Expired device registrations are safe to prune. They contain public keys
    // only; private ECDH keys never leave the browser.
    const staleDelete = await supabase
      .from('chat_e2ee_devices')
      .delete()
      .eq('user_id', userId)
      .lt('last_seen_at', staleBefore);
    if (staleDelete.error) {
      this.logger.warn('chat_e2ee_device_prune_failed');
    }

    const existing = await supabase
      .from('chat_e2ee_devices')
      .select('device_id, public_key_jwk')
      .eq('user_id', userId)
      .eq('device_id', dto.device_id)
      .maybeSingle();
    if (existing.error) {
      throw new ServiceUnavailableException('Encryption setup is unavailable');
    }

    if (existing.data) {
      const stored = existing.data.public_key_jwk as Record<string, unknown> | null;
      if (
        !stored ||
        stored['kty'] !== dto.public_key_jwk.kty ||
        stored['crv'] !== dto.public_key_jwk.crv ||
        stored['x'] !== dto.public_key_jwk.x ||
        stored['y'] !== dto.public_key_jwk.y
      ) {
        // A device ID must never silently rotate to a different private key.
        throw new ConflictException('Encryption device identity changed');
      }

      const touch = await supabase
        .from('chat_e2ee_devices')
        .update({ last_seen_at: now.toISOString() })
        .eq('user_id', userId)
        .eq('device_id', dto.device_id);
      if (touch.error) {
        throw new ServiceUnavailableException('Encryption setup is unavailable');
      }
      return;
    }

    const countResult = await supabase
      .from('chat_e2ee_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (countResult.error) {
      throw new ServiceUnavailableException('Encryption setup is unavailable');
    }
    if ((countResult.count ?? 0) >= MAX_DEVICES_PER_USER) {
      throw new ConflictException('Too many encryption devices are registered');
    }

    const inserted = await supabase.from('chat_e2ee_devices').insert({
      user_id: userId,
      device_id: dto.device_id,
      public_key_jwk: dto.public_key_jwk,
      last_seen_at: now.toISOString(),
    });
    if (inserted.error) {
      this.logger.warn('chat_e2ee_device_register_failed');
      throw new ServiceUnavailableException('Encryption setup is unavailable');
    }
  }

  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const result = await supabase
      .from('chat_e2ee_devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .select('device_id');
    if (result.error) {
      throw new ServiceUnavailableException('Encryption setup is unavailable');
    }
    if (!result.data || result.data.length === 0) {
      throw new NotFoundException('Encryption device was not found');
    }
  }

  async getRoomDirectory(
    userId: string,
    roomId: string,
  ): Promise<E2eeRoomDirectory> {
    const members = await this.requireRoomMembership(userId, roomId);
    if (members.length !== 2) {
      return { personal: false, devices: [] };
    }

    const userIds = members.map((member) => member.user_id);
    const response = await this.supabaseService
      .getClient()
      .from('chat_e2ee_devices')
      .select('user_id, device_id, public_key_jwk, last_seen_at')
      .in('user_id', userIds)
      .order('last_seen_at', { ascending: false })
      .limit(MAX_DEVICES_PER_USER * 2);

    if (response.error) {
      throw new ServiceUnavailableException('Encryption setup is unavailable');
    }

    const rows = (response.data ?? []) as DeviceRow[];
    return {
      personal: true,
      devices: rows.map((row) => ({
        user_id: row.user_id,
        device_id: row.device_id,
        public_key_jwk: row.public_key_jwk,
      })),
    };
  }

  async sendEncryptedMessage(
    senderId: string,
    dto: SendEncryptedMessageDto,
  ): Promise<ChatMessage> {
    const members = await this.requireRoomMembership(senderId, dto.room_id);
    if (members.length !== 2) {
      throw new BadRequestException('End-to-end encryption is limited to personal chats');
    }

    const receiver = members.find((member) => member.user_id !== senderId);
    if (!receiver) {
      throw new BadRequestException('Personal chat recipient is unavailable');
    }

    await this.enforceSafetyBoundary(senderId, receiver.user_id);
    await this.enforceInitialMessageFilters(senderId, receiver.user_id, dto.room_id);

    const directory = await this.getRoomDirectory(senderId, dto.room_id);
    const senderDevice = directory.devices.find(
      (device) =>
        device.user_id === senderId &&
        device.device_id === dto.encrypted_payload.sender_device_id,
    );
    if (!senderDevice) {
      throw new ForbiddenException('Encryption device is not registered');
    }

    if (
      senderDevice.public_key_jwk.x !== dto.encrypted_payload.sender_public_key.x ||
      senderDevice.public_key_jwk.y !== dto.encrypted_payload.sender_public_key.y
    ) {
      throw new ForbiddenException('Encryption device key does not match');
    }

    const deviceOwner = new Map(
      directory.devices.map((device) => [device.device_id, device.user_id] as const),
    );
    const envelopeIds = new Set<string>();
    const coveredUsers = new Set<string>();
    for (const envelope of dto.encrypted_payload.envelopes) {
      if (envelopeIds.has(envelope.device_id)) {
        throw new BadRequestException('Duplicate encryption key envelope');
      }
      envelopeIds.add(envelope.device_id);
      const owner = deviceOwner.get(envelope.device_id);
      if (!owner) {
        throw new BadRequestException('Encryption key envelope targets an unknown device');
      }
      coveredUsers.add(owner);
    }

    if (!coveredUsers.has(senderId) || !coveredUsers.has(receiver.user_id)) {
      throw new BadRequestException('Encryption key envelopes must cover both participants');
    }

    const supabase = this.supabaseService.getClient();
    const insertResponse = await supabase
      .from('chat_messages')
      .insert({
        room_id: dto.room_id,
        sender_id: senderId,
        message_type: dto.message_type,
        text_content: null,
        media_url: null,
        correction_payload: null,
        correction_request_payload: null,
        status_reply_payload: null,
        reply_to_id: dto.reply_to_id ?? null,
        encrypted_payload: dto.encrypted_payload,
        is_view_once: dto.message_type === 'view_once_media',
        delivery_status: 'sent',
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

    if (insertResponse.error || !insertResponse.data) {
      this.logger.warn('chat_e2ee_message_persist_failed');
      throw new ServiceUnavailableException('Unable to send encrypted message');
    }

    const savedMessage = insertResponse.data as ChatMessage;

    try {
      await this.centrifugoService.publish(`chat:${dto.room_id}`, {
        message: savedMessage,
      });
    } catch {
      // Persistence is authoritative. A reconnect/history load can recover a
      // successfully stored message when realtime fan-out is degraded.
      this.logger.warn('chat_e2ee_realtime_publish_failed');
    }

    this.eventEmitter.emit(
      'chat.message',
      new ChatMessageEvent(
        senderId,
        receiver.user_id,
        dto.room_id,
        dto.message_type,
        '🔒 Encrypted message',
      ),
    );
    this.eventEmitter.emit('message.sent', { userId: senderId });
    void this.xpService.awardXpForActivity(senderId, 'send_message');
    void this.readReceiptsService.setInitialSent(savedMessage.id);
    void this.readReceiptsService.markAsDelivered(
      savedMessage.id,
      dto.room_id,
      receiver.user_id,
    );

    return savedMessage;
  }

  private async requireRoomMembership(
    userId: string,
    roomId: string,
  ): Promise<RoomMemberRow[]> {
    const response = await this.supabaseService
      .getClient()
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .limit(50);

    if (response.error) {
      throw new ServiceUnavailableException('Encrypted chat is unavailable');
    }

    const members = (response.data ?? []) as RoomMemberRow[];
    if (!members.some((member) => member.user_id === userId)) {
      throw new NotFoundException('Chat room was not found');
    }
    return members;
  }

  private async enforceSafetyBoundary(
    senderId: string,
    receiverId: string,
  ): Promise<void> {
    const [senderBlockedIds, receiverBlockedIds] = await Promise.all([
      this.safetyService.getBlockedAndBlockerIds(senderId),
      this.safetyService.getBlockedAndBlockerIds(receiverId),
    ]);
    if (
      senderBlockedIds.includes(receiverId) ||
      receiverBlockedIds.includes(senderId)
    ) {
      throw new ForbiddenException('You cannot send messages to this user');
    }
  }

  private async enforceInitialMessageFilters(
    senderId: string,
    receiverId: string,
    roomId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const countResult = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('sender_id', senderId);
    if (countResult.error) {
      throw new ServiceUnavailableException('Unable to verify message permissions');
    }
    if ((countResult.count ?? 0) > 0) return;

    const [receiverResult, senderResult] = await Promise.all([
      supabase
        .from('users')
        .select('message_filters')
        .eq('id', receiverId)
        .single(),
      supabase
        .from('users')
        .select('native_languages, age, gender')
        .eq('id', senderId)
        .single(),
    ]);
    if (receiverResult.error || senderResult.error) {
      throw new ServiceUnavailableException('Unable to verify message permissions');
    }

    const filters = receiverResult.data?.message_filters as
      | {
          age_min?: number;
          age_max?: number;
          allowed_native_languages?: string[];
          allowed_genders?: string[];
        }
      | null
      | undefined;
    if (!filters) return;

    const sender = senderResult.data as {
      native_languages?: string[] | null;
      age?: number | null;
      gender?: string | null;
    };
    const languages = sender.native_languages ?? [];
    if (
      filters.allowed_native_languages?.length &&
      languages.length > 0 &&
      !languages.some((language) => filters.allowed_native_languages?.includes(language))
    ) {
      throw new ForbiddenException('Initial message is not allowed by recipient settings');
    }
    if (
      typeof filters.age_min === 'number' &&
      typeof sender.age === 'number' &&
      sender.age < filters.age_min
    ) {
      throw new ForbiddenException('Initial message is not allowed by recipient settings');
    }
    if (
      typeof filters.age_max === 'number' &&
      typeof sender.age === 'number' &&
      sender.age > filters.age_max
    ) {
      throw new ForbiddenException('Initial message is not allowed by recipient settings');
    }
    if (
      filters.allowed_genders?.length &&
      sender.gender &&
      !filters.allowed_genders.includes(sender.gender)
    ) {
      throw new ForbiddenException('Initial message is not allowed by recipient settings');
    }
  }
}
