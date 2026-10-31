import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { NlpService } from '../nlp/nlp.service';
import {
  SpeechTranscriptionResult,
  SpeechTranscriptionService,
} from '../nlp/speech-transcription.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CentrifugoService } from './centrifugo.service';
import {
  ChatMessage,
  VoiceTranscriptionStatus,
} from './interfaces/chat-message.interface';

const MAX_TRANSCRIPTION_ATTEMPTS = 4;
const MAX_STORED_TRANSCRIPT_CHARS = 100_000;
const PROCESSING_STALE_MS = 15 * 60 * 1000;
const QUEUE_BATCH_SIZE = 5;

@Injectable()
export class ChatVoiceTranscriptionService {
  private readonly logger = new Logger(ChatVoiceTranscriptionService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly nlpService: NlpService,
    private readonly speechTranscription: SpeechTranscriptionService,
    private readonly usersService: UsersService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

  async requestTranscription(
    userId: string,
    messageId: string,
  ): Promise<ChatMessage> {
    const message = await this.loadMessage(messageId);
    await this.assertCanTranscribe(userId, message);

    const status = this.statusOf(message);
    if (
      status === 'ready' ||
      status === 'empty' ||
      status === 'pending' ||
      status === 'processing'
    ) {
      return message;
    }

    if (!this.speechTranscription.isConfigured()) {
      return this.updateUnavailable(message, status);
    }

    const profile = await this.usersService.getProfile(userId);
    await this.nlpService.checkRateLimit(userId, profile?.is_vip ?? false);

    const now = new Date().toISOString();
    const { data: queued, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .update({
        voice_transcription_status: 'pending',
        voice_transcription_attempts: 0,
        voice_transcription_requested_at: now,
        voice_transcription_last_attempt_at: null,
        voice_transcription_next_retry_at: now,
        voice_transcribed_at: null,
        voice_transcription_error_code: null,
        voice_transcript: null,
      })
      .eq('id', message.id)
      .eq('voice_transcription_status', status)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(
        'Voice transcription could not be queued',
      );
    }
    if (!queued) {
      return this.loadMessage(message.id);
    }

    await this.publishMessage(queued);
    this.scheduleProcessing(message.id);
    return queued;
  }

  @Cron('*/30 * * * * *', { name: 'chat-voice-transcription-worker' })
  async processPendingTranscriptions(): Promise<void> {
    const client = this.supabaseService.getClient();
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() - PROCESSING_STALE_MS,
    ).toISOString();

    await client
      .from('chat_messages')
      .update({
        voice_transcription_status: 'failed',
        voice_transcription_next_retry_at: now.toISOString(),
        voice_transcription_error_code: 'worker_interrupted',
      })
      .eq('voice_transcription_status', 'processing')
      .lt('voice_transcription_last_attempt_at', staleBefore);

    const { data, error } = await client
      .from('chat_messages')
      .select('*')
      .in('voice_transcription_status', ['pending', 'failed'])
      .lt('voice_transcription_attempts', MAX_TRANSCRIPTION_ATTEMPTS)
      .or(
        `voice_transcription_next_retry_at.is.null,voice_transcription_next_retry_at.lte.${now.toISOString()}`,
      )
      .order('voice_transcription_requested_at', { ascending: true })
      .limit(QUEUE_BATCH_SIZE);
    if (error || !data) return;

    const due = data.filter((message) => {
      const attempts = message.voice_transcription_attempts ?? 0;
      if (attempts >= MAX_TRANSCRIPTION_ATTEMPTS) return false;
      if (message.is_deleted_for_everyone || this.isExpired(message)) {
        return false;
      }
      const nextRetry = message.voice_transcription_next_retry_at;
      return !nextRetry || new Date(nextRetry).getTime() <= now.getTime();
    });
    await Promise.allSettled(
      due.map((message) => this.processMessage(message.id)),
    );
  }

  async processMessage(messageId: string): Promise<void> {
    if (this.inFlight.has(messageId)) return;
    this.inFlight.add(messageId);

    try {
      const message = await this.loadMessage(messageId);
      const status = this.statusOf(message);
      if (status !== 'pending' && status !== 'failed') return;
      if (message.is_deleted_for_everyone || this.isExpired(message)) return;

      const attempts = message.voice_transcription_attempts ?? 0;
      if (attempts >= MAX_TRANSCRIPTION_ATTEMPTS) return;

      const attempt = attempts + 1;
      const startedAt = new Date().toISOString();
      const { data: claimed, error } = await this.supabaseService
        .getClient()
        .from('chat_messages')
        .update({
          voice_transcription_status: 'processing',
          voice_transcription_attempts: attempt,
          voice_transcription_last_attempt_at: startedAt,
          voice_transcription_next_retry_at: null,
          voice_transcription_error_code: null,
        })
        .eq('id', message.id)
        .eq('voice_transcription_status', status)
        .eq('voice_transcription_attempts', attempts)
        .select('*')
        .maybeSingle();
      if (error || !claimed) return;

      await this.publishMessage(claimed);

      let result: SpeechTranscriptionResult;
      if (!this.isTrustedVoiceNoteUrl(claimed)) {
        result = { status: 'failed', errorCode: 'untrusted_media_url' };
      } else if (!claimed.media_url) {
        result = { status: 'failed', errorCode: 'media_url_missing' };
      } else {
        result = await this.speechTranscription.transcribeAudioUrl(
          claimed.media_url,
        );
      }

      await this.completeAttempt(claimed, attempt, startedAt, result);
    } finally {
      this.inFlight.delete(messageId);
    }
  }

