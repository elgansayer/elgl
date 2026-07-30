import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  community_id?: string;
}
