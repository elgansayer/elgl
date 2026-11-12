import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService, UsersRow } from '../supabase/supabase.service';

export interface ExchangeTimerParticipant {
  userId: string;
  language: string | null;
  turnsTaken: number;
}

export interface ExchangeTimerStatus {
  active: boolean;
  waitingForParticipant: boolean;
  reciprocal: boolean;
  roomName: string;
  turnDurationSeconds: number;
  turnIndex: number;
  currentSpeakerId: string | null;
  currentSpeakerLanguage: string | null;
  remainingSeconds: number;
  isCurrentSpeaker: boolean;
  participants: ExchangeTimerParticipant[];
}

interface StoredExchangeSession {
  roomName: string;
  participants: ExchangeTimerParticipant[];
  reciprocal: boolean;
  turnDurationSeconds: number;
  turnIndex: number;
  turnStartedAt: number | null;
  joinedParticipantIds: string[];
  createdAt: number;
}

const EXCHANGE_SESSION_PREFIX = 'video-calls:exchange:';
const EXCHANGE_SESSION_TTL_SECONDS = 2 * 60 * 60;
const DEFAULT_TURN_DURATION_SECONDS = 5 * 60;
const MIN_TURN_DURATION_SECONDS = 60;
const MAX_TURN_DURATION_SECONDS = 30 * 60;
const MAX_CONCURRENT_RETRIES = 3;
const ROOM_NAME_PATTERN =
  /^video_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface LanguageProfiles {
  callerLanguage: string | null;
  remoteLanguage: string | null;
  reciprocal: boolean;
}

@Injectable()
export class VideoExchangeTimerService {
  private readonly logger = new Logger(VideoExchangeTimerService.name);
  private readonly enabled: boolean;
  private readonly turnDurationSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const configuredEnabled =
      this.configService.get<string>('EXCHANGE_TIMERS_ENABLED') ?? 'true';
    this.enabled = configuredEnabled.toLowerCase() !== 'false';