  private async assertCanTranscribe(
    userId: string,
    message: ChatMessage,
  ): Promise<void> {
    const { data: membership, error } = await this.supabaseService
      .getClient()
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', message.room_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException(
        'Room membership could not be verified',
      );
    }
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }
    if (message.message_type !== 'voice' || !message.media_url) {
      throw new BadRequestException(
        'Only stored voice messages can be transcribed',
      );
    }
    if (message.is_encrypted) {
      throw new BadRequestException(
        'Encrypted voice messages cannot be transcribed by the server',
      );
    }
    if (message.is_deleted_for_everyone) {
      throw new NotFoundException('Message not found');
    }
    if (message.deleted_for_user_ids?.includes(userId)) {
      throw new NotFoundException('Message not found');
    }
    if (this.isExpired(message)) {
      throw new NotFoundException('Message not found');
    }
  }

  private isExpired(message: ChatMessage): boolean {
    if (!message.expires_at) return false;
    const expiryMs = Date.parse(message.expires_at);
    return !Number.isNaN(expiryMs) && expiryMs <= Date.now();
  }

  private async updateUnavailable(
    message: ChatMessage,
    previousStatus: VoiceTranscriptionStatus,
  ): Promise<ChatMessage> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .update({
        voice_transcription_status: 'unavailable',
        voice_transcription_error_code: 'provider_unavailable',
        voice_transcription_next_retry_at: null,
      })
      .eq('id', message.id)
      .eq('voice_transcription_status', previousStatus)
      .select('*')
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException(
        'Voice transcription state could not be saved',
      );
    }
    const updated = data ?? (await this.loadMessage(message.id));
    await this.publishMessage(updated);
    return updated;
  }

  private async completeAttempt(
    message: ChatMessage,
    attempt: number,
    startedAt: string,
    result: SpeechTranscriptionResult,
  ): Promise<void> {
    const completedAt = new Date();
    const shouldRetry =
      result.status === 'failed' && attempt < MAX_TRANSCRIPTION_ATTEMPTS;
    const retryAt = shouldRetry
      ? new Date(
          completedAt.getTime() + 30_000 * Math.pow(4, attempt - 1),
        ).toISOString()
      : null;
    const status: VoiceTranscriptionStatus = result.status;
    const transcript =
      result.status === 'ready'
        ? result.transcript.slice(0, MAX_STORED_TRANSCRIPT_CHARS)
        : null;
    const errorCode =
      result.status === 'failed'
        ? result.errorCode
        : result.status === 'unavailable'
          ? 'provider_unavailable'
          : null;

    const { data: updated, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .update({
        voice_transcription_status: status,
        voice_transcript: transcript,
        voice_transcribed_at:
          status === 'ready' || status === 'empty'
            ? completedAt.toISOString()
            : null,
        voice_transcription_next_retry_at: retryAt,
        voice_transcription_error_code: errorCode,
      })
      .eq('id', message.id)
      .eq('voice_transcription_status', 'processing')
      .eq('voice_transcription_attempts', attempt)
      .eq('voice_transcription_last_attempt_at', startedAt)
      .select('*')
      .maybeSingle();
    if (error || !updated) return;

    await this.publishMessage(updated);
    if (status === 'ready' || status === 'empty') {
      this.logger.log({
        event: 'chat_voice_transcription_completed',
        messageId: message.id,
        status,
      });
    } else {
      this.logger.warn({
        event: 'chat_voice_transcription_attempt_failed',
        messageId: message.id,
        status,
        errorCode: errorCode ?? 'unknown',
      });
    }
  }

  private isTrustedVoiceNoteUrl(message: ChatMessage): boolean {
    if (!message.media_url || !message.sender_id) return false;
    if (!/^[a-zA-Z0-9_-]+$/.test(message.sender_id)) return false;

    const configuredBase = this.configService
      .get<string>('CLOUDFLARE_R2_PUBLIC_URL')
      ?.trim();
    if (!configuredBase) return false;

    try {
      const baseUrl = new URL(configuredBase);
      const mediaUrl = new URL(message.media_url);
      const basePath = baseUrl.pathname.replace(/\/+$/, '');
      const expectedPrefix = `${basePath}/voice-notes/${encodeURIComponent(message.sender_id)}/`;
      if (
        mediaUrl.protocol !== 'https:' ||
        mediaUrl.origin !== baseUrl.origin ||
        Boolean(mediaUrl.username) ||
        Boolean(mediaUrl.password) ||
        Boolean(mediaUrl.search) ||
        Boolean(mediaUrl.hash) ||
        !mediaUrl.pathname.startsWith(expectedPrefix)
      ) {
        return false;
      }

      const filename = mediaUrl.pathname.slice(expectedPrefix.length);
      return (
        filename.length > 0 &&
        !filename.includes('/') &&
        !filename.includes('\\') &&
        !filename.includes('%') &&
        !filename.includes('..') &&
        /^[a-zA-Z0-9_.-]+$/.test(filename)
      );
    } catch {
      return false;
    }
  }

  private async loadMessage(messageId: string): Promise<ChatMessage> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException('Message could not be loaded');
    }
    if (!data) {
      throw new NotFoundException('Message not found');
    }
    return data;
  }

  private statusOf(message: ChatMessage): VoiceTranscriptionStatus {
    return message.voice_transcription_status ?? 'not_requested';
  }

  private async publishMessage(message: ChatMessage): Promise<void> {
    await this.centrifugoService.publish(`chat:${message.room_id}`, {
      message,
    });
  }

  private scheduleProcessing(messageId: string): void {
    void this.processMessage(messageId).catch(() => {
      this.logger.warn({
        event: 'chat_voice_transcription_immediate_start_failed',
        messageId,
      });
    });
  }
}
