import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ProfileVisitor,
  ProfileVisitorSummary,
} from './interfaces/user-profile.interface';

const DEFAULT_VISITOR_LIMIT = 50;
const MAX_VISITOR_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readVisitorSummary(value: unknown): ProfileVisitorSummary | undefined {
  const candidate: unknown = Array.isArray(value) ? value[0] : value;
  if (!isRecord(candidate)) return undefined;

  const id = readString(candidate['id']);
  const displayName = readString(candidate['display_name']);
  if (!id || !displayName) return undefined;

  return {
    id,
    display_name: displayName,
    avatar_url: readString(candidate['avatar_url']) ?? '',
    native_languages: readStringArray(candidate['native_languages']),
    target_languages: readStringArray(candidate['target_languages']),
  };
}

function readProfileVisit(value: unknown): ProfileVisitor | undefined {
  if (!isRecord(value)) return undefined;

  const id = readString(value['id']);
  const visitorId = readString(value['visitor_id']);
  const viewedId = readString(value['viewed_id']);
  const createdAt = readString(value['created_at']);
  if (!id || !visitorId || !viewedId || !createdAt) return undefined;

  const visitor = readVisitorSummary(value['visitor']);
  return {
    id,
    visitor_id: visitorId,
    viewed_id: viewedId,
    created_at: createdAt,
    ...(visitor ? { visitor } : {}),
  };
}

@Injectable()
export class ProfileVisitsService {
  private readonly logger = new Logger(ProfileVisitsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async recordVisit(visitorId: string, viewedId: string): Promise<boolean> {
    if (!visitorId || !viewedId || visitorId === viewedId) return false;

    try {
      const supabase = this.supabaseService.getClient();
      const privacyResponse = await supabase
        .from('users')
        .select('incognito_visits')
        .eq('id', visitorId)
        .maybeSingle();

      const privacyData: unknown = privacyResponse.data;
      if (privacyResponse.error || !isRecord(privacyData)) {
        this.logger.warn(
          'Skipping profile visit because visitor privacy state is unavailable',
        );
        return false;
      }

      if (privacyData['incognito_visits'] === true) return false;

      const { error } = await supabase.from('profile_visits').insert({
        visitor_id: visitorId,
        viewed_id: viewedId,
      });

      if (error) {
        this.logger.warn('Failed to persist profile visit');
        return false;
      }

      return true;
    } catch {
      this.logger.warn('Failed to record profile visit');
      return false;
    }
  }

  async getVisitors(
    viewedId: string,
    requesterId: string,
    limit = DEFAULT_VISITOR_LIMIT,
    offset = 0,
  ): Promise<ProfileVisitor[]> {
    if (viewedId !== requesterId) {
      throw new ForbiddenException('Visitor history is private');
    }

    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), MAX_VISITOR_LIMIT)
      : DEFAULT_VISITOR_LIMIT;
    const safeOffset = Number.isFinite(offset)
      ? Math.max(Math.trunc(offset), 0)
      : 0;

    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('profile_visits')
      .select(
        `
        id,
        visitor_id,
        viewed_id,
        created_at,
        visitor:visitor_id (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('viewed_id', viewedId)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (response.error) {
      throw new InternalServerErrorException(
        'Failed to fetch profile visitors',
      );
    }

    const rows: unknown = response.data;
    if (!Array.isArray(rows)) {
      throw new InternalServerErrorException(
        'Unexpected profile visitor response shape',
      );
    }

    return rows
      .map(readProfileVisit)
      .filter((visit): visit is ProfileVisitor => visit !== undefined);
  }
}
