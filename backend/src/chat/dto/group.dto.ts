import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
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
