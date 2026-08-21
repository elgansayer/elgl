import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Safe, publicly exposed subset of an audio room used by the SSR-rendered
 * Voiceroom preview page and social media link previews.
 *
 * This DTO intentionally excludes sensitive or private data: speaker lists,
 * raised hands, invited user ids, recording URLs, biometric lock state and
 * the host's internal user id. Only fields that are safe to show to
 * unauthenticated visitors are returned.
 */
export class RoomPreviewDto {
  @ApiProperty({
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  id: string;

  @ApiProperty({
    description: 'Unique LiveKit room name',
    example: 'room_spanish-conversation-practice',
  })
  room_name: string;

  @ApiPropertyOptional({
    description: 'Human readable room title',
    example: 'Spanish Conversation Practice',
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'Language pair in ISO format',
    example: 'en-es',
  })
  language_pair?: string;

  @ApiPropertyOptional({
    description: 'Topic tag describing the room focus',
    example: 'conversation',
  })
  topic_tag?: string;

  @ApiPropertyOptional({
    description: 'Proficiency level of the room',
    example: 'intermediate',
  })
  level?: string;

  @ApiProperty({
    description: 'Current listener count',
    example: 12,
  })
  listeners_count: number;

  @ApiProperty({
    description: 'Whether the room is currently active',
    example: true,
  })
  is_active: boolean;

  @ApiPropertyOptional({
    description: 'Public host profile shown on the preview page',
    example: {
      display_name: 'Ana',
      avatar_url: 'https://cdn.example.com/avatars/ana.png',
    },
  })
  host?: {
    display_name?: string;
    avatar_url?: string | null;
  } | null;
}
