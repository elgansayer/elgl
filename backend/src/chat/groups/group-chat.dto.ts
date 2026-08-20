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
