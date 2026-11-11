import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CloudflareStreamService,
  CloudflareVideoPlayback,
} from '../cloudflare-stream/cloudflare-stream.service';
import { MetricsService } from '../metrics/metrics.service';
import { ClassReplayRow, SupabaseService } from '../supabase/supabase.service';
import { CreateClassReplayDto } from './dto/create-class-replay.dto';
import { ListClassReplaysQueryDto } from './dto/list-class-replays-query.dto';
import {
  ClassReplay,
  ClassReplayPlayback,
} from './interfaces/class-replay.interface';

interface AccessibleRoomRow {
  id: string;
  title: string;
  host_id: string;
  co_host_id: string | null | undefined;
  speakers: string[] | null;
}

export interface IngestProviderRecordingInput {
  hostId: string;
  roomId: string;
  title: string;
  description?: string | null;
  providerVideoId: string;
  hlsUrl: string | null;
  dashUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_POLL_INTERVAL_SECONDS = 30;
const DEFAULT_PROCESSING_STALE_MS = 10 * 60 * 1000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60_000;
const DEFAULT_WORKER_BATCH = 5;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;

@Injectable()
export class ClassReplaysService {
  private readonly logger = new Logger(ClassReplaysService.name);
  private readonly inFlight = new Set<string>();
  private readonly maxAttempts: number;
  private readonly retentionDays: number;
  private readonly pollIntervalSeconds: number;
  private readonly processingStaleMs: number;
  private readonly downloadTimeoutMs: number;
  private readonly workerBatch: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly cloudflareStream: CloudflareStreamService,
    private readonly metricsService: MetricsService,
  ) {
    this.maxAttempts = this.readBoundedInteger(
      'CLASS_REPLAY_MAX_ATTEMPTS',
      DEFAULT_MAX_ATTEMPTS,
      1,
      10,
    );
    this.retentionDays = this.readBoundedInteger(
      'CLASS_REPLAY_RETENTION_DAYS',
      DEFAULT_RETENTION_DAYS,
      1,
      3_650,
    );
    this.pollIntervalSeconds = this.readBoundedInteger(
      'CLASS_REPLAY_POLL_INTERVAL_SECONDS',
      DEFAULT_POLL_INTERVAL_SECONDS,
      5,
      300,
    );
    this.processingStaleMs = this.readBoundedInteger(
      'CLASS_REPLAY_PROCESSING_STALE_MS',
      DEFAULT_PROCESSING_STALE_MS,
      60_000,
      60 * 60 * 1000,
    );
    this.downloadTimeoutMs = this.readBoundedInteger(
      'CLASS_REPLAY_DOWNLOAD_TIMEOUT_MS',
      DEFAULT_DOWNLOAD_TIMEOUT_MS,
      5_000,
      5 * 60 * 1000,
    );
    this.workerBatch = this.readBoundedInteger(
      'CLASS_REPLAY_WORKER_BATCH',
      DEFAULT_WORKER_BATCH,
      1,
      20,
    );
  }

  async createReplay(
    userId: string,
    dto: CreateClassReplayDto,
  ): Promise<ClassReplay> {
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('A replay title is required');
    }

    const room = await this.getRoom(dto.roomId);
    this.assertRoomHost(room, userId);

    this.assertSafeSourceUrl(dto.sourceUrl);

    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .insert({
        host_id: userId,
        room_id: room.id,
        title,
        description:
          dto.description?.trim().slice(0, MAX_DESCRIPTION_LENGTH) ?? null,
        status: 'pending',
        provider: 'cloudflare_stream',
        source_url: dto.sourceUrl,
        attempts: 0,
        next_attempt_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        const existing = await this.loadReplayByRoom(room.id);
        if (existing) return this.toClassReplay(existing);
      }
      throw new Error('Failed to create class replay');
    }