    const configuredDuration = Number.parseInt(
      this.configService.get<string>('EXCHANGE_TURN_DURATION_SECONDS') ?? '',
      10,
    );
    this.turnDurationSeconds = Number.isFinite(configuredDuration)
      ? Math.min(
          Math.max(configuredDuration, MIN_TURN_DURATION_SECONDS),
          MAX_TURN_DURATION_SECONDS,
        )
      : DEFAULT_TURN_DURATION_SECONDS;
  }

  /**
   * Creates the reciprocal exchange session for a freshly created 1:1 call.
   *
   * Timer persistence is best-effort: a Redis outage must never prevent the
   * underlying call from starting. The media plane and E2EE key broker remain
   * the fail-closed paths.
   */
  async startSession(
    roomName: string,
    callerId: string,
    remoteUserId: string,
  ): Promise<void> {
    if (!this.enabled) return;
    this.assertRoomName(roomName);

    const profiles = await this.resolveLanguageProfiles(callerId, remoteUserId);
    const session: StoredExchangeSession = {
      roomName,
      participants: [
        {
          userId: callerId,
          language: profiles.callerLanguage,
          turnsTaken: 0,
        },
        {
          userId: remoteUserId,
          language: profiles.remoteLanguage,
          turnsTaken: 0,
        },
      ],
      reciprocal: profiles.reciprocal,
      turnDurationSeconds: this.turnDurationSeconds,
      turnIndex: 0,
      turnStartedAt: null,
      joinedParticipantIds: [],
      createdAt: Date.now(),
    };

    try {
      await this.supabaseService
        .getRedisClient()
        .setex(
          this.sessionKey(roomName),
          EXCHANGE_SESSION_TTL_SECONDS,
          JSON.stringify(session),
        );
    } catch {
      this.logger.error(
        `Unable to persist exchange timer session for room ${roomName}`,
      );
    }
  }

  /**
   * Records that a participant has received join material. The timer starts
   * only once both intended participants have joined, so the first speaker is
   * not penalised while waiting alone in the room.
   */
  async markParticipantJoined(roomName: string, userId: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.mutateSession(roomName, userId, (session) => {
        if (session.joinedParticipantIds.includes(userId)) {
          return null;
        }

        const joinedParticipantIds = [...session.joinedParticipantIds, userId];
        const bothJoined = session.participants.every((participant) =>
          joinedParticipantIds.includes(participant.userId),
        );

        return {
          ...session,
          joinedParticipantIds,
          turnStartedAt:
            bothJoined && session.turnStartedAt === null
              ? Date.now()
              : session.turnStartedAt,
        };
      });
    } catch (error) {
      this.logger.warn(
        `Unable to record exchange timer participation for room ${roomName}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async getStatus(
    roomName: string,
    userId: string,
  ): Promise<ExchangeTimerStatus> {
    if (!this.enabled) {
      return this.inactiveStatus(roomName);
    }
    this.assertRoomName(roomName);

    const now = Date.now();
    const session = await this.mutateSession(roomName, userId, (current) => {
      const rolled = this.applyElapsedTurns(current, now);
      return rolled === current ? null : rolled;
    });

    if (!session) {
      return this.inactiveStatus(roomName);
    }

    return this.toStatus(session, userId, Date.now());
  }

  async advanceTurn(
    roomName: string,
    userId: string,
    expectedTurnIndex: number,
  ): Promise<ExchangeTimerStatus> {
    if (!this.enabled) {
      return this.inactiveStatus(roomName);
    }
    this.assertRoomName(roomName);

    const now = Date.now();
    const session = await this.mutateSession(roomName, userId, (current) => {
      const rolled = this.applyElapsedTurns(current, now);

      if (rolled.turnStartedAt === null) {
        throw new BadRequestException('Exchange timer has not started');
      }

      if (rolled.turnIndex !== expectedTurnIndex) {
        if (expectedTurnIndex < rolled.turnIndex) {
          return null;
        }
        throw new BadRequestException('Turn has already advanced');
      }

      const currentSpeaker =
        rolled.participants[rolled.turnIndex % rolled.participants.length];
      if (currentSpeaker.userId !== userId) {
        throw new ForbiddenException(
          'Only the current speaker can end the turn',
        );
      }

      const participants = rolled.participants.map((participant) =>
        participant.userId === userId
          ? { ...participant, turnsTaken: participant.turnsTaken + 1 }
          : participant,
      );

      return {
        ...rolled,
        participants,
        turnIndex: rolled.turnIndex + 1,
        turnStartedAt: now,
      };
    });

    if (!session) {
      throw new ForbiddenException('Call is unavailable');
    }

    return this.toStatus(session, userId, Date.now());
  }

  private async resolveLanguageProfiles(
    callerId: string,
    remoteUserId: string,
  ): Promise<LanguageProfiles> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('id, native_languages, target_languages')
        .in('id', [callerId, remoteUserId]);

      if (error || !Array.isArray(data)) {
        throw new Error(error?.message ?? 'language profile lookup failed');
      }

      const profiles = new Map<string, UsersRow>();
      for (const row of data) {
        const profile = row as unknown as UsersRow;
        if (profile.id) {
          profiles.set(profile.id, profile);
        }
      }

      return this.chooseLanguages(
        profiles.get(callerId),
        profiles.get(remoteUserId),
      );
    } catch (error) {
      this.logger.warn(
        `Unable to resolve exchange languages for room participants: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return {
        callerLanguage: null,
        remoteLanguage: null,
        reciprocal: false,
      };
    }
  }

  private chooseLanguages(
    caller: UsersRow | undefined,
    remote: UsersRow | undefined,
  ): LanguageProfiles {
    const callerNatives = this.normaliseLanguages(caller?.native_languages);
    const callerTargets = this.normaliseLanguages(caller?.target_languages);
    const remoteNatives = this.normaliseLanguages(remote?.native_languages);
    const remoteTargets = this.normaliseLanguages(remote?.target_languages);

    const callerMatch = callerNatives.find((language) =>
      remoteTargets.includes(language),
    );
    const remoteMatch = remoteNatives.find((language) =>
      callerTargets.includes(language),
    );

    return {
      callerLanguage: callerMatch ?? callerNatives[0] ?? null,
      remoteLanguage: remoteMatch ?? remoteNatives[0] ?? null,
      reciprocal: Boolean(callerMatch && remoteMatch),
    };
  }

  private normaliseLanguages(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((language): language is string => typeof language === 'string')
      .map((language) => language.trim().toLowerCase())
      .filter((language) => language.length > 0);
  }

  private applyElapsedTurns(
    session: StoredExchangeSession,
    now: number,
  ): StoredExchangeSession {
    if (session.turnStartedAt === null) return session;

    const durationMs = session.turnDurationSeconds * 1000;
    const elapsed = now - session.turnStartedAt;
    if (elapsed < durationMs) return session;

    const elapsedTurns = Math.floor(elapsed / durationMs);
    const participants = session.participants.map((participant) => ({
      ...participant,
    }));
    let turnIndex = session.turnIndex;

    for (let turn = 0; turn < elapsedTurns; turn += 1) {
      const speakerIndex = turnIndex % participants.length;
      participants[speakerIndex] = {
        ...participants[speakerIndex],
        turnsTaken: participants[speakerIndex].turnsTaken + 1,
      };
      turnIndex += 1;
    }

    return {
      ...session,
      participants,
      turnIndex,
      turnStartedAt: session.turnStartedAt + elapsedTurns * durationMs,
    };
  }

  private async mutateSession(
    roomName: string,
    userId: string,
    mutate: (session: StoredExchangeSession) => StoredExchangeSession | null,
  ): Promise<StoredExchangeSession | null> {
    this.assertRoomName(roomName);
    const redis = this.supabaseService.getRedisClient();
    const key = this.sessionKey(roomName);

    for (let attempt = 0; attempt < MAX_CONCURRENT_RETRIES; attempt += 1) {
      try {
        await redis.watch(key);
        const raw = await redis.get(key);

        if (!raw) {
          await redis.unwatch();
          return null;
        }

        const session = this.parseSession(raw);
        if (!session) {
          await redis.unwatch();
          return null;
        }

        if (
          !session.participants.some(
            (participant) => participant.userId === userId,
          )
        ) {
          await redis.unwatch();
          throw new ForbiddenException('Call is unavailable');
        }

        const updated = mutate(session);
        if (!updated) {
          await redis.unwatch();
          return session;
        }

        const result = await redis
          .multi()
          .set(key, JSON.stringify(updated), 'EX', EXCHANGE_SESSION_TTL_SECONDS)
          .exec();

        if (result) {
          return updated;
        }
      } catch (error) {
        try {
          await redis.unwatch();
        } catch {
          // The connection may already be unavailable; the original error is authoritative.
        }

        if (
          error instanceof ForbiddenException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        this.logger.error(
          `Exchange timer session update failed for room ${roomName}`,
        );
        throw new ServiceUnavailableException(
          'Exchange timer is temporarily unavailable',
        );
      }
    }

    throw new ServiceUnavailableException(
      'Exchange timer is temporarily unavailable',
    );
  }

  private parseSession(raw: string): StoredExchangeSession | null {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredExchangeSession>;
      if (
        typeof parsed.roomName !== 'string' ||
        !Array.isArray(parsed.participants) ||
        parsed.participants.length !== 2 ||
        !parsed.participants.every(
          (participant) =>
            participant &&
            typeof participant.userId === 'string' &&
            (typeof participant.language === 'string' ||
              participant.language === null) &&
            typeof participant.turnsTaken === 'number',
        ) ||
        typeof parsed.turnDurationSeconds !== 'number' ||
        !Number.isFinite(parsed.turnDurationSeconds) ||
        typeof parsed.turnIndex !== 'number' ||
        !Number.isInteger(parsed.turnIndex) ||
        parsed.turnIndex < 0 ||
        (parsed.turnStartedAt !== null &&
          (typeof parsed.turnStartedAt !== 'number' ||
            !Number.isFinite(parsed.turnStartedAt))) ||
        !Array.isArray(parsed.joinedParticipantIds) ||
        !parsed.joinedParticipantIds.every(
          (participantId) => typeof participantId === 'string',
        )
      ) {
        return null;
      }

      return {
        roomName: parsed.roomName,
        participants: parsed.participants,
        reciprocal: parsed.reciprocal === true,
        turnDurationSeconds: parsed.turnDurationSeconds,
        turnIndex: parsed.turnIndex,
        turnStartedAt: parsed.turnStartedAt ?? null,
        joinedParticipantIds: parsed.joinedParticipantIds,
        createdAt:
          typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      };
    } catch {
      return null;
    }
  }

  private toStatus(
    session: StoredExchangeSession,
    userId: string,
    now: number,
  ): ExchangeTimerStatus {
    const active = session.turnStartedAt !== null;
    const currentSpeaker = active
      ? session.participants[session.turnIndex % session.participants.length]
      : null;
    const remainingSeconds =
      active && session.turnStartedAt !== null
        ? Math.max(
            0,
            Math.min(
              session.turnDurationSeconds,
              Math.ceil(
                (session.turnStartedAt +
                  session.turnDurationSeconds * 1000 -
                  now) /
                  1000,
              ),
            ),
          )
        : 0;

    return {
      active,
      waitingForParticipant: !active,
      reciprocal: session.reciprocal,
      roomName: session.roomName,
      turnDurationSeconds: session.turnDurationSeconds,
      turnIndex: session.turnIndex,
      currentSpeakerId: currentSpeaker?.userId ?? null,
      currentSpeakerLanguage: currentSpeaker?.language ?? null,
      remainingSeconds,
      isCurrentSpeaker: currentSpeaker?.userId === userId,
      participants: session.participants.map((participant) => ({
        userId: participant.userId,
        language: participant.language,
        turnsTaken: participant.turnsTaken,
      })),
    };
  }

  private inactiveStatus(roomName: string): ExchangeTimerStatus {
    return {
      active: false,
      waitingForParticipant: false,
      reciprocal: false,
      roomName,
      turnDurationSeconds: this.turnDurationSeconds,
      turnIndex: 0,
      currentSpeakerId: null,
      currentSpeakerLanguage: null,
      remainingSeconds: 0,
      isCurrentSpeaker: false,
      participants: [],
    };
  }

  private sessionKey(roomName: string): string {
    return `${EXCHANGE_SESSION_PREFIX}${roomName}`;
  }

  private assertRoomName(roomName: string): void {
    if (!ROOM_NAME_PATTERN.test(roomName)) {
      throw new BadRequestException('Invalid call room');
    }
  }
}
