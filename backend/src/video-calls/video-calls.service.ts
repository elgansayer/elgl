import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  CreateOptions,
} from 'livekit-server-sdk';
import { randomUUID as uuidv4 } from 'crypto';
import { StartVideoCallDto, ListActiveRoomsQueryDto } from './dto/video-call.dto';

interface ActiveRoomEntry {
  roomName: string;
  creatorId: string;
  isVideo: boolean;
  maxParticipants: number;
  participants: string[];
  topic: string | null;
  languagePair: string | null;
  createdAt: Date;
}

@Injectable()
export class VideoCallsService {
  private roomService: RoomServiceClient;
  private readonly activeRooms = new Map<string, ActiveRoomEntry>();

  constructor(private configService: ConfigService) {
    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') as string,
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
    );
  }

  async createRoom(
    userId: string,
    dto?: StartVideoCallDto,
  ): Promise<{ token: string; room_name: string; is_video: boolean }> {
    const isVideo = dto?.is_video ?? true;
    const maxParticipants = dto?.max_participants ?? 2;
    const roomName = `video_${uuidv4()}`;

    const createOptions: CreateOptions = {
      name: roomName,
      emptyTimeout: 30,
      maxParticipants: Math.max(2, Math.min(maxParticipants, 50)),
    };

    await this.roomService.createRoom(createOptions);

    this.activeRooms.set(roomName, {
      roomName,
      creatorId: userId,
      isVideo,
      maxParticipants: createOptions.maxParticipants ?? 2,
      participants: [userId],
      topic: null,
      languagePair: null,
      createdAt: new Date(),
    });

    const token = await this.generateToken(userId, roomName, true);

    return { token, room_name: roomName, is_video: isVideo };
  }

  async joinRoom(
    userId: string,
    roomName: string,
  ): Promise<{ token: string; room_name: string; is_video: boolean }> {
    const room = this.activeRooms.get(roomName);
    if (!room) {
      throw new NotFoundException('Room not found or has ended.');
    }
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
    }
    const token = await this.generateToken(userId, roomName, true);
    return { token, room_name: roomName, is_video: room.isVideo };
  }

  async endRoom(
    userId: string,
    roomName: string,
  ): Promise<{ success: boolean; room_name: string }> {
    const room = this.activeRooms.get(roomName);
    if (!room) {
      throw new NotFoundException('Room not found.');
    }
    if (room.creatorId !== userId) {
      throw new ForbiddenException('Only the room creator can end the room.');
    }
    this.activeRooms.delete(roomName);
    try {
      await this.roomService.deleteRoom(roomName);
    } catch {
      // Room may already be deleted or inaccessible
    }
    return { success: true, room_name: roomName };
  }

  async listActiveRooms(
    query: ListActiveRoomsQueryDto,
  ): Promise<
    Array<{
      room_name: string;
      creator_id: string;
      is_video: boolean;
      participant_count: number;
      max_participants: number;
      topic: string | null;
      language_pair: string | null;
      created_at: string;
    }>
  > {
    let rooms = Array.from(this.activeRooms.values());

    if (query.type && query.type !== 'all') {
      if (query.type === 'classroom') {
        rooms = rooms.filter((r) => r.maxParticipants > 2);
      } else if (query.type === 'direct') {
        rooms = rooms.filter((r) => r.maxParticipants === 2);
      }
    }
    if (query.topic) {
      rooms = rooms.filter(
        (r) => r.topic?.toLowerCase() === query.topic!.toLowerCase(),
      );
    }
    if (query.language_pair) {
      rooms = rooms.filter(
        (r) =>
          r.languagePair?.toLowerCase() ===
          query.language_pair!.toLowerCase(),
      );
    }

    return rooms.map((r) => ({
      room_name: r.roomName,
      creator_id: r.creatorId,
      is_video: r.isVideo,
      participant_count: r.participants.length,
      max_participants: r.maxParticipants,
      topic: r.topic,
      language_pair: r.languagePair,
      created_at: r.createdAt.toISOString(),
    }));
  }

  async getActiveRoom(
    _userId: string,
    roomName: string,
  ): Promise<{
    room_name: string;
    creator_id: string;
    is_video: boolean;
    participant_count: number;
    max_participants: number;
    participants: Array<{ user_id: string; joined_at: string }>;
    topic: string | null;
    language_pair: string | null;
  }> {
    const room = this.activeRooms.get(roomName);
    if (!room) {
      throw new NotFoundException('Room not found.');
    }
    return {
      room_name: room.roomName,
      creator_id: room.creatorId,
      is_video: room.isVideo,
      participant_count: room.participants.length,
      max_participants: room.maxParticipants,
      participants: room.participants.map((p) => ({
        user_id: p,
        joined_at: room.createdAt.toISOString(),
      })),
      topic: room.topic,
      language_pair: room.languagePair,
    };
  }

  private async generateToken(
    userId: string,
    roomName: string,
    canPublish: boolean,
  ): Promise<string> {
    const at = new AccessToken(
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
      {
        identity: userId,
        ttl: '1h',
      },
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }
}
