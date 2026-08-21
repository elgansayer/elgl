import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartVideoCallDto {
  @ApiPropertyOptional({
    description:
      'Whether this is a video call (true) or audio-only (false). Defaults to true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_video?: boolean;

  @ApiPropertyOptional({
    description:
      'UUID of the callee for direct calls. Omit for creating an open room.',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  callee_id?: string;

  @ApiPropertyOptional({
    description:
      'Maximum participants allowed. Defaults to 2 for direct calls, up to 50 for classrooms.',
    minimum: 2,
    maximum: 50,
    default: 2,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  max_participants?: number;
}

export class JoinVideoCallDto {
  @ApiProperty({
    description: 'Name of the LiveKit room to join.',
    example: 'video_a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  })
  @IsString()
  @IsNotEmpty()
  room_name!: string;
}

export class VideoCallTokenResponseDto {
  @ApiProperty({
    description: 'LiveKit access token for joining the room.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;

  @ApiProperty({
    description: 'Name of the LiveKit room.',
    example: 'video_a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  })
  room_name!: string;

  @ApiProperty({
    description: 'Whether this is a video call (true) or audio-only (false).',
    example: true,
  })
  is_video!: boolean;
}

export class EndVideoCallDto {
  @ApiProperty({
    description: 'Name of the LiveKit room to end.',
    example: 'video_a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  })
  @IsString()
  @IsNotEmpty()
  room_name!: string;
}

export class ListActiveRoomsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by room type: "classroom", "direct", or "all".',
    enum: ['classroom', 'direct', 'all'],
    default: 'all',
    example: 'classroom',
  })
  @IsOptional()
  @IsString()
  type?: 'classroom' | 'direct' | 'all';

  @ApiPropertyOptional({
    description: 'Filter by topic tag (e.g., "english", "spanish", "grammar").',
    example: 'english',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Filter by language pair (e.g., "en-es").',
    example: 'en-es',
  })
  @IsOptional()
  @IsString()
  language_pair?: string;
}
