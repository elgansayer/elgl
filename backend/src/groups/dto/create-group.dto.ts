import { IsString, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  community_id?: string;

  @IsOptional()
  @IsUUID()
  interestId?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(19)
  maxMembers?: number;
}
