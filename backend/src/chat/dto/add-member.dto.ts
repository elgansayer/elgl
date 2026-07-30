import { IsArray, IsString, ArrayMaxSize } from 'class-validator';

export class AddMemberDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(49)
  memberIds!: string[];
}
