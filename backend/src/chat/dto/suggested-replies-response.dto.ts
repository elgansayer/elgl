import { IsArray, IsString } from 'class-validator';

export class SuggestedRepliesResponseDto {
  @IsArray()
  @IsString({ each: true })
  suggestions!: string[];
}
