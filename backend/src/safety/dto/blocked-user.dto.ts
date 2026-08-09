export interface BlockedUserResponseDto {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_language?: string;
  blocked_at?: string;
}

export class BlockedUserDto {}
