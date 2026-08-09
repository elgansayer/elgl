import { IsArray, IsString, ArrayMaxSize, IsOptional } from 'class-validator';

export class AddMemberDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  memberIds!: string[];
  @IsOptional()
  @IsString()
  inviteCode?: string;
}
