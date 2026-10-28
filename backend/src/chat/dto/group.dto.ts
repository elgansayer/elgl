import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';

export const GROUP_NAME_MAX_LENGTH = 100;

export class CreateGroupDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  memberIds!: string[];

  @IsOptional()
  @IsString()
  inviteCode?: string;
}

/** Body for `PATCH /chat/groups/:roomId/rename`. */
export class RenameGroupDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  name!: string;
}

export class GroupMemberDto {
  @IsUUID()
  @IsNotEmpty()
  user_id!: string;
}
