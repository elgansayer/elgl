import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { randomUUID as uuidv4 } from 'crypto';
import * as crypto from 'crypto';

@Injectable()
export class CallsService {
  private livekitHost: string;

  // Active calls per user (userId -> (roomName -> { roomName, isHeld, e2eeKey, calleeToken }))
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
        calleeToken: string | null;
        isVideo: boolean;
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

  constructor(
    private configService: ConfigService,
    @InjectPinoLogger(CallsService.name)
    private readonly logger: PinoLogger,
  ) {
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
      calleeToken: string | null;
      isVideo: boolean;
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
    calleeToken: string | null = null,
    isVideo: boolean = true,
  ): void {
    const userCalls = this.ensureUser(userId);
    userCalls.set(roomName, {
      roomName,
      isHeld: false,
      e2eeKey: e2eeKey ?? null,
      participantLimit,
      isGroup,
      calleeToken,
      isVideo,
    });
  }

  private generateE2eeKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /* ---------- Public API for hold / resume / list ---------- */

  getActiveCalls(userId: string): Array<{
    room_name: string;
    is_held: boolean;
    e2ee_key: string | null;
    is_video: boolean;
    participant_limit: number | null;
    is_group: boolean;
    callee_token: string | null;
  }> {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls) return [];
    return Array.from(userCalls.values()).map((call) => ({
      room_name: call.roomName,
      is_held: call.isHeld,
      e2ee_key: call.e2eeKey,
      is_video: call.isVideo,
      participant_limit: call.participantLimit,
      is_group: call.isGroup,
      callee_token: call.calleeToken,
    }));
  }

  getActiveCall(
    userId: string,
    roomName: string,
  ): {
    room_name: string;
    is_held: boolean;
    e2ee_key: string | null;
    is_video: boolean;
    participant_limit: number | null;
    is_group: boolean;
    callee_token: string | null;
  } {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      throw new BadRequestException('Call not found');
    }
    const call = userCalls.get(roomName)!;
    return {
      room_name: call.roomName,
      is_held: call.isHeld,
      e2ee_key: call.e2eeKey,
      is_video: call.isVideo,
      participant_limit: call.participantLimit,
      is_group: call.isGroup,
      callee_token: call.calleeToken,
    };
  }

  holdCall(userId: string, roomName: string): void {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      this.logger.warn(
        { userId, roomName },
        `Hold failed: call "${roomName}" not found for user ${userId}`,
      );
      throw new BadRequestException('Call not found');
    }
    userCalls.get(roomName)!.isHeld = true;
    this.logger.info(
      { userId, roomName },
      `Call "${roomName}" put on hold by user ${userId}`,
    );
  }

  resumeCall(userId: string, roomName: string): void {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      this.logger.warn(
        { userId, roomName },
        `Resume failed: call "${roomName}" not found for user ${userId}`,
      );
      throw new BadRequestException('Call not found');
    }
    userCalls.get(roomName)!.isHeld = false;
    this.logger.info(
      { userId, roomName },
      `Call "${roomName}" resumed by user ${userId}`,
    );
  }

  leaveCall(userId: string, roomName: string): void {
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(roomName)) {
      this.logger.warn(
        { userId, roomName },
        `Leave failed: call "${roomName}" not found for user ${userId}`,
      );
      throw new BadRequestException('Call not found');
    }
    userCalls.delete(roomName);
    if (userCalls.size === 0) {
      this.activeCalls.delete(userId);
    }
    this.logger.info(
      { userId, roomName },
      `User ${userId} left call "${roomName}"`,
    );
  }

  /* ---------- Call‑waiting ---------- */

  getWaitingCalls(userId: string): Array<{
    room_name: string;
    callee_token: string;
    e2ee_key: string;
    is_video: boolean;
  }> {
    const waitingList = this.waitingCalls.get(userId) || [];
    return waitingList.map((w) => ({
      room_name: w.roomName,
      callee_token: w.calleeToken,
      e2ee_key: w.e2eeKey,
      is_video: w.isVideo,
    }));
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
    // Put any current active calls on hold before accepting the waiting call.
    const userCalls = this.activeCalls.get(userId);
    if (userCalls) {
      for (const activeCall of userCalls.values()) {
        activeCall.isHeld = true;
      }
    }
    waitingList.splice(idx, 1);
    if (waitingList.length === 0) {
      this.waitingCalls.delete(userId);
    }
    this.registerParticipant(
      userId,
      callInfo.roomName,
      callInfo.e2eeKey,
      null,
      false,
      callInfo.calleeToken,
      callInfo.isVideo,
    );
  }

  /* ---------- Switching between calls ---------- */

  switchCall(
    userId: string,
    currentRoomName: string,
    targetRoomName: string,
  ): {
    room_name: string;
    callee_token: string;
    e2ee_key: string;
    is_video: boolean;
    held_call_room_name: string;
    success: boolean;
  } {
    if (currentRoomName === targetRoomName) {
      throw new BadRequestException('Cannot switch to the same call');
    }
    const userCalls = this.activeCalls.get(userId);
    if (!userCalls || !userCalls.has(currentRoomName)) {
      throw new BadRequestException('Call not found');
    }
    const waitingList = this.waitingCalls.get(userId);
    if (!waitingList || waitingList.length === 0) {
      throw new BadRequestException('No waiting calls for this user');
    }
    const idx = waitingList.findIndex((w) => w.roomName === targetRoomName);
    if (idx === -1) {
      throw new BadRequestException('Waiting call not found');
    }
    const waitingCall = waitingList[idx];

    // Put the current active call on hold
    userCalls.get(currentRoomName)!.isHeld = true;

    // Remove the target from waiting queue and register it as active
    waitingList.splice(idx, 1);
    if (waitingList.length === 0) {
      this.waitingCalls.delete(userId);
    }
    this.registerParticipant(
      userId,
      waitingCall.roomName,
      waitingCall.e2eeKey,
      null,
      false,
      waitingCall.calleeToken,
      waitingCall.isVideo,
    );

    return {
      room_name: waitingCall.roomName,
      callee_token: waitingCall.calleeToken,
      e2ee_key: waitingCall.e2eeKey,
      is_video: waitingCall.isVideo,
      held_call_room_name: currentRoomName,
      success: true,
    };
  }

  /* ---------- Existing call-creation methods (updated) ---------- */

  async initiateCall(
    callerId: string,
    calleeId: string,
    isVideo: boolean = true,
  ) {
    const roomName = `call_${uuidv4()}`;
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_SECRET');
    if (!apiKey || !apiSecret) {
      this.logger.error(
        { callerId, calleeId },
        'Cannot initiate call: LiveKit credentials not configured',
      );
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_SECRET must be configured');
    }

    // Create the room for the 1:1 call
    try {
      const roomService = new RoomServiceClient(
        this.livekitHost,
        apiKey,
        apiSecret,
      );
      await roomService.createRoom({
        name: roomName,
        maxParticipants: 2,
      });
    } catch (error) {
      this.logger.error(
        { error, roomName, callerId, calleeId },
        `Failed to create LiveKit room for call between ${callerId} and ${calleeId}`,
      );
      throw error;
    }

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
      this.registerParticipant(
        callerId,
        roomName,
        e2eeKey,
        null,
        false,
        null,
        isVideo,
      );

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

      this.logger.info(
        { roomName, callerId, calleeId, isVideo, waiting: true },
        `Call "${roomName}" initiated, callee ${calleeId} busy - queued as waiting`,
      );

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
    this.registerParticipant(
      callerId,
      roomName,
      e2eeKey,
      null,
      false,
      null,
      isVideo,
    );
    this.registerParticipant(
      calleeId,
      roomName,
      e2eeKey,
      null,
      false,
      null,
      isVideo,
    );

    this.logger.info(
      { roomName, callerId, calleeId, isVideo, waiting: false },
      `Call "${roomName}" initiated and connected between ${callerId} and ${calleeId}`,
    );

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
      this.logger.warn(
        { callerId, participantLimit: effectiveLimit },
        `Group call creation failed: invalid participant_limit ${effectiveLimit}`,
      );
      throw new BadRequestException(
        `participant_limit must be an integer greater than or equal to 2`,
      );
    }

    if (!participantIds.includes(callerId)) {
      participantIds.unshift(callerId);
    }

    if (participantIds.length > effectiveLimit) {
      this.logger.warn(
        { callerId, count: participantIds.length, limit: effectiveLimit },
        `Group call creation failed: participant count (${participantIds.length}) exceeds limit (${effectiveLimit})`,
      );
      throw new BadRequestException(
        `Number of participants (${participantIds.length}) exceeds the limit (${effectiveLimit})`,
      );
    }

    const roomName = `group_${uuidv4()}`;
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_SECRET');
    if (!apiKey || !apiSecret) {
      this.logger.error(
        { callerId },
        'Cannot create group call: LiveKit credentials not configured',
      );
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_SECRET must be configured');
    }

    // Create the room with a maximum participant limit
    try {
      const roomService = new RoomServiceClient(
        this.livekitHost,
        apiKey,
        apiSecret,
      );
      await roomService.createRoom({
        name: roomName,
        maxParticipants: effectiveLimit,
      });
    } catch (error) {
      this.logger.error(
        { error, roomName, callerId, participantCount: participantIds.length },
        `Failed to create LiveKit group room "${roomName}"`,
      );
      throw error;
    }

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
      this.registerParticipant(
        pid,
        roomName,
        e2eeKey,
        effectiveLimit,
        true,
        null,
        true,
      );
    }

    this.logger.info(
      {
        roomName,
        callerId,
        participantCount: participantIds.length,
        limit: effectiveLimit,
      },
      `Group call "${roomName}" created with ${participantIds.length} participants`,
    );

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
