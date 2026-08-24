import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { ReadReceiptsService } from './read-receipts.service';
import { SafetyService } from '../safety/safety.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import { LinkPreview } from '../link-preview/interfaces/link-preview.interface';
import { SpamDetectionService } from '../spam-detection/spam-detection.service';
import { ChatLlmService } from './chat-llm.service';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { SendTypingDto } from './dto/send-typing.dto';
import { SuggestedRepliesRequestDto } from './dto/suggested-replies-request.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ReplyToStatusUpdateDto } from './dto/reply-to-status-update.dto';
import {
  CorrectionPayload,
  ChatMessage,
  ChatRoomRecord,
  FavouriteRecord,
} from './interfaces/chat-message.interface';
import {
  ChatMessageEvent,
  ChatMentionEvent,
} from '../notifications/events/notification.events';
import { SystemMessageService } from './services/system-message.service';
import { XpService } from '../xp/xp.service';
import { UsersService } from '../users/users.service';
import { SetWallpaperDto } from './dto/set-wallpaper.dto';
import { ShareContactDto } from './dto/share-contact.dto';
import { randomUUID } from 'crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

interface DeletedAwareMessage extends ChatMessage {
  is_deleted?: boolean;
  deleted_for_user_ids?: string[] | null;
}

interface GroupMember {
  user_id: string;
  user?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
    @Optional()
    private readonly readReceiptsService: ReadReceiptsService | undefined,
    private readonly eventEmitter: EventEmitter2,
    private readonly safetyService: SafetyService,
    private readonly linkPreviewService: LinkPreviewService,
    private readonly spamDetectionService: SpamDetectionService,
    private readonly chatLlmService: ChatLlmService,
    private readonly systemMessageService: SystemMessageService,
    private readonly xpService: XpService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async generateConnectionToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 3600, // Token expires in 1 hour
    };

    try {
      const token = await this.centrifugoService.signJwt(payload);
      return token;
    } catch (error) {
      throw new Error(`Failed to generate Centrifugo token: ${error.message}`, {
        cause: error,
      });
    }
  }

  async sendTyping(userId: string, dto: SendTypingDto): Promise<void> {
    await this.centrifugoService.publish(`chat:${dto.room_id}`, {
      typing: dto.is_typing === 'true',
      sender_id: userId,
    });
  }

  private async generateCorrectionPayloadIfNeeded(
    correctionPayload: unknown,
  ): Promise<CorrectionPayload | null> {
    if (!isRecord(correctionPayload)) {
      return null;
    }

    if (
      typeof correctionPayload.explanation === 'string' &&
      correctionPayload.explanation.trim().length > 0
    ) {
      return null;
    }

    const originalText =
      typeof correctionPayload.original === 'string'
        ? correctionPayload.original
        : undefined;
    const correctedText =
      typeof correctionPayload.corrected === 'string'
        ? correctionPayload.corrected
        : undefined;

    if (!originalText || !correctedText) {
      return null;
    }

    const prompt = `Explain simply why the following sentence was corrected.\nOriginal: "${originalText}"\nCorrected: "${correctedText}"\nProvide a short explanation.`;
    try {
      const { response } = await this.chatLlmService.proxyMessage(prompt);
      if (response && response.trim().length > 0) {
        return {
          original: originalText,
          corrected: correctedText,
          explanation: response.trim(),
        };
      }
    } catch {
      // Explanation generation failed; serve the message without it
    }
    return null;
  }

  /**
   * Enforces the receiver's message_filters for initial messages.
   * Only applies to the very first message from sender to receiver in a room.
   */
  private async enforceMessageFilters(
    senderId: string,
    receiverId: string,
    roomId: string,
  ): Promise<void> {
    // Only enforce for initial messages - check if sender has already sent messages to receiver
    const supabase = this.supabaseService.getClient();
    const { count, error: countError } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('sender_id', senderId);

    if (countError) return;

    // If sender has already messaged in this room, skip filter enforcement
    if ((count ?? 0) > 0) return;

    // Fetch receiver's message filters and profile
    const { data: receiverProfile, error: profileError } = await supabase
      .from('users')
      .select('message_filters, native_languages, age, gender')
      .eq('id', receiverId)
      .single();

    if (profileError || !receiverProfile) return;

    const filters = (receiverProfile as Record<string, unknown>)
      ?.message_filters as
      | {
          age_min?: number;
          age_max?: number;
          allowed_native_languages?: string[];
          allowed_genders?: string[];
        }
      | undefined;

    if (!filters) return;

    // Fetch sender's profile for validation
    const { data: senderProfile, error: senderError } = await supabase
      .from('users')
      .select('native_languages, age, gender')
      .eq('id', senderId)
      .single();

    if (senderError || !senderProfile) return;

    const sender = senderProfile as {
      native_languages?: string[];
      age?: number;
      gender?: string;
    };

    // Check native language filter - any of sender's native languages must match
    if (
      filters.allowed_native_languages &&
      filters.allowed_native_languages.length > 0
    ) {
      const senderNativeLangs = sender.native_languages ?? [];
      const hasAllowedLanguage = senderNativeLangs.some((lang: string) =>
        filters.allowed_native_languages!.includes(lang),
      );
      if (senderNativeLangs.length > 0 && !hasAllowedLanguage) {
        throw new BadRequestException(
          'You cannot send the first message to this user due to their native language filter settings.',
        );
      }
    }

    // Check age filter
    if (filters.age_min !== undefined || filters.age_max !== undefined) {
      const senderAge = sender.age;
      if (senderAge !== undefined && senderAge !== null) {
        if (filters.age_min !== undefined && senderAge < filters.age_min) {
          throw new BadRequestException(
            'You cannot send the first message to this user due to their age filter settings.',
          );
        }
        if (filters.age_max !== undefined && senderAge > filters.age_max) {
          throw new BadRequestException(
            'You cannot send the first message to this user due to their age filter settings.',
          );
        }
      }
    }

    // Check gender filter
    if (filters.allowed_genders && filters.allowed_genders.length > 0) {
      const senderGender = sender.gender ?? '';
      if (senderGender && !filters.allowed_genders.includes(senderGender)) {
        throw new BadRequestException(
          'You cannot send the first message to this user due to their gender filter settings.',
        );
      }
    }
  }

  async getRooms(currentUserId: string): Promise<ChatRoomRecord[]> {
    const supabase = this.supabaseService.getClient();

    // Get blocked user IDs to exclude from rooms
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    const response = await supabase
      .from('chat_rooms')
      .select(
        'id, title, subtitle, avatar, is_online, is_pinned, created_at, admin_id, wallpaper_url, labels',
      )
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true });

    if (response.error || !response.data || response.data.length === 0) {
      const mockRooms = [
        {
          id: 'mock-room-1',
          title: 'Spanish Practice',
          subtitle: 'Emma: "¡Hola! ¿Cómo estás hoy?"',
          avatar: 'https://i.pravatar.cc/150?u=emma',
          is_online: true,
          is_pinned: true,
          created_at: new Date().toISOString(),
          wallpaper_url: null,
          labels: [],
        },
        {
          id: 'mock-room-2',
          title: 'Language Exchange - JP/EN',
          subtitle: 'Kenji: "Thanks for the help!"',
          avatar: 'https://i.pravatar.cc/150?u=kenji',
          is_online: false,
          is_pinned: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          wallpaper_url: null,
          labels: [],
        },
      ] as ChatRoomRecord[];

      return mockRooms;
    }

    let rooms: ChatRoomRecord[] = response.data;

    // Fetch locked chat room ids for the current user
    const lockedRowsResponse = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', currentUserId)
      .eq('is_locked', true);

    const lockedSet = new Set<string>(
      (lockedRowsResponse.data ?? []).map(
        (r: { room_id: string }) => r.room_id,
      ),
    );

    // Hide rooms that have been locked by the current user
    rooms = rooms
      .filter((room) => !lockedSet.has(room.id))
      .map((room) => ({ ...room, is_locked: false }));

    // Filter out rooms where the other participant is blocked
    if (blockedIds.length > 0) {
      // Get room members for all rooms
      const roomIds = rooms.map((r) => r.id);
      const { data: members } = await supabase
        .from('chat_room_members')
        .select('room_id, user_id')
        .in('room_id', roomIds)
        .neq('user_id', currentUserId);

      if (members) {
        const memberMap = new Map<string, string>();
        (members as { room_id: string; user_id: string }[]).forEach((m) => {
          memberMap.set(m.room_id, m.user_id);
        });

        return rooms.filter((room) => {
          const otherUserId = memberMap.get(room.id);
          return otherUserId ? !blockedIds.includes(otherUserId) : true;
        });
      }
    }

    return rooms;
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    // Get room members to check if any are blocked
    const { data: roomMembers } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', dto.room_id)
      .neq('user_id', senderId);

    const receiverId =
      roomMembers && roomMembers.length > 0
        ? roomMembers[0].user_id
        : undefined;

    if (roomMembers && roomMembers.length > 0) {
      if (!receiverId) {
        // This should never happen because we already checked the length above.
        throw new Error('Unable to determine receiver');
      }
      // ⚡ Bolt Optimization: Group independent database lookups with a single concurrent Promise.all batch fetch to mitigate additive network latency.
      const [receiverBlockedIds, senderBlockedIds] = await Promise.all([
        this.safetyService.getBlockedAndBlockerIds(receiverId),
        this.safetyService.getBlockedAndBlockerIds(senderId),
      ]);
      // Check if the receiver has blocked the sender
      if (receiverBlockedIds.includes(senderId)) {
        throw new Error('You cannot send messages to this user.');
      }
      // Check if the sender has blocked the receiver
      if (senderBlockedIds.includes(receiverId)) {
        throw new Error('You cannot send messages to this user.');
      }

      // Enforce receiver's message filters for initial messages only
      await this.enforceMessageFilters(senderId, receiverId, dto.room_id);
    }

    // Check message filters for initial (first) message in a room
    if (receiverId) {
      await this.enforceMessageFilters(senderId, receiverId, dto.room_id);
    }

    // Spam detection for text messages
    if (dto.message_type === 'text' && dto.text_content) {
      const isSpam = this.spamDetectionService.isSpam(dto.text_content);
      if (isSpam) {
        throw new BadRequestException(
          'Your message appears to be a duplicate or spam content.',
        );
      }
    }

    // Enforce receiver's message filters for initial messages
    if (receiverId) {
      await this.enforceMessageFilters(senderId, receiverId, dto.room_id);
    }

    const insertResponse = await supabase
      .from('chat_messages')
      .insert({
        room_id: dto.room_id,
        sender_id: senderId,
        message_type: dto.message_type,
        text_content: dto.text_content ?? null,
        media_url: dto.media_url ?? null,
        correction_payload: dto.correction_payload ?? null,
        reply_to_id: dto.reply_to_id ?? null,
        correction_request_payload: dto.correction_request_payload ?? null,
        status_reply_payload: dto.status_reply_payload ?? null,
        is_view_once: dto.message_type === 'view_once_media' ? true : false,
        delivery_status: 'sent',
      })
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .single();

    if (insertResponse.error || !insertResponse.data) {
      const msg = insertResponse.error?.message ?? 'Unknown error';
      throw new Error(`Failed to save message: ${msg}`);
    }

    const savedMessage = insertResponse.data;

    // Award XP for sending a message
    void this.xpService.awardXpForActivity(senderId, 'send_message');

    // ---------- Link preview scraping ----------
    let linkPreview: LinkPreview | null = null;
    try {
      if (dto.message_type === 'text' && dto.text_content) {
        const urlMatch = dto.text_content.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          linkPreview = await this.linkPreviewService.getPreview(urlMatch[0]);
        }
      }
    } catch {
      // ignore any error; just continue without preview
    }

    // ---------- Auto‑generate explanation for correction if missing ----------
    let messageForPublish: ChatMessage = linkPreview
      ? { ...savedMessage, link_preview: linkPreview }
      : savedMessage;

    const enrichedCorrectionPayload =
      await this.generateCorrectionPayloadIfNeeded(
        savedMessage.correction_payload,
      );
    if (enrichedCorrectionPayload) {
      const { error: updateError } = await this.supabaseService
        .getClient()
        .from('chat_messages')
        .update({ correction_payload: enrichedCorrectionPayload })
        .eq('id', savedMessage.id);

      if (!updateError) {
        const updatedMessage: ChatMessage = {
          ...messageForPublish,
          correction_payload: enrichedCorrectionPayload,
        };
        messageForPublish = updatedMessage;
      }
    }

    // Publish to Centrifugo channel (with preview and possibly a generated explanation)
    await this.centrifugoService.publish(`chat:${dto.room_id}`, {
      message: messageForPublish,
    });

    const preview = dto.text_content
      ? dto.text_content.substring(0, 120)
      : dto.message_type === 'voice'
        ? '🎤 Voice message'
        : dto.message_type === 'correction'
          ? '📝 Correction'
          : dto.message_type === 'doodle'
            ? '🎨 Doodle'
            : dto.message_type === 'correction_request'
              ? '✏️ Correction request'
              : dto.message_type === 'status_reply'
                ? '✉️ Status reply'
                : '';

    // Emit push notification event
    if (receiverId) {
      this.eventEmitter.emit(
        'chat.message',

        new ChatMessageEvent(
          senderId,
          receiverId,
          dto.room_id,
          dto.message_type,
          preview,
        ),
      );
    }

    // Emit message.sent event for achievements evaluation
    this.eventEmitter.emit('message.sent', { userId: senderId });

    // ---------- Parse @mentions and emit notifications ----------
    if (dto.message_type === 'text' && dto.text_content) {
      const mentionRegex = /@([\wÀ-ɏ؀-ۿ]+)/g;
      const mentionedNames = [...dto.text_content.matchAll(mentionRegex)].map(
        (m) => m[1],
      );

      if (mentionedNames.length > 0) {
        const members = (await this.getGroupMembers(dto.room_id)) as {
          user_id: string;
          user?: { display_name?: string };
        }[];

        for (const member of members) {
          if (
            member.user_id !== senderId &&
            member.user?.display_name &&
            mentionedNames.includes(member.user.display_name)
          ) {
            this.eventEmitter.emit(
              'chat.mention',
              new ChatMentionEvent(
                senderId,
                member.user_id,
                dto.room_id,
                preview,
              ),
            );
          }
        }
      }
    }

    // Send an automatic away reply if the receiver has configured one
    if (receiverId && dto.message_type !== 'system') {
      await this.sendAwayReplyIfNeeded(senderId, dto.room_id, receiverId);
    }

    // Set initial delivery status to 'sent' and mark as delivered for receiver
    void this.readReceiptsService?.setInitialSent(savedMessage.id);
    if (receiverId) {
      void this.readReceiptsService?.markAsDelivered(
        savedMessage.id,
        dto.room_id,
        receiverId,
      );
    }

    return messageForPublish;
  }

  async getMessages(
    roomId: string,
    search?: string,
    currentUserId?: string,
  ): Promise<ChatMessage[]> {
    const supabase = this.supabaseService.getClient();

    // Get blocked user IDs to exclude from messages
    const blockedIds = currentUserId
      ? await this.safetyService.getBlockedAndBlockerIds(currentUserId)
      : [];

    // Automatically seed a greeting message when the room is first opened
    if (currentUserId && currentUserId.length > 0 && !search) {
      await this.ensureGreetingMessage(currentUserId, roomId);
    }

    let query = supabase
      .from('chat_messages')
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    // Exclude messages from blocked users
    if (blockedIds.length > 0) {
      query = query.not('sender_id', 'in', blockedIds);
    }

    if (search && search.trim().length > 0) {
      query = query.ilike('text_content', `%${search.trim()}%`);
    }

    const response = await query;
    if (response.error || !response.data || response.data.length === 0) {
      const mockMessages: ChatMessage[] = [
        {
          id: 'mock-msg-1',
          room_id: roomId,
          sender_id: 'mock-user-1',
          message_type: 'text',
          text_content: 'Hey! I would love to practice languages with you.',
          media_url: undefined,
          correction_payload: undefined,
          is_read: true,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          sender: {
            id: 'mock-user-1',
            display_name: 'Emma',
            avatar_url: 'https://i.pravatar.cc/150?u=emma',
          },
        },
        {
          id: 'mock-msg-2',
          room_id: roomId,
          sender_id: 'me',
          message_type: 'text',
          text_content: 'Hi Emma! That sounds great.',
          media_url: undefined,
          correction_payload: undefined,
          is_read: true,
          created_at: new Date().toISOString(),
          sender: { id: 'me', display_name: 'Me', avatar_url: null },
        },
      ];

      // Filter out blocked users from mock data
      if (blockedIds.length > 0) {
        return mockMessages.filter(
          (msg) => !blockedIds.includes(msg.sender_id),
        );
      }
      return mockMessages;
    }
    const messages: DeletedAwareMessage[] = response.data;

    // Exclude media_url for view-once media that has already been viewed
    for (const msg of messages) {
      if (msg.is_view_once && msg.viewed_at) {
        msg.media_url = undefined;
      }
    }

    if (currentUserId) {
      const visibleMessages = messages.filter((msg) => {
        if (msg.is_deleted) return false;
        if (msg.deleted_for_user_ids?.includes(currentUserId)) {
          return false;
        }
        return true;
      });
      return visibleMessages;
    }

    return messages;
  }

  async addFavourite(userId: string, dto: AddFavouriteDto): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Get the message to favourite
    const messageResponse = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', dto.message_id)
      .single();

    if (messageResponse.error || !messageResponse.data) {
      throw new Error('Message not found');
    }

    const message = messageResponse.data;

    // Store the favourite
    const { error } = await supabase.from('favourites').insert({
      user_id: userId,
      item_type: 'message',
      item_payload: message,
      notes: dto.note_text || null,
    });

    if (error) {
      throw new Error('Failed to add favourite');
    }
  }

  /**
   * Search messages across ALL rooms the user is a member of.
   * Uses pg_trgm for fuzzy text search on text_content.
   */
  async searchAllMessages(
    userId: string,
    term: string,
    limit = 50,
    roomId?: string,
  ): Promise<ChatMessage[]> {
    const supabase = this.supabaseService.getClient();
    const blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);

    // Get all room IDs the user is a member of
    const { data: memberRooms, error: memberErr } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId);

    if (memberErr || !memberRooms || memberRooms.length === 0) {
      return [];
    }

    let roomIds = memberRooms.map((r: { room_id: string }) => r.room_id);

    // If a specific roomId is provided, limit to that room only
    if (roomId) {
      if (!roomIds.includes(roomId)) return [];
      roomIds = [roomId];
    }

    const trimmedTerm = term.trim();
    if (trimmedTerm.length < 2) return [];

    let query = supabase
      .from('chat_messages')
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .in('room_id', roomIds)
      .ilike('text_content', `%${trimmedTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (blockedIds.length > 0) {
      query = query.not('sender_id', 'in', blockedIds);
    }

    const response = await query;
    if (response.error || !response.data) {
      return [];
    }

    const messages: DeletedAwareMessage[] = response.data;

    // Filter out deleted messages
    return messages.filter((msg) => {
      if (msg.is_deleted) return false;
      if (
        Array.isArray(msg.deleted_for_user_ids) &&
        msg.deleted_for_user_ids.includes(userId)
      )
        return false;
      return true;
    });
  }

  async getFavourites(userId: string): Promise<FavouriteRecord[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (response.error || !response.data) {
      return [];
    }
    return response.data;
  }

  async deleteFavourite(userId: string, favouriteId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('favourites')
      .delete()
      .eq('id', favouriteId)
      .eq('user_id', userId);

    if (error) throw new Error('Failed to delete favourite');
  }

  async getSuggestedReplies(
    userId: string,
    dto: SuggestedRepliesRequestDto,
  ): Promise<string[]> {
    const recentMessages = dto.recent_messages ?? [];
    const contextMessages = recentMessages.slice(-10);

    let prompt: string;
    if (contextMessages.length === 0) {
      prompt =
        'Generate 3 short, natural conversation starters for a new language exchange chat. Return one suggestion per line, without numbers or bullet points.';
    } else {
      const contextLines = contextMessages
        .map((m) => `${m.sender_id}: ${m.text}`)
        .join('\n');
      prompt = `Based on this conversation:\n${contextLines}\n\nGenerate 3 short, natural suggested replies that the user could send next. Return one suggestion per line, without numbers or bullet points.`;
    }

    try {
      const response = await this.chatLlmService.generateText(prompt, {
        system:
          'You are a helpful language learning conversation assistant. Provide concise, natural suggestions that fit the given context.',
        temperature: 0.8,
        maxTokens: 150,
      });
      const lines = this.parseSuggestedReplies(response);
      const suggestions = lines.slice(0, 3);
      if (suggestions.length === 0) {
        throw new Error('Empty response from LLM');
      }
      return suggestions;
    } catch (error) {
      console.error(
        'Failed to generate suggestions, using fallback:',
        (error as Error).message,
      );
      // fallback to static suggestions
      return [
        'Sure, let’s talk about travel.',
        'Could you help me with my pronunciation?',
        'I enjoyed that conversation.',
      ];
    }
  }

  private parseSuggestedReplies(raw: string): string[] {
    const lines = raw
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/^\s*[-•*]\s*/, '')
          .replace(/^\s*\d+[.):]\s*/, '')
          .replace(/^["'“”]/, '')
          .replace(/["'“”]+$/, '')
          .trim(),
      )
      .filter((line) => line.length > 0);

    const seen = new Set<string>();
    const uniqueLines: string[] = [];
    for (const line of lines) {
      if (!seen.has(line)) {
        seen.add(line);
        uniqueLines.push(line);
      }
    }
    return uniqueLines;
  }

  async createGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
  ): Promise<ChatRoomRecord> {
    if (memberIds.length > 50) {
      throw new Error('Group cannot exceed 51 members (50 selected + creator)');
    }

    const supabase = this.supabaseService.getClient();

    // Insert room
    const response = await supabase
      .from('chat_rooms')
      .insert({
        title: name,
        is_online: true,
        is_pinned: false,
        admin_id: creatorId,
        labels: [],
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error('Failed to create group');
    }

    const room = response.data as ChatRoomRecord;

    // Insert members
    const allMembers = [...new Set([creatorId, ...memberIds])];
    const membersData = allMembers.map((id) => ({
      room_id: room.id,
      user_id: id,
    }));

    const { error: membersError } = await supabase
      .from('chat_room_members')
      .insert(membersData);

    if (membersError) {
      throw new Error('Failed to add members to group');
    }

    return room;
  }

  private async verifyAdmin(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('admin_id')
      .eq('id', roomId)
      .single();

    if (!room || room.admin_id !== userId) {
      throw new ForbiddenException('Only group admins can perform this action');
    }
  }

  async renameGroup(
    userId: string,
    roomId: string,
    newName: string,
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('chat_rooms')
      .update({ title: newName })
      .eq('id', roomId);

    if (error) throw new Error('Failed to rename group');

    await this.systemMessageService.publishToRoom(roomId, 'groupRenamed', {
      name: newName,
    });
  }

  async addGroupMembers(
    userId: string,
    roomId: string,
    memberIds: string[],
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();

    const membersData = memberIds.map((id) => ({
      room_id: roomId,
      user_id: id,
    }));

    const { error } = await supabase
      .from('chat_room_members')
      .insert(membersData);

    if (error) throw new Error('Failed to add members');

    await this.systemMessageService.publishToRoom(roomId, 'memberAdded', {
      count: memberIds.length,
    });
  }

  async removeGroupMember(
    userId: string,
    roomId: string,
    memberId: string,
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('chat_room_members')
      .delete()
      .match({ room_id: roomId, user_id: memberId });

    if (error) throw new Error('Failed to remove member');

    await this.systemMessageService.publishToRoom(roomId, 'memberRemoved', {});
  }

  async getGroupMembers(
    roomId: string,
    _currentUserId?: string,
  ): Promise<GroupMember[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select(
        `
        user_id,
        user:users!chat_room_members_user_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('room_id', roomId);

    if (error) throw new Error('Failed to fetch group members');
    return data ?? [];
  }

  // ---- Chat Lock methods ----

  async lockChat(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('chat_room_members')
      .update({ is_locked: true })
      .match({ user_id: userId, room_id: roomId });

    if (error) {
      throw new Error(`Failed to lock chat: ${error.message}`);
    }
  }

  async unlockChat(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('chat_room_members')
      .update({ is_locked: false })
      .match({ user_id: userId, room_id: roomId });

    if (error) {
      throw new Error(`Failed to unlock chat: ${error.message}`);
    }
  }

  async getLockedChats(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId)
      .eq('is_locked', true);

    if (error) {
      throw new Error(`Failed to get locked chats: ${error.message}`);
    }

    return (data ?? []).map((row: { room_id: string }) => row.room_id);
  }

  async shareContact(
    senderId: string,
    dto: ShareContactDto,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    // Verify sender is a member of this room
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', dto.roomId)
      .eq('user_id', senderId)
      .maybeSingle();
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // Fetch contact user profile
    const { data: contact, error: contactError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', dto.contactUserId)
      .maybeSingle();
    if (contactError || !contact) {
      throw new BadRequestException('Contact user not found');
    }

    // Find receiver for push notification and block checks
    const { data: roomMembers, error: roomMembersError } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', dto.roomId)
      .neq('user_id', senderId);
    if (roomMembersError) {
      throw new Error(
        `Failed to load room members: ${roomMembersError.message}`,
      );
    }
    const receiverId =
      roomMembers && roomMembers.length > 0
        ? roomMembers[0].user_id
        : undefined;

    if (receiverId) {
      // ⚡ Bolt Optimization: Group independent database lookups with a single concurrent Promise.all batch fetch to mitigate additive network latency.
      const [receiverBlockedIds, senderBlockedIds] = await Promise.all([
        this.safetyService.getBlockedAndBlockerIds(receiverId),
        this.safetyService.getBlockedAndBlockerIds(senderId),
      ]);
      if (receiverBlockedIds.includes(senderId)) {
        throw new Error('You cannot send contact to this user.');
      }
      if (senderBlockedIds.includes(receiverId)) {
        throw new Error('You cannot send contact to this user.');
      }
    }

    const previewText =
      dto.greetingText?.trim() || `Check out ${contact.display_name}'s profile`;

    const { data: savedMessage, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        room_id: dto.roomId,
        sender_id: senderId,
        message_type: 'contact',
        text_content: previewText,
        media_url: null,
        correction_payload: null,
        reply_to_id: null,
        correction_request_payload: null,
        contact_payload: {
          contact_user_id: contact.id,
          display_name: contact.display_name,
          avatar_url: contact.avatar_url,
        },
        is_view_once: false,
        delivery_status: 'sent',
      } as Record<string, unknown>)
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .single();

    if (insertError || !savedMessage) {
      const msg = insertError?.message ?? 'Unknown error';
      throw new Error(`Failed to save contact message: ${msg}`);
    }

    // Publish to Centrifugo so receivers get the new message immediately
    await this.centrifugoService.publish(`chat:${dto.roomId}`, {
      message: savedMessage,
    });

    // Award XP for contributing a message
    void this.xpService.awardXpForActivity(senderId, 'send_message');

    // Notify receiver via push notification
    if (receiverId) {
      this.eventEmitter.emit(
        'chat.message',
        new ChatMessageEvent(
          senderId,
          receiverId,
          dto.roomId,
          'contact',
          previewText,
        ),
      );
    }

    // Emit message.sent event for achievements evaluation
    this.eventEmitter.emit('message.sent', { userId: senderId });

    return savedMessage;
  }

  async setWallpaper(
    userId: string,
    roomId: string,
    dto: SetWallpaperDto,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the room
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const { error } = await supabase
      .from('chat_rooms')
      .update({ wallpaper_url: dto.wallpaperUrl })
      .eq('id', roomId);

    if (error) {
      throw new Error(`Failed to set wallpaper: ${error.message}`);
    }
  }

  async getWallpaper(roomId: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('chat_rooms')
      .select('wallpaper_url')
      .eq('id', roomId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.wallpaper_url ?? null;
  }

  async replyToStatusUpdate(
    userId: string,
    dto: ReplyToStatusUpdateDto,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    // Try to reuse an existing 1-to-1 chat between the two users.
    let roomId: string | undefined;

    const { data: myRooms } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId);

    const myRoomIds = (myRooms ?? []).map(
      (r: { room_id: string }) => r.room_id,
    );

    if (myRoomIds.length > 0) {
      const { data: mutualRooms } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', dto.target_user_id)
        .in('room_id', myRoomIds);

      const mutualRoomIds = (mutualRooms ?? []).map(
        (r: { room_id: string }) => r.room_id,
      );

      if (mutualRoomIds.length > 0) {
        const { data: allMembers } = await supabase
          .from('chat_room_members')
          .select('room_id, user_id')
          .in('room_id', mutualRoomIds);

        if (allMembers) {
          const roomCounts = new Map<string, number>();
          for (const member of allMembers) {
            roomCounts.set(
              member.room_id,
              (roomCounts.get(member.room_id) || 0) + 1,
            );
          }

          for (const candidateRoomId of mutualRoomIds) {
            if (roomCounts.get(candidateRoomId) === 2) {
              roomId = candidateRoomId;
              break;
            }
          }
        }
      }
    }

    if (!roomId) {
      // Create a new room when no existing 1-to-1 chat exists.
      const newRoomId = randomUUID();

      const { error: roomError } = await supabase.from('chat_rooms').insert({
        id: newRoomId,
        title: 'Status reply',
        subtitle: dto.status_text.slice(0, 80),
        avatar: '',
        is_online: false,
        is_pinned: false,
      });

      if (roomError) {
        throw new Error(`Failed to create room: ${roomError.message}`);
      }

      const members = [userId, dto.target_user_id].map((uid) => ({
        room_id: newRoomId,
        user_id: uid,
      }));

      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert(members);

      if (memberError) {
        throw new Error(`Failed to add room members: ${memberError.message}`);
      }

      roomId = newRoomId;
    }

    // Reuse sendMessage logic, passing the user’s reply as the text content.
    const msgDto: SendMessageDto = {
      room_id: roomId,
      message_type: 'status_reply',
      text_content: dto.text ?? undefined,
      media_url: undefined,
      correction_payload: undefined,
      reply_to_id: undefined,
      correction_request_payload: undefined,
      status_reply_payload: {
        status_update_id: dto.status_update_id,
        status_text: dto.status_text,
      },
    };

    return this.sendMessage(userId, msgDto);
  }

  async translateMessage(
    userId: string,
    text: string,
    targetLanguage: string,
  ): Promise<string> {
    if (!text || !text.trim()) {
      throw new BadRequestException('Text cannot be empty');
    }
    if (!targetLanguage || !targetLanguage.trim()) {
      throw new BadRequestException('Target language cannot be empty');
    }
    return this.chatLlmService.translateText(
      text.trim(),
      targetLanguage.trim(),
    );
  }

  async llmProxy(
    userId: string,
    messageText: string,
  ): Promise<{ response: string }> {
    const result = await this.chatLlmService.proxyMessage(messageText);
    return { response: result.response };
  }

  async correctMessage(
    userId: string,
    messageId: string,
    correctedText: string,
    explanation?: string,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    const { data: originalMsg, error: fetchErr } = await supabase
      .from('chat_messages')
      .select('room_id, text_content, sender_id, message_type')
      .eq('id', messageId)
      .single();

    if (fetchErr || !originalMsg) {
      throw new Error('Original message not found');
    }

    if (!isRecord(originalMsg) || originalMsg.message_type !== 'text') {
      throw new BadRequestException('Only text messages can be corrected');
    }

    const roomId = asString(originalMsg.room_id);
    const originalText = asString(originalMsg.text_content) ?? '';

    if (!roomId) {
      throw new BadRequestException('Message is missing room identifier');
    }

    const sendDto: SendMessageDto = {
      room_id: roomId,
      message_type: 'correction',
      text_content: undefined,
      media_url: undefined,
      correction_payload: {
        original: originalText,
        corrected: correctedText,
        explanation: explanation ?? undefined,
      },
      reply_to_id: messageId,
      correction_request_payload: undefined,
      status_reply_payload: undefined,
    };

    return await this.sendMessage(userId, sendDto);
  }

  async fixMessage(
    userId: string,
    messageId: string,
    correctedText: string,
    explanation?: string,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    const { data: originalMsg, error: fetchErr } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchErr || !originalMsg) {
      throw new Error('Message not found');
    }

    if (!isRecord(originalMsg) || originalMsg.message_type !== 'text') {
      throw new BadRequestException('Only text messages can be fixed');
    }

    const roomId = asString(originalMsg.room_id);
    const senderId = asString(originalMsg.sender_id);
    const textContent = asString(originalMsg.text_content);

    if (!roomId) {
      throw new BadRequestException('Message is missing room identifier');
    }

    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    if (senderId === userId) {
      throw new ForbiddenException('You cannot fix your own message');
    }

    const rawCorrectionPayload: unknown = originalMsg.correction_payload;
    const currentPayload = isRecord(rawCorrectionPayload)
      ? rawCorrectionPayload
      : null;

    const originalText =
      currentPayload && typeof currentPayload.original === 'string'
        ? currentPayload.original
        : (textContent ?? '');

    let resolvedExplanation = explanation;

    if (!resolvedExplanation) {
      const payloadForGeneration = currentPayload ?? {
        original: originalText,
        corrected: correctedText,
      };
      const enrichedPayload =
        await this.generateCorrectionPayloadIfNeeded(payloadForGeneration);
      if (enrichedPayload && typeof enrichedPayload.explanation === 'string') {
        resolvedExplanation = enrichedPayload.explanation;
      }
    }

    const existingExplanation =
      currentPayload && typeof currentPayload.explanation === 'string'
        ? currentPayload.explanation
        : undefined;

    const updatedPayload = {
      original: originalText,
      corrected: correctedText,
      explanation: resolvedExplanation ?? existingExplanation,
    };

    const { data: updatedMsg, error: updateErr } = await supabase
      .from('chat_messages')
      .update({
        text_content: correctedText,
        correction_payload: updatedPayload,
      })
      .eq('id', messageId)
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .single();

    if (updateErr || !updatedMsg) {
      throw new Error(
        `Failed to fix message: ${updateErr?.message ?? 'Unknown error'}`,
      );
    }

    await this.centrifugoService.publish(`chat:${roomId}`, {
      message: updatedMsg,
    });

    return updatedMsg;
  }

  async editMessage(
    userId: string,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    const { data: originalMsg, error: fetchErr } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchErr || !originalMsg) {
      throw new NotFoundException('Message not found');
    }

    if (!isRecord(originalMsg)) {
      throw new BadRequestException('Invalid message data');
    }

    const senderId = asString(originalMsg.sender_id);
    const messageType = asString(originalMsg.message_type);
    const roomId = asString(originalMsg.room_id);
    const createdAt = asString(originalMsg.created_at);

    if (!senderId || !messageType || !roomId) {
      throw new BadRequestException('Message is missing required fields');
    }

    if (senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (messageType !== 'text') {
      throw new BadRequestException('Only text messages can be edited');
    }

    // Check edit time window
    if (createdAt) {
      const editWindowMinutes = this.configService.get<number>(
        'MESSAGE_EDIT_WINDOW_MINUTES',
        5,
      );
      const messageTime = new Date(createdAt).getTime();
      const now = Date.now();
      const windowMs = editWindowMinutes * 60 * 1000;
      if (now - messageTime > windowMs) {
        throw new ForbiddenException(
          `Messages can only be edited within ${editWindowMinutes} minutes of sending`,
        );
      }
    }

    // Verify the user is still a member of the room
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const { data: updatedMsg, error: updateErr } = await supabase
      .from('chat_messages')
      .update({
        text_content: dto.text_content,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .single();

    if (updateErr || !updatedMsg) {
      throw new Error(
        `Failed to edit message: ${updateErr?.message ?? 'Unknown error'}`,
      );
    }

    await this.centrifugoService.publish(`chat:${roomId}`, {
      message: updatedMsg,
    });

    return updatedMsg;
  }

  async deleteMessage(
    userId: string,
    messageId: string,
    scope: 'self' | 'everyone',
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: msg, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (msgError || !msg) {
      throw new NotFoundException('Message not found');
    }

    // Verify the user is a member of the room that the message belongs to
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', msg.room_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    if (scope === 'self') {
      // Delete the message only for the current user (soft delete)
      let deletedFor: string[] = [];
      if (isRecord(msg) && Array.isArray(msg.deleted_for_user_ids)) {
        deletedFor = msg.deleted_for_user_ids.filter(
          (x): x is string => typeof x === 'string',
        );
      }

      if (!deletedFor.includes(userId)) {
        deletedFor.push(userId);
      }

      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ deleted_for_user_ids: deletedFor })
        .eq('id', messageId);

      if (updateError) {
        throw new Error(
          `Failed to delete message for self: ${updateError.message}`,
        );
      }
      return;
    }

    // scope === 'everyone'
    // Only the message sender or a group admin can delete for everyone
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('admin_id')
      .eq('id', msg.room_id)
      .single();

    if (
      room &&
      room.admin_id &&
      room.admin_id !== userId &&
      msg.sender_id !== userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to delete this message for everyone',
      );
    }

    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      throw new Error(
        `Failed to delete message for everyone: ${deleteError.message}`,
      );
    }

    // Notify all clients in the room that the message was removed
    await this.centrifugoService.publish(`chat:${msg.room_id}`, {
      type: 'message_deleted',
      message_id: messageId,
      deleted_for: 'everyone',
    });
  }

  async updateMessageStatus(
    userId: string,
    messageId: string,
    status: 'delivered' | 'read',
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('id, room_id, delivery_status')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      throw new NotFoundException('Message not found');
    }

    // Only allow upgrading status (sent -> delivered -> read)
    const order: Record<string, number> = { sent: 0, delivered: 1, read: 2 };
    const current = message.delivery_status ?? 'sent';
    if (order[status] <= order[current]) {
      return;
    }

    // Verify user is a member of the room
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', message.room_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('Not a member of this room');
    }

    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ delivery_status: status })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(
        `Failed to update message status: ${updateError.message}`,
      );
    }

    // Publish status update via Centrifugo so the sender can see it
    await this.centrifugoService.publish(`chat:${message.room_id}`, {
      status_update: {
        message_id: messageId,
        delivery_status: status,
      },
    });
  }

  async viewMessageMedia(userId: string, messageId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Fetch message with media
    const { data: msg, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !msg) {
      throw new Error('Message not found');
    }

    if (!msg.is_view_once || msg.viewed_at) {
      // Already viewed or not a view-once message; nothing to do
      return;
    }

    // Verify the user is a member of the room
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', msg.room_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Mark as viewed
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', messageId);

    if (updateError) {
      throw new Error('Failed to mark message as viewed');
    }

    // For future releases, delete the actual media from storage here
    // e.g., await this.viewOnceMediaService.deleteMedia(msg.media_url);
  }

  /**
   * Forwards a message to one or more target rooms.
   * The forwarded message is marked with `is_forwarded: true` to prevent spam
   * and show a visible "Forwarded" label to recipients.
   */
  async forwardMessage(
    userId: string,
    messageId: string,
    roomIds: string[],
  ): Promise<ChatMessage[]> {
    const supabase = this.supabaseService.getClient();

    // Fetch the original message
    const { data: originalMsg, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !originalMsg) {
      throw new NotFoundException('Message not found');
    }

    // Verify the user is a member of the source room
    const { data: sourceMembership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', originalMsg.room_id)
      .eq('user_id', userId)
      .single();

    if (!sourceMembership) {
      throw new ForbiddenException('You do not have access to this message');
    }

    // Spam detection: apply to forwarded text messages
    if (
      originalMsg.message_type === 'text' &&
      typeof originalMsg.text_content === 'string' &&
      originalMsg.text_content
    ) {
      const isSpam = this.spamDetectionService.isSpam(originalMsg.text_content);
      if (isSpam) {
        throw new BadRequestException('Cannot forward spam content.');
      }
    }

    const forwardedMessages: ChatMessage[] = [];

    // Filter out the room the message is already in
    const targetRoomIds = [...new Set(roomIds)].filter(
      (id) => id !== originalMsg.room_id,
    );

    // ⚡ Bolt Optimization: Replaced sequential database queries inside a for...of loop with
    // a single bulk query to fetch user memberships for all target rooms.
    const { data: targetMemberships } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .in('room_id', targetRoomIds)
      .eq('user_id', userId);

    const validMembershipRoomIds = new Set(
      (targetMemberships || []).map((m) => m.room_id),
    );

    // ⚡ Bolt Optimization: Replaced sequential database queries inside a for...of loop with
    // a single bulk query to fetch all members of the target rooms.
    // Expected impact: Eliminates O(N) database queries scaling with the number of rooms.
    const { data: allTargetMembers } = await supabase
      .from('chat_room_members')
      .select('room_id, user_id')
      .in('room_id', Array.from(validMembershipRoomIds))
      .neq('user_id', userId);

    const membersByRoom = new Map<string, { user_id: string }[]>();
    for (const member of allTargetMembers || []) {
      if (!membersByRoom.has(member.room_id)) {
        membersByRoom.set(member.room_id, []);
      }
      membersByRoom.get(member.room_id)!.push({ user_id: member.user_id });
    }

    // ⚡ Bolt Optimization: Replaced sequential awaits in a for...of loop with a concurrent
    // Promise.allSettled mapped execution to drastically reduce database latency during fan-out inserts.
    // Expected impact: N sequential database roundtrips become 1 concurrent block.
    const forwardPromises = Array.from(validMembershipRoomIds).map(
      async (targetRoomId) => {
        const targetRoomMembers = membersByRoom.get(targetRoomId) || [];

        let blocked = false;
        if (targetRoomMembers && targetRoomMembers.length > 0) {
          const blockedIdArrays = await Promise.all(
            targetRoomMembers.map((member) =>
              this.safetyService.getBlockedAndBlockerIds(member.user_id),
            ),
          );
          blocked = blockedIdArrays.some((blockedIds) =>
            blockedIds.includes(userId),
          );
        }

        if (blocked) {
          return; // Skip rooms where sender is blocked
        }

        const insertPayload = {
          room_id: targetRoomId,
          sender_id: userId,
          message_type: originalMsg.message_type,
          text_content: originalMsg.text_content ?? null,
          media_url: originalMsg.media_url ?? null,
          correction_payload: originalMsg.correction_payload ?? null,
          reply_to_id: null, // Forwarded messages start fresh threads
          correction_request_payload:
            originalMsg.correction_request_payload ?? null,
          status_reply_payload: originalMsg.status_reply_payload ?? null,
          is_view_once: false, // Never preserve view-once on forward
          is_forwarded: true,
        };

        const insertResponse = await supabase
          .from('chat_messages')
          .insert(insertPayload)
          .select(
            `
          *,
          sender:users!chat_messages_sender_id_fkey (
            id,
            display_name,
            avatar_url
          )
        `,
          )
          .single();

        if (insertResponse.error || !insertResponse.data) {
          return; // Skip on insert failure
        }

        const forwardedMsg = insertResponse.data as ChatMessage;

        // Publish to Centrifugo channel for the target room
        await this.centrifugoService.publish(`chat:${targetRoomId}`, {
          message: forwardedMsg,
        });

        // Emit push notification for the target room members
        const preview = originalMsg.text_content
          ? originalMsg.text_content.substring(0, 120)
          : originalMsg.message_type === 'voice'
            ? '🎤 Voice message'
            : originalMsg.message_type === 'correction'
              ? '📝 Correction'
              : originalMsg.message_type === 'doodle'
                ? '🎨 Doodle'
                : '';

        const receiverId =
          targetRoomMembers && targetRoomMembers.length > 0
            ? targetRoomMembers[0].user_id
            : undefined;

        if (receiverId) {
          this.eventEmitter.emit(
            'chat.message',
            new ChatMessageEvent(
              userId,
              receiverId,
              targetRoomId,
              originalMsg.message_type,
              preview,
            ),
          );
        }

        return forwardedMsg;
      },
    );

    const results = await Promise.allSettled(forwardPromises);
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failures.length > 0) {
      throw failures[0].reason;
    }

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        forwardedMessages.push(result.value);
      }
    });

    if (forwardedMessages.length === 0) {
      throw new BadRequestException(
        'Message could not be forwarded to any of the specified rooms. Check your membership and block status.',
      );
    }

    return forwardedMessages;
  }

  /**
   * Exports full chat history for the given room as an array of ChatMessage.
   * The caller must be a member of the room.
   */
  async exportChatHistory(
    userId: string,
    roomId: string,
  ): Promise<ChatMessage[]> {
    const supabase = this.supabaseService.getClient();

    // Verify membership
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // Fetch all messages for this room (up to 1000 for now)
    const { data, error } = await supabase
      .from('chat_messages')
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Returns the greeting and away messages set by the other participant(s) in the room.
   * Used to display automated messages when a chat is first opened.
   */
  /**
   * Add a label to a chat room.
   */
  async addLabel(userId: string, roomId: string, label: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify membership
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // Get current labels
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('labels')
      .eq('id', roomId)
      .single();

    if (!room) {
      throw new Error('Room not found');
    }

    const currentLabels: string[] = room.labels ?? [];
    if (currentLabels.includes(label)) {
      // Already exists
      return;
    }

    const newLabels = [...currentLabels, label];
    const { error } = await supabase
      .from('chat_rooms')
      .update({ labels: newLabels })
      .eq('id', roomId);

    if (error) {
      throw new Error(`Failed to add label: ${error.message}`);
    }
  }

  /**
   * Remove a label from a chat room.
   */
  async removeLabel(
    userId: string,
    roomId: string,
    label: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify membership
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const { data: room } = await supabase
      .from('chat_rooms')
      .select('labels')
      .eq('id', roomId)
      .single();

    if (!room) {
      return;
    }

    let currentLabels: string[] = room.labels ?? [];
    currentLabels = currentLabels.filter((l) => l !== label);

    const { error } = await supabase
      .from('chat_rooms')
      .update({ labels: currentLabels })
      .eq('id', roomId);

    if (error) {
      throw new Error(`Failed to remove label: ${error.message}`);
    }
  }

  /**
   * Get all unique labels across rooms that the current user is a member of.
   */
  async getUserLabels(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();

    const { data: memberRows } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId);

    const roomIds = (memberRows ?? []).map(
      (r: { room_id: string }) => r.room_id,
    );
    if (roomIds.length === 0) {
      return [];
    }

    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('labels')
      .in('id', roomIds);

    const labelSet = new Set<string>();
    if (rooms) {
      for (let i = 0, len = rooms.length; i < len; i++) {
        const labels = rooms[i].labels;
        if (labels) {
          for (let j = 0, llen = labels.length; j < llen; j++) {
            labelSet.add(labels[j]);
          }
        }
      }
    }
    return Array.from(labelSet);
  }

  /**
   * Return all rooms belonging to the current user that have a specific label.
   */
  async getRoomsByLabel(
    userId: string,
    label: string,
  ): Promise<ChatRoomRecord[]> {
    const rooms = await this.getRooms(userId);
    return rooms.filter((r) => r.labels?.includes(label));
  }

  async getRoomGreeting(
    roomId: string,
    currentUserId: string,
  ): Promise<{ greetingMessage?: string; awayMessage?: string }> {
    const supabase = this.supabaseService.getClient();

    // Find the other user in this private room (skip group chats for simplicity)
    const { data: members } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .neq('user_id', currentUserId);

    if (!members || members.length === 0) {
      return {};
    }

    // We fetch the first other user's profile
    const otherUserId = (members as { user_id: string }[])[0].user_id;

    const { data: profile } = await supabase
      .from('users')
      .select('greeting_message, away_message')
      .eq('id', otherUserId)
      .single();

    if (!profile) {
      return {};
    }

    if (!isRecord(profile)) {
      return {};
    }

    return {
      greetingMessage:
        typeof profile.greeting_message === 'string'
          ? profile.greeting_message
          : undefined,
      awayMessage:
        typeof profile.away_message === 'string'
          ? profile.away_message
          : undefined,
    };
  }

  /**
   * Generates a reply from the AI conversation partner using the LLM proxy.
   */
  async generateAiReply(
    userId: string,
    messageText: string,
  ): Promise<{ response: string }> {
    if (!messageText || messageText.trim().length === 0) {
      throw new BadRequestException('Message text cannot be empty');
    }
    const prompt = [
      'You are a friendly language learning conversation partner.',
      'Keep responses short, natural, and helpful.',
      `The user wrote: "${messageText}"`,
    ].join('\n');
    const result = await this.chatLlmService.proxyMessage(prompt);
    return { response: result.response };
  }

  private async ensureGreetingMessage(
    currentUserId: string,
    roomId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Get room members to find the other user in a private chat
    const { data: members } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .neq('user_id', currentUserId);

    if (!members || members.length !== 1) {
      return;
    }

    const otherUserId = (members as { user_id: string }[])[0].user_id;

    // Fetch the other user's greeting message, if any
    const { data: otherProfile, error: profileError } = await supabase
      .from('users')
      .select('greeting_message')
      .eq('id', otherUserId)
      .maybeSingle();

    if (profileError || !otherProfile) {
      return;
    }

    const greeting =
      typeof otherProfile.greeting_message === 'string'
        ? otherProfile.greeting_message.trim()
        : '';

    if (!greeting) {
      return;
    }

    // Check if there are already messages in the room
    const { count, error: countError } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (countError) return;
    if ((count ?? 0) > 0) return;

    // Insert the automated greeting message from the other user
    const { data: inserted, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: otherUserId,
        message_type: 'text',
        text_content: greeting,
        media_url: null,
        correction_payload: null,
        reply_to_id: null,
        correction_request_payload: null,
        status_reply_payload: null,
        is_view_once: false,
        delivery_status: 'sent',
      })
      .select()
      .single();

    if (insertError || !inserted) {
      return;
    }

    const greetingMessage = inserted as ChatMessage;

    // Publish the greeting so all connected clients receive it
    await this.centrifugoService.publish(`chat:${roomId}`, {
      message: greetingMessage,
    });
  }

  private async sendAwayReplyIfNeeded(
    messageSenderId: string,
    roomId: string,
    receiverId?: string,
  ): Promise<void> {
    if (!receiverId || messageSenderId === receiverId) {
      return;
    }

    const supabase = this.supabaseService.getClient();

    // Fetch receiver's away_message from users
    const { data: receiverProfile, error: profileError } = await supabase
      .from('users')
      .select('away_message')
      .eq('id', receiverId)
      .maybeSingle();

    if (profileError || !receiverProfile) {
      return;
    }

    const awayMessage =
      typeof receiverProfile.away_message === 'string'
        ? receiverProfile.away_message.trim()
        : '';

    if (!awayMessage) {
      return;
    }

    // Check the last message in room from receiver to avoid sending repeated away replies too often
    const { data: lastReceiverMsg, error: lastMsgError } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('room_id', roomId)
      .eq('sender_id', receiverId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMsgError) return;

    if (lastReceiverMsg) {
      const lastMsgTime = new Date(lastReceiverMsg.created_at).getTime();
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;
      if (now - lastMsgTime < fiveMinutesMs) {
        return;
      }
    }

    // Insert the away reply as a message from the receiver
    const { data: awayMessageRecord, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: receiverId,
        message_type: 'text',
        text_content: awayMessage,
        media_url: null,
        correction_payload: null,
        reply_to_id: null,
        correction_request_payload: null,
        status_reply_payload: null,
        is_view_once: false,
        delivery_status: 'sent',
      })
      .select()
      .single();

    if (insertError || !awayMessageRecord) {
      return;
    }

    const awayMessageChat = awayMessageRecord as ChatMessage;

    // Publish the away reply
    await this.centrifugoService.publish(`chat:${roomId}`, {
      message: awayMessageChat,
    });
  }
}
