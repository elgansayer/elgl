import { IsOptional, IsArray, IsString } from 'class-validator';

class RecentMessageDto {
  @IsString()
  sender_id!: string;

  @IsString()
  text!: string;
}

export class SuggestedRepliesRequestDto {
  @IsString()
  room_id!: string;

  @IsOptional()
  @IsArray()
  recent_messages?: RecentMessageDto[];
}
