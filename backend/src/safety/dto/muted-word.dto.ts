import { IsString, MaxLength, MinLength } from 'class-validator';

export class MutedWordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  word!: string;
}

export interface MutedWordsResponseDto {
  words: string[];
}
