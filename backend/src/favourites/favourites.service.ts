import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AddFavouriteDto } from '../chat/dto/add-favourite.dto';
import { SupabaseService } from '../supabase/supabase.service';

interface FavouriteRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  message_id: string | null;
  item_type: string;
  item_payload: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

interface MessageVisibilityRow {
  id: string;
  room_id: string;
  deleted_for_user_ids: string[] | null;
}

export interface StarredMessagesPage {
  items: Record<string, unknown>[];
  has_more: boolean;
  next_offset: number | null;
}

/**
 * SQLSTATE values raised by `public.normalise_chat_favourite()` (see
 * 20260823160100_harden_chat_favourites.sql) plus the historical
 * UNIQUE(user_id, message_id) violation.
 */
const SQLSTATE_INVALID_PARAMETER = '22023';
const SQLSTATE_NOT_NULL_VIOLATION = '23502';
const SQLSTATE_STRING_TRUNCATION = '22001';
const SQLSTATE_FOREIGN_KEY_VIOLATION = '23503';
const SQLSTATE_INSUFFICIENT_PRIVILEGE = '42501';
const SQLSTATE_UNIQUE_VIOLATION = '23505';

/** Only five-character SQLSTATE or PostgREST codes are ever logged. */
const SAFE_ERROR_CODE = /^[A-Za-z0-9]{5,8}$/;

type FavouriteOperation =
  'add' | 'remove' | 'list' | 'verify_visibility' | 'verify_membership';

@Injectable()
export class FavouritesService {
  private readonly logger = new Logger(FavouritesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Bookmarks a message for the user. The call is idempotent: the database
   * trigger turns a repeated insert into an update of the existing row, and a
   * lost race on the historical unique constraint is treated as success.
   *
   * Authorization is enforced by the trigger (room membership), so the failure
   * mapping below is part of the permission contract:
   * - a message the user cannot see is reported as not found, whether it does
   *   not exist or lives in a room they are not a member of, so the endpoint
   *   cannot be used to probe for message identifiers;
   * - malformed input is a 400;
   * - anything else is an opaque 500.
   */
  async addFavourite(
    userId: string,
    dto: AddFavouriteDto,
  ): Promise<{ success: true }> {
    const supabase = this.supabaseService.getClient();

    // Supply only the message identity in the application-facing shape. The
    // database trigger resolves it onto the historical message_id column,
    // verifies room membership, and rebuilds the canonical message snapshot.
    const { error } = await supabase.from('favourites').insert({
      user_id: userId,
      item_type: 'message',
      item_payload: { id: dto.message_id },
      notes: dto.note_text ?? null,
    });

    if (!error) {
      return { success: true };
    }

    const code = this.safeErrorCode(error);
    switch (code) {
      case SQLSTATE_UNIQUE_VIOLATION:
        // A concurrent retry won the race; the bookmark already exists.
        return { success: true };
      case SQLSTATE_FOREIGN_KEY_VIOLATION:
      case SQLSTATE_INSUFFICIENT_PRIVILEGE:
        this.logRejection('add', code, userId, dto.message_id);
        throw new NotFoundException('Message not found');
      case SQLSTATE_INVALID_PARAMETER:
      case SQLSTATE_NOT_NULL_VIOLATION:
        this.logRejection('add', code, userId, dto.message_id);
        throw new BadRequestException('Invalid message identifier');
      case SQLSTATE_STRING_TRUNCATION:
        this.logRejection('add', code, userId, dto.message_id);
        throw new BadRequestException(
          'Favourite note must not exceed 500 characters',
        );
      default:
        this.logProviderFailure('add', code, userId);
        throw new InternalServerErrorException('Failed to add favourite');
    }
  }

  /**
   * Removes one of the user's own bookmarks. Deleting a bookmark that is
   * already gone succeeds, so a retried request is safe.
   */
  async removeFavourite(
    userId: string,
    favouriteId: string,
  ): Promise<{ success: true }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('favourites')
      .delete()
      .eq('id', favouriteId)
      .eq('user_id', userId);

    if (error) {
      this.logProviderFailure('remove', this.safeErrorCode(error), userId);
      throw new InternalServerErrorException('Failed to remove favourite');
    }
    return { success: true };
  }

  async getUserFavourites(userId: string): Promise<Record<string, unknown>[]> {
    const page = await this.getStarredMessages(userId, 100, 0);
    return page.items;
  }

  /**
   * Returns a bounded page of starred messages while re-checking current chat
   * visibility. Favourites store a message snapshot for fast review, so a
   * retrieval must not expose that snapshot after the user leaves the room or
   * after the underlying message is deleted.
   */
  async getStarredMessages(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<StarredMessagesPage> {
    const supabase = this.supabaseService.getClient();

    // range() is inclusive. Request one extra row so callers can paginate
    // without an expensive exact-count query over private message metadata.
    const { data, error } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .eq('item_type', 'message')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      this.logProviderFailure('list', this.safeErrorCode(error), userId);
      throw new Error('Failed to load starred messages');
    }

    const rows = (data ?? []) as FavouriteRow[];
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const messageIds = pageRows
      .map((row) => row.message_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (messageIds.length === 0) {
      return {
        items: [],
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
      };
    }

    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .select('id, room_id, deleted_for_user_ids')
      .in('id', messageIds);

    if (messageError) {
      this.logProviderFailure(
        'verify_visibility',
        this.safeErrorCode(messageError),
        userId,
      );
      throw new Error('Failed to verify starred message visibility');
    }

    const messages = (messageData ?? []) as MessageVisibilityRow[];
    const roomIds = [...new Set(messages.map((message) => message.room_id))];

    if (roomIds.length === 0) {
      return {
        items: [],
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
      };
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId)
      .in('room_id', roomIds);

    if (membershipError) {
      this.logProviderFailure(
        'verify_membership',
        this.safeErrorCode(membershipError),
        userId,
      );
      throw new Error('Failed to verify starred message membership');
    }

    const memberRoomIds = new Set(
      (membershipData ?? []).map(
        (membership: { room_id: string }) => membership.room_id,
      ),
    );
    const visibleMessageIds = new Set(
      messages
        .filter(
          (message) =>
            !message.deleted_for_user_ids?.includes(userId) &&
            memberRoomIds.has(message.room_id),
        )
        .map((message) => message.id),
    );

    return {
      items: pageRows.filter(
        (row) =>
          row.message_id !== null && visibleMessageIds.has(row.message_id),
      ),
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
    };
  }

  /**
   * Extracts a loggable error code. Provider error messages, details and hints
   * can echo row values, so they are never read for logging.
   */
  private safeErrorCode(error: { code?: unknown }): string {
    return typeof error.code === 'string' && SAFE_ERROR_CODE.test(error.code)
      ? error.code
      : 'unknown';
  }

  /** A request the caller can correct or that is denied by policy. */
  private logRejection(
    operation: FavouriteOperation,
    code: string,
    userId: string,
    messageId: string,
  ): void {
    this.logger.warn({
      event: 'favourites.request_rejected',
      operation,
      code,
      userId,
      messageId,
    });
  }

  /** A provider failure; message text, notes and media URLs are never logged. */
  private logProviderFailure(
    operation: FavouriteOperation,
    code: string,
    userId: string,
  ): void {
    this.logger.error({
      event: 'favourites.provider_failure',
      operation,
      code,
      userId,
    });
  }
}
