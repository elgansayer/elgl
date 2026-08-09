import {
  IsString,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  memberIds!: string[];
  @IsOptional()
  @IsString()
  inviteCode?: string;
}
