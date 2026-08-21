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
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(18)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}

export class UpdateGroupChatDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;
}

export class AddGroupChatMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(18)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}

export class TransferGroupChatAdminDto {
  @IsUUID('4')
  memberId!: string;
}
