import { IsString, IsArray, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(49)
  memberIds!: string[];
}