    this.metricsService.recordClassReplayCreated('manual');
    this.scheduleProcessing(data.id);
    return this.toClassReplay(data);
  }

  /**
   * Registers a recording that live egress already transcoded. The worker
   * prepares the progressive fallback and marks the replay ready once playback
   * sources are verified.
   */
  async ingestProviderRecording(
    input: IngestProviderRecordingInput,
  ): Promise<ClassReplay | null> {
    const existing = await this.loadReplayByRoom(input.roomId);
    if (existing) return null;

    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .insert({
        host_id: input.hostId,
        room_id: input.roomId,
        title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
        description:
          input.description?.trim().slice(0, MAX_DESCRIPTION_LENGTH) ?? null,
        status: 'pending',
        provider: 'cloudflare_stream',
        provider_video_id: input.providerVideoId,
        hls_url: input.hlsUrl,
        dash_url: input.dashUrl,
        thumbnail_url: input.thumbnailUrl,
        duration_seconds: input.durationSeconds,
        attempts: 0,
        next_attempt_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return null;
      this.logger.warn(
        `Class replay could not be registered for room ${input.roomId}`,
      );
      return null;
    }

    this.metricsService.recordClassReplayCreated('archive');
    this.scheduleProcessing(data.id);
    return this.toClassReplay(data);
  }

  async listReplays(
    userId: string,
    query: ListClassReplaysQueryDto,
  ): Promise<ClassReplay[]> {
    const supabase = this.supabaseService.getClient();

    if (query.roomId) {
      const room = await this.getRoom(query.roomId);
      await this.assertRoomAccess(room, userId);
      const { data, error } = await supabase
        .from('class_replays')
        .select('*')
        .eq('room_id', query.roomId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error('Failed to load class replays');
      return (data ?? []).map((row) => this.toClassReplay(row));
    }

    const [{ data: participantRows }, { data: hostedRows }] = await Promise.all(
      [
        supabase
          .from('audio_room_participants')
          .select('room_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: false })
          .limit(200),
        supabase
          .from('audio_rooms')
          .select('id')
          .eq('host_id', userId)
          .order('created_at', { ascending: false })
          .limit(200),
      ],
    );
    const roomIds = Array.from(
      new Set([
        ...(participantRows ?? []).map((row) => row.room_id),
        ...(hostedRows ?? []).map((row) => row.id),
      ]),
    );

    const filter =
      roomIds.length > 0
        ? `host_id.eq.${userId},room_id.in.(${roomIds.join(',')})`
        : `host_id.eq.${userId}`;
    const { data, error } = await supabase
      .from('class_replays')
      .select('*')
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error('Failed to load class replays');
    return (data ?? []).map((row) => this.toClassReplay(row));
  }

  async getReplay(userId: string, replayId: string): Promise<ClassReplay> {
    const row = await this.loadReplay(replayId);
    await this.assertReplayAccess(row, userId);
    return this.toClassReplay(row);
  }

  async getPlayback(
    userId: string,
    replayId: string,
  ): Promise<ClassReplayPlayback> {
    const row = await this.loadReplay(replayId);
    await this.assertReplayAccess(row, userId);
    if (row.status !== 'ready') {
      throw new ConflictException(
        `Class replay is not ready (status: ${row.status})`,
      );
    }
    return {
      replay_id: row.id,
      status: row.status,
      hls_url: row.hls_url,
      dash_url: row.dash_url,
      download_url: row.download_url,
      thumbnail_url: row.thumbnail_url,
      duration_seconds: row.duration_seconds,
      expires_at: row.expires_at,
    };
  }

  async retry(userId: string, replayId: string): Promise<void> {
    const row = await this.loadReplay(replayId);
    if (row.host_id !== userId) {
      throw new ForbiddenException(
        'Only the replay host can retry transcoding.',
      );
    }
    if (row.status !== 'failed') {
      throw new ConflictException('Only a failed replay can be retried.');
    }

    const now = new Date().toISOString();
    const { data: queued, error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .update({
        status: 'pending',
        attempts: 0,
        next_attempt_at: now,
        last_attempt_at: null,
        failure_code: null,
        updated_at: now,
      })
      .eq('id', replayId)
      .eq('status', 'failed')
      .eq('attempts', row.attempts)
      .select('id')
      .maybeSingle();
    if (error) throw new Error('Failed to queue replay retry');
    if (!queued) {
      throw new ConflictException('Replay state changed before retry');
    }
    this.metricsService.recordClassReplayTransition('pending');
    this.scheduleProcessing(replayId);
  }

  async deleteReplay(userId: string, replayId: string): Promise<void> {
    const row = await this.loadReplay(replayId);
    if (row.host_id !== userId) {
      throw new ForbiddenException('Only the replay host can delete a replay.');
    }

    if (row.provider_video_id) {
      try {
        await this.cloudflareStream.deleteVideo(row.provider_video_id);
      } catch {
        this.logger.warn(
          `Provider cleanup failed for class replay ${replayId}; deleting metadata anyway`,
        );
      }
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .delete()
      .eq('id', replayId);
    if (error) throw new Error('Failed to delete class replay');
  }

  /**
   * Removes every replay owned by a learner and its provider recording. Used by
   * the account-erasure workflow so a deleted account cannot leave orphaned
   * transcoded media behind.
   */
  async deleteReplaysForUser(userId: string): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .select('id, provider_video_id')
      .eq('host_id', userId)
      .limit(500);
    if (error || !data) {
      throw new Error('Failed to load class replays for erasure');
    }

    for (const row of data) {
      if (row.provider_video_id) {
        try {
          await this.cloudflareStream.deleteVideo(row.provider_video_id);
        } catch {
          this.logger.warn(
            `Provider cleanup failed for erased class replay ${row.id}`,
          );
        }
      }
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('class_replays')
        .delete()
        .eq('id', row.id);
      if (deleteError) {
        this.logger.warn(`Erased class replay ${row.id} could not be deleted`);
      }
    }
  }

  @Cron('*/30 * * * * *', { name: 'class-replay-transcode-worker' })
  async processPendingReplays(): Promise<void> {
    await this.recoverStaleJobs();

    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .select('id')
      .in('status', ['pending', 'processing'])
      .lte('next_attempt_at', now)
      .lt('attempts', this.maxAttempts)
      .order('next_attempt_at', { ascending: true })
      .limit(this.workerBatch);
    if (error || !data) return;

    await Promise.allSettled(data.map((row) => this.processReplay(row.id)));
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'class-replay-retention' })
  async purgeExpiredReplays(): Promise<void> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .select('id, provider_video_id')
      .not('expires_at', 'is', null)
      .lt('expires_at', now)
      .order('expires_at', { ascending: true })
      .limit(50);
    if (error || !data) return;

    for (const row of data) {
      if (row.provider_video_id) {
        try {
          await this.cloudflareStream.deleteVideo(row.provider_video_id);
        } catch {
          this.logger.warn(
            `Provider cleanup failed for expired class replay ${row.id}`,
          );
        }
      }
      const { error: deleteError } = await this.supabaseService
        .getClient()
        .from('class_replays')
        .delete()
        .eq('id', row.id);
      if (deleteError) {
        this.logger.warn(`Expired class replay ${row.id} could not be deleted`);
      } else {
        this.metricsService.recordClassReplayPurged();
      }
    }
  }

  async processReplay(replayId: string): Promise<void> {
    if (this.inFlight.has(replayId)) return;
    this.inFlight.add(replayId);

    try {
      const job = await this.loadReplay(replayId);
      if (job.status === 'ready' || job.status === 'failed') return;
      if (job.attempts >= this.maxAttempts) return;

      const attempt = job.attempts + 1;
      const claimedAt = new Date().toISOString();
      const { data: claimed, error: claimError } = await this.supabaseService
        .getClient()
        .from('class_replays')
        .update({
          status: 'processing',
          attempts: attempt,
          last_attempt_at: claimedAt,
          next_attempt_at: null,
          failure_code: null,
          updated_at: claimedAt,
        })
        .eq('id', replayId)
        .eq('status', job.status)
        .eq('attempts', job.attempts)
        .select('id')
        .maybeSingle();
      if (claimError || !claimed) return;

      this.metricsService.recordClassReplayTransition('processing');
      const startedAt = Date.now();

      try {
        const resolved = await this.resolveProviderVideo(job);
        if (resolved.scheduled) return;

        const playback = await this.cloudflareStream.getVideoPlayback(
          resolved.videoId,
        );
        if (!playback.ready) {
          await this.scheduleNextPoll(
            replayId,
            resolved.videoId,
            playback,
            attempt,
          );
          return;
        }

        let downloadUrl: string | null = null;
        try {
          downloadUrl = await this.cloudflareStream.waitForDefaultDownload(
            resolved.videoId,
            this.downloadTimeoutMs,
          );
        } catch {
          this.logger.warn(
            `Progressive fallback unavailable for class replay ${replayId}; adaptive sources remain usable`,
          );
        }

        await this.markReady(
          replayId,
          attempt,
          resolved.videoId,
          playback,
          downloadUrl,
        );
        this.metricsService.recordClassReplayProcessing(
          'success',
          (Date.now() - startedAt) / 1000,
        );
      } catch (error: unknown) {
        const code = classifyProcessingFailure(error);
        this.logger.warn(
          `Class replay ${replayId} processing failed on attempt ${attempt} (${code})`,
        );
        await this.markRetryable(replayId, attempt, code);
        this.metricsService.recordClassReplayProcessing(
          'failure',
          (Date.now() - startedAt) / 1000,
        );
      }
    } finally {
      this.inFlight.delete(replayId);
    }
  }

  private async resolveProviderVideo(
    job: ClassReplayRow,
  ): Promise<{ videoId: string; scheduled: boolean }> {
    if (job.provider_video_id) {
      return { videoId: job.provider_video_id, scheduled: false };
    }
    if (!job.source_url) {
      throw new Error('source_missing');
    }

    const videoId = await this.cloudflareStream.copyVideoFromUrl(
      job.source_url,
      { name: job.title, roomId: job.room_id ?? undefined },
    );
    const nextAttemptAt = this.nextPollTimestamp();
    const { error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .update({
        provider_video_id: videoId,
        status: 'processing',
        next_attempt_at: nextAttemptAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    if (error) throw new Error('Failed to persist provider video identity');
    return { videoId, scheduled: true };
  }

  private async scheduleNextPoll(
    replayId: string,
    providerVideoId: string,
    playback: CloudflareVideoPlayback,
    attempt: number,
  ): Promise<void> {
    if (isTerminalProviderState(playback.state)) {
      await this.markRetryable(replayId, attempt, 'provider_rejected_source');
      return;
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .update({
        provider_video_id: providerVideoId,
        status: 'processing',
        next_attempt_at: this.nextPollTimestamp(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', replayId);
    if (error) throw new Error('Failed to schedule replay polling');
  }

  private async markReady(
    replayId: string,
    attempt: number,
    providerVideoId: string,
    playback: CloudflareVideoPlayback,
    downloadUrl: string | null,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = this.retentionExpiry(now);
    const { error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .update({
        status: 'ready',
        provider_video_id: providerVideoId,
        hls_url: playback.hlsUrl,
        dash_url: playback.dashUrl,
        download_url: downloadUrl,
        thumbnail_url: playback.thumbnailUrl,
        duration_seconds: playback.durationSeconds,
        failure_code: null,
        next_attempt_at: null,
        ready_at: now.toISOString(),
        expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq('id', replayId)
      .eq('status', 'processing')
      .eq('attempts', attempt);
    if (error) throw new Error('Failed to persist replay playback sources');
    this.metricsService.recordClassReplayTransition('ready');
  }

  private async markRetryable(
    replayId: string,
    attempt: number,
    failureCode: string,
  ): Promise<void> {
    const terminal = attempt >= this.maxAttempts;
    const retryDelay = Math.min(
      60 * 60 * 1000,
      this.pollIntervalSeconds * 1000 * 2 ** Math.max(0, attempt - 1),
    );
    const updatedAt = new Date().toISOString();
    const { error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .update({
        status: terminal ? 'failed' : 'pending',
        failure_code: failureCode,
        next_attempt_at: terminal
          ? null
          : new Date(Date.now() + retryDelay).toISOString(),
        expires_at: terminal ? this.retentionExpiry(new Date(updatedAt)) : null,
        updated_at: updatedAt,
      })
      .eq('id', replayId)
      .eq('status', 'processing')
      .eq('attempts', attempt);
    if (error) {
      this.logger.warn(
        `Replay ${replayId} failure state could not be persisted`,
      );
      return;
    }
    this.metricsService.recordClassReplayTransition(
      terminal ? 'failed' : 'pending',
    );
  }

  private async recoverStaleJobs(): Promise<void> {
    const staleBefore = new Date(
      Date.now() - this.processingStaleMs,
    ).toISOString();
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('class_replays')
      .select('id, attempts')
      .eq('status', 'processing')
      .lt('last_attempt_at', staleBefore)
      .limit(20);
    if (error || !data) {
      this.logger.warn('Stale class replay jobs could not be recovered');
      return;
    }

    for (const row of data) {
      const terminal = row.attempts >= this.maxAttempts;
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('class_replays')
        .update({
          status: terminal ? 'failed' : 'pending',
          failure_code: 'worker_interrupted',
          next_attempt_at: terminal ? null : now,
          expires_at: terminal ? this.retentionExpiry(new Date(now)) : null,
          updated_at: now,
        })
        .eq('id', row.id)
        .eq('status', 'processing');
      if (updateError) {
        this.logger.warn(
          `Interrupted class replay ${row.id} could not be requeued`,
        );
      }
    }
  }

  private async loadReplay(replayId: string): Promise<ClassReplayRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .select('*')
      .eq('id', replayId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Class replay not found');
    return data;
  }

  private async loadReplayByRoom(
    roomId: string,
  ): Promise<ClassReplayRow | null> {
    const { data } = await this.supabaseService
      .getClient()
      .from('class_replays')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();
    return data ?? null;
  }

  private async getRoom(roomId: string): Promise<AccessibleRoomRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('audio_rooms')
      .select('id, title, host_id, co_host_id, speakers')
      .eq('id', roomId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Classroom not found');
    return data;
  }

  private assertRoomHost(room: AccessibleRoomRow, userId: string): void {
    if (room.host_id !== userId && room.co_host_id !== userId) {
      throw new ForbiddenException(
        'Only the classroom host or co-host can publish a replay.',
      );
    }
  }

  private async assertReplayAccess(
    row: ClassReplayRow,
    userId: string,
  ): Promise<void> {
    if (row.host_id === userId) return;
    if (!row.room_id) {
      throw new ForbiddenException('This replay is private to its host.');
    }
    const room = await this.getRoom(row.room_id);
    await this.assertRoomAccess(room, userId);
  }

  private async assertRoomAccess(
    room: AccessibleRoomRow,
    userId: string,
  ): Promise<void> {
    if (
      room.host_id === userId ||
      room.co_host_id === userId ||
      (room.speakers ?? []).includes(userId)
    ) {
      return;
    }
    const { data } = await this.supabaseService
      .getClient()
      .from('audio_room_participants')
      .select('room_id')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) {
      throw new ForbiddenException(
        'Only classroom participants can access this replay.',
      );
    }
  }

  private assertSafeSourceUrl(value: string): void {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException(
        'A valid HTTPS source recording is required',
      );
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new BadRequestException(
        'Source recordings must use HTTPS without embedded credentials',
      );
    }
  }

  private nextPollTimestamp(): string {
    return new Date(Date.now() + this.pollIntervalSeconds * 1000).toISOString();
  }

  private retentionExpiry(from: Date): string {
    return new Date(
      from.getTime() + this.retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  private scheduleProcessing(replayId: string): void {
    void this.processReplay(replayId).catch(() => {
      this.logger.warn(`Class replay ${replayId} could not start immediately`);
    });
  }

  private toClassReplay(row: ClassReplayRow): ClassReplay {
    return {
      id: row.id,
      host_id: row.host_id,
      room_id: row.room_id,
      title: row.title,
      description: row.description,
      status: row.status,
      hls_url: row.hls_url,
      dash_url: row.dash_url,
      download_url: row.download_url,
      thumbnail_url: row.thumbnail_url,
      duration_seconds: row.duration_seconds,
      failure_code: row.failure_code,
      ready_at: row.ready_at,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private readBoundedInteger(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = Number(this.configService.get<string>(key));
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(raw)));
  }
}

function isTerminalProviderState(state: string): boolean {
  const normalised = state.toLowerCase();
  return normalised === 'error' || normalised === 'failed';
}

function classifyProcessingFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'provider_error';
  return error.message.includes('copy') ? 'source_rejected' : 'provider_error';
}
