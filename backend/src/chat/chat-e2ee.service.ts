import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  RegisterE2eeKeyDto,
  StoreRoomE2eeKeyDto,
} from './dto/register-e2ee-key.dto';

export interface UserE2eePublicKeyResponse {
  user_id: string;
  device_id: string;
  public_key: Record<string, unknown>;
}

export interface RoomE2eeKeyResponse {
  room_id: string;
  encrypted_key: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class ChatE2eeService {
  private readonly logger = new Logger(ChatE2eeService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Registers or updates a user public key used for end-to-end encryption.
   */
  async registerPublicKey(
    userId: string,
    dto: RegisterE2eeKeyDto,
  ): Promise<{ success: boolean; user_id: string; device_id: string }> {
    if (!userId) {
      throw new BadRequestException(
        'Authenticated user identifier is required',
      );
    }
    const deviceId = dto.device_id?.trim() || 'default';
    if (deviceId.length > 64) {
      throw new BadRequestException(
        'Device identifier must not exceed 64 characters',
      );
    }

    const privateKeyParams = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'k'];
    if (privateKeyParams.some((param) => param in dto.public_key)) {
      throw new BadRequestException(
        'Public key must not contain private key material',
      );
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('user_e2ee_keys').upsert(
      {
        user_id: userId,
        device_id: deviceId,
        public_key: dto.public_key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    );

    if (error) {
      this.logger.error(
        `Failed to register public key for user ${userId}: ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Failed to register encryption key',
      );
    }

    return {
      success: true,
      user_id: userId,
      device_id: deviceId,
    };
  }

  /**
   * Retrieves the public key for a given user and device.
   */
  async getPublicKey(
    userId: string,
    deviceId = 'default',
  ): Promise<UserE2eePublicKeyResponse> {
    if (!userId) {
      throw new BadRequestException('Target user identifier is required');
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('user_e2ee_keys')
      .select('user_id, device_id, public_key')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to retrieve public key for user ${userId}: ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Failed to retrieve encryption key',
      );
    }

    if (!data) {
      throw new NotFoundException('No public key registered for user');
    }

    if (!isRecord(data)) {
      throw new ServiceUnavailableException('Invalid key record');
    }

    return {
      user_id: typeof data['user_id'] === 'string' ? data['user_id'] : userId,
      device_id:
        typeof data['device_id'] === 'string' ? data['device_id'] : deviceId,
      public_key: isRecord(data['public_key']) ? data['public_key'] : {},
    };
  }

  /**
   * Stores an encrypted room key for an authorised member of a direct chat room.
   */
  async storeRoomKey(
    userId: string,
    roomId: string,
    dto: StoreRoomE2eeKeyDto,
  ): Promise<{ success: boolean }> {
    await this.requireRoomMembership(userId, roomId);

    const targetUserId = dto.target_user_id || userId;
    if (dto.target_user_id && dto.target_user_id !== userId) {
      const isTargetMember = await this.checkRoomMembership(
        dto.target_user_id,
        roomId,
      );
      if (!isTargetMember) {
        throw new BadRequestException(
          'Target user is not a member of this chat room',
        );
      }
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('chat_room_e2ee_keys').upsert(
      {
        room_id: roomId,
        user_id: targetUserId,
        encrypted_key: dto.encrypted_key,
      },
      { onConflict: 'room_id,user_id' },
    );

    if (error) {
      this.logger.error(
        `Failed to store room key for room ${roomId}: ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Failed to store room encryption key',
      );
    }

    return { success: true };
  }

  /**
   * Retrieves the encrypted room key for the authenticated user.
   */
  async getRoomKey(
    userId: string,
    roomId: string,
  ): Promise<RoomE2eeKeyResponse> {
    await this.requireRoomMembership(userId, roomId);

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_e2ee_keys')
      .select('room_id, encrypted_key')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to retrieve room key for room ${roomId}: ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Failed to retrieve room encryption key',
      );
    }

    if (!data) {
      throw new NotFoundException('Room encryption key not found');
    }

    if (!isRecord(data)) {
      throw new ServiceUnavailableException('Invalid room key record');
    }

    return {
      room_id: typeof data['room_id'] === 'string' ? data['room_id'] : roomId,
      encrypted_key:
        typeof data['encrypted_key'] === 'string' ? data['encrypted_key'] : '',
    };
  }

  private async checkRoomMembership(
    userId: string,
    roomId: string,
  ): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    return !error && !!data;
  }

  private async requireRoomMembership(
    userId: string,
    roomId: string,
  ): Promise<void> {
    const isMember = await this.checkRoomMembership(userId, roomId);
    if (!isMember) {
      throw new ForbiddenException(
        'You are not an authorised member of this chat room',
      );
    }
  }
}
