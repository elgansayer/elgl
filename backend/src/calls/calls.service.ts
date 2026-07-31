import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class CallsService {
  private livekitHost: string;

  // Active calls per user (userId -> (roomName -> { roomName, isHeld, e2eeKey }))
  private readonly activeCalls: Map<
    string,
    Map<
      string,
      {
        roomName: string;
        isHeld: boolean;
        e2eeKey: string | null;
        participantLimit: number | null;
        isGroup: boolean;
      }
    >
  > = new Map();

  // Call‑waiting queue: userId -> list of calls where the user is the callee
  // and hasn't yet answered.
  private readonly waitingCalls: Map<
    string,
    Array<{
      roomName: string;
      calleeToken: string;
      e2eeKey: string;
      isVideo: boolean;
    }>
  > = new Map();

  constructor(private configService: ConfigService) {
    this.livekitHost =
      this.configService.get<string>('LIVEKIT_URL') || 'http://localhost:7880';
  }

  /* ---------- Internal helpers for active-call tracking ---------- */

  private ensureUser(userId: string): Map<
    string,
    {
      roomName: string;
      isHeld: boolean;
      e2eeKey: string | null;
      participantLimit: number | null;
      isGroup: boolean;
    }
  > {
    if (!this.activeCalls.has(userId)) {
      this.activeCalls.set(userId, new Map());
    }
    return this.activeCalls.get(userId)!;
  }

  private registerParticipant(
    userId: string,
    roomName: string,
    e2eeKey?: string,
    participantLimit: number | null = null,
    isGroup: boolean = false,
  ): void {
    const userCalls = this.ensureUser(userId);
    userCalls.set(roomName, {
      roomName,
      isHeld: false,
      e2eeKey: e2eeKey ?? null,
      participantLimit,
      isGroup,
    });
  }

  private generateE2eeKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /* ---------- Public API for hold / resume / list ---------- */

  getActiveCalls(userId: string): Array<{
    roomName: string;
    isHeld: boolean;
    e2eeKey: string | null;
    participant_limit: number | null;
    is_group: boolean;
  }> {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls) return [];
    return Array.from(userCalls.values()).map((call) => ({
      roomName: call.roomName,
      isHeld: call.isHeld,
      e2eeKey: call.e2eeKey,
      participant_limit: call.participantLimit,
      is_group: call.isGroup,
    }));
  }

  getActiveCall(
    userId: string,
    roomName: string,
  ): {
    roomName: string;
    isHeld: boolean;
    e2eeKey: string | null;
    participant_limit: number | null;
    is_group: boolean;
  } {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      throw new BadRequestException('Call not found');
    }
    const call = userCalls.get(roomName)!;
    return {
      roomName: call.roomName,
      isHeld: call.isHeld,
      e2eeKey: call.e2eeKey,
      participant_limit: call.participantLimit,
      is_group: call.isGroup,
    };
  }

  holdCall(userId: string, roomName: string): void {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      throw new BadRequestException('Call not found');
    }
    userCalls.get(roomName)!.isHeld = true;
  }

  resumeCall(userId: string, roomName: string): void {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      throw new BadRequestException('Call not found');
    }
    userCalls.get(roomName)!.isHeld = false;
  }

  leaveCall(userId: string, roomName: string): void {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      throw new BadRequestException('Call not found');
    }
    userCalls.delete(roomName);
    if (userCalls.size === 0) {
      this.activeCalls.delete(userId);
    }
  }

  /* ---------- Call‑waiting ---------- */

  getWaitingCalls(userId: string): Array<{
    roomName: string;
    calleeToken: string;
    e2eeKey: string;
    isVideo: boolean;
  }> {
    return this.waitingCalls.get(userId) || [];
  }

  acceptWaitingCall(userId: string, roomName: string): void {
    const waitingList = this.waitingCalls.get(userId);
    if (!waitingList) {
      throw new BadRequestException('No waiting calls for this user');
    }
    const idx = waitingList.findIndex((w) => w.roomName === roomName);
    if (idx === -1) {
      throw new BadRequestException('Waiting call not found');
    }
    const callInfo = waitingList[idx];
    // Move the call from waiting to active
    waitingList.splice(idx, 1);
    if (waitingList.length === 0) {
      this.waitingCalls.delete(userId);
    }
    this.registerParticipant(userId, callInfo.roomName, callInfo.e2eeKey);
  }

  /* ---------- Existing call-creation methods (updated) ---------- */

  async initiateCall(
    callerId: string,
    calleeId: string,
    isVideo: boolean = true,
  ) {
    const roomName = `call_${uuidv4()}`;
    const apiKey =
      this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const apiSecret =
      this.configService.get<string>('LIVEKIT_SECRET') || 'secret';

    // Generate a random 32‑byte key for end‑to‑end encryption
    const e2eeKey = this.generateE2eeKey();
    // Embed the key and video flag in token metadata so the client can read it
    const metadata = JSON.stringify({ e2eeKey, isVideo });

    const generateToken = (identity: string): Promise<string> => {
      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        metadata,
      });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });
      return at.toJwt();
    };

    const [callerToken, calleeToken] = await Promise.all([
      generateToken(callerId),
      generateToken(calleeId),
    ]);

    // Determine if the callee is already in an active call (any room)
    const isBusy =
      this.activeCalls.has(calleeId) &&
      this.activeCalls.get(calleeId)!.size > 0;

    if (isBusy) {
      // Callee is busy; store the call as a waiting call instead of registering
      // them immediately.  The caller is registered right away.
      this.registerParticipant(callerId, roomName, e2eeKey);

      const waitingEntry = {
        roomName,
        calleeToken,
        e2eeKey,
        isVideo,
      };
      if (!this.waitingCalls.has(calleeId)) {
        this.waitingCalls.set(calleeId, []);
      }
      this.waitingCalls.get(calleeId)!.push(waitingEntry);

      return {
        room_name: roomName,
        caller_token: callerToken,
        callee_token: calleeToken,
        e2ee_key: e2eeKey,
        is_video: isVideo,
        call_id: uuidv4(),
        waiting: true,
        encryption: 'e2ee',
      };
    }

    // Callee is free; register both participants as usual
    this.registerParticipant(callerId, roomName, e2eeKey);
    this.registerParticipant(calleeId, roomName, e2eeKey);

    return {
      room_name: roomName,
      caller_token: callerToken,
      callee_token: calleeToken,
      e2ee_key: e2eeKey,
      is_video: isVideo,
      call_id: uuidv4(),
      waiting: false,
      encryption: 'e2ee',
    };
  }

  async createGroupCall(
    callerId: string,
    participantIds: string[],
    participantLimit?: number,
  ) {
    const effectiveLimit = participantLimit ?? 10;

    if (!Number.isInteger(effectiveLimit) || effectiveLimit < 2) {
      throw new BadRequestException(
        `participant_limit must be an integer greater than or equal to 2`,
      );
    }

    if (!participantIds.includes(callerId)) {
      participantIds.unshift(callerId);
    }

    if (participantIds.length > effectiveLimit) {
      throw new BadRequestException(
        `Number of participants (${participantIds.length}) exceeds the limit (${effectiveLimit})`,
      );
    }

    const roomName = `group_${uuidv4()}`;
    const apiKey =
      this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const apiSecret =
      this.configService.get<string>('LIVEKIT_SECRET') || 'secret';

    // Create the room with a maximum participant limit
    const roomService = new RoomServiceClient(
      this.livekitHost,
      apiKey,
      apiSecret,
    );
    await roomService.createRoom({
      name: roomName,
      maxParticipants: effectiveLimit,
    });

    const e2eeKey = this.generateE2eeKey();
    const metadata = JSON.stringify({
      e2eeKey,
      isVideo: true,
      isGroup: true,
      participantLimit: effectiveLimit,
    });

    const generateToken = async (identity: string): Promise<string> => {
      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        metadata,
      });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });
      return await at.toJwt();
    };

    const tokens = await Promise.all(participantIds.map(generateToken));

    // Track the newly created group call for every participant
    for (const pid of participantIds) {
      this.registerParticipant(pid, roomName, e2eeKey, effectiveLimit, true);
    }

    return {
      room_name: roomName,
      tokens,
      e2ee_key: e2eeKey,
      is_video: true,
      call_id: uuidv4(),
      participant_limit: effectiveLimit,
      encryption: 'e2ee',
    };
  }
}
