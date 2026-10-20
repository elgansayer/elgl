import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ClientErrorDto } from './dto/client-error.dto';

interface SafeClientErrorMetadata {
  status?: number;
  statusText?: string;
  rawType?: string;
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, maxLength) : undefined;
}

function sanitiseMetadata(
  metadata: Record<string, unknown> | undefined,
): SafeClientErrorMetadata | null {
  if (!metadata) return null;

  const result: SafeClientErrorMetadata = {};
  if (
    typeof metadata['status'] === 'number' &&
    Number.isFinite(metadata['status'])
  ) {
    result.status = Math.max(0, Math.min(999, Math.trunc(metadata['status'])));
  }

  const statusText = boundedString(metadata['statusText'], 120);
  if (statusText) result.statusText = statusText;

  const rawType = boundedString(metadata['rawType'], 120);
  if (rawType) result.rawType = rawType;

  return Object.keys(result).length > 0 ? result : null;
}

function sanitiseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.origin}${parsed.pathname}`.slice(0, 2048);
  } catch {
    return null;
  }
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async recordClientError(payload: ClientErrorDto): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase.from('client_errors').insert({
        message: payload.message,
        name: payload.name ?? 'Error',
        stack: payload.stack ?? null,
        component_stack: payload.componentStack ?? null,
        url: sanitiseUrl(payload.url),
        user_agent: payload.userAgent ?? null,
        metadata: sanitiseMetadata(payload.metadata),
        stack_frames: payload.stackFrames ?? null,
        client_timestamp: payload.timestamp ?? new Date().toISOString(),
      } as never);

      if (error) {
        this.logger.warn('Failed to persist client crash analytics');
        throw new ServiceUnavailableException(
          'Client crash analytics unavailable',
        );
      }
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('Client crash analytics persistence threw unexpectedly');
      throw new ServiceUnavailableException('Client crash analytics unavailable');
    }
  }
}
