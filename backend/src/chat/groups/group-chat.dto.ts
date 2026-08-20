import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** A short study focus, e.g. "Beginner French Grammar". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  /** Optional canonical interest used by discovery/recommendation surfaces. */
  @IsOptional()
  @IsUUID('4')
  interestId?: string;

  // Creator is member #1, so at most 18 partners can be invited.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(18)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}

export class RenameGroupChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

export class UpdateGroupChatDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @IsUUID('4')
  interestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;
}

export class AddGroupMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(18)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}

export class TransferGroupAdminDto {
  @IsUUID('4')
  newAdminId!: string;
}

export class LeaveGroupChatDto {
  @IsOptional()
  @IsUUID('4')
  newAdminId?: string;
}
