import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
  @IsOptional()
  @IsString()
  inviteCode?: string;
}

export class RenameGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class GroupMemberDto {
  @IsUUID()
  @IsNotEmpty()
  user_id!: string;
}
